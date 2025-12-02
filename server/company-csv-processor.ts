/**
 * Company CSV Processing Engine
 * Handles CSV parsing, field mapping, and bulk import of companies
 * Features: WebSocket progress broadcasting, optimized batching
 */

import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import csv from 'csv-parser';
import { storage } from './storage';
import { companyFieldMapper } from './nlp-mapper';
import { type InsertCompany } from '@shared/schema';
import { wsHub } from './ws-hub';

const pipelineAsync = promisify(pipeline);

interface CompanyProcessingStats {
  processed: number;
  successful: number;
  errors: number;
  duplicates: number;
  updated: number;
}

interface CompanyProcessingOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  batchSize: number;
  fieldMapping: Record<string, string>;
}

export class CompanyCSVProcessor {
  private batchSize = 500;
  private duplicateCache = new Map<string, any>();
  private errorAccumulator: any[] = [];
  private lastProgressBroadcast = 0;
  private progressBroadcastInterval = 100;

  async processCompanyCSV(
    filePath: string,
    jobId: string,
    options: CompanyProcessingOptions
  ): Promise<void> {
    const stats: CompanyProcessingStats = {
      processed: 0,
      successful: 0,
      errors: 0,
      duplicates: 0,
      updated: 0
    };

    const startTime = Date.now();
    this.errorAccumulator = [];

    try {
      await this.preloadDuplicateCache();

      const totalRows = await this.countCSVRows(filePath);
      
      await storage.updateImportJob(jobId, {
        status: 'processing',
        totalRows: totalRows - 1,
        processedRows: 0,
      });

      // Broadcast initial status via WebSocket
      wsHub.broadcast(jobId, {
        status: 'processing',
        totalRows: totalRows - 1,
        processedRows: 0,
        successfulRows: 0,
        errorRows: 0,
        duplicateRows: 0,
        message: 'Starting company import...'
      }, true);

      // True streaming: process batches on the fly without accumulating in memory
      let currentBatch: any[] = [];
      let lastDbUpdate = Date.now();
      const dbUpdateInterval = 2000;

      const streamProcessor = new Transform({
        objectMode: true,
        transform: async (record: any, encoding, callback) => {
          currentBatch.push(record);
          
          if (currentBatch.length >= this.batchSize) {
            try {
              const batchResults = await this.processBatchOptimized([...currentBatch], options);
              
              stats.processed += batchResults.processed;
              stats.successful += batchResults.successful;
              stats.errors += batchResults.errors;
              stats.duplicates += batchResults.duplicates;
              stats.updated += batchResults.updated;

              // Broadcast progress via WebSocket
              this.broadcastProgress(jobId, stats, totalRows - 1);

              // Update database periodically
              const now = Date.now();
              if (now - lastDbUpdate >= dbUpdateInterval) {
                await storage.updateImportJob(jobId, {
                  processedRows: stats.processed,
                  successfulRows: stats.successful,
                  errorRows: stats.errors,
                  duplicateRows: stats.duplicates,
                });
                lastDbUpdate = now;
              }

              currentBatch = [];
            } catch (error) {
              console.error('Batch processing error:', error);
              stats.errors += currentBatch.length;
              currentBatch = [];
            }
          }
          
          callback();
        },
        flush: async (callback) => {
          // Process remaining records
          if (currentBatch.length > 0) {
            try {
              const batchResults = await this.processBatchOptimized([...currentBatch], options);
              
              stats.processed += batchResults.processed;
              stats.successful += batchResults.successful;
              stats.errors += batchResults.errors;
              stats.duplicates += batchResults.duplicates;
              stats.updated += batchResults.updated;
            } catch (error) {
              console.error('Final batch error:', error);
              stats.errors += currentBatch.length;
            }
          }
          callback();
        }
      });

      await pipelineAsync(
        fs.createReadStream(filePath),
        csv(),
        streamProcessor
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      await storage.updateImportJob(jobId, {
        status: 'completed',
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
        completedAt: new Date(),
        errors: this.errorAccumulator.length > 0 ? this.errorAccumulator : null,
      });

      // Broadcast completion via WebSocket
      wsHub.broadcastComplete(jobId, {
        totalRows: totalRows - 1,
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
        updatedRows: stats.updated,
        message: `Company import completed in ${duration}s: ${stats.successful} created, ${stats.updated} updated, ${stats.duplicates} duplicates, ${stats.errors} errors`,
        completedAt: new Date().toISOString()
      });

      console.log(`🏢 Company import completed in ${duration}s:`, stats);

    } catch (error) {
      console.error('Company CSV processing error:', error);
      
      await storage.updateImportJob(jobId, {
        status: 'failed',
        errors: [{ message: String(error) }],
        completedAt: new Date(),
      });

      // Broadcast error via WebSocket
      wsHub.broadcastError(jobId, error instanceof Error ? error.message : 'Processing failed', {
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
      });

      throw error;
    } finally {
      this.duplicateCache.clear();
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private broadcastProgress(jobId: string, stats: CompanyProcessingStats, totalRows: number): void {
    const now = Date.now();
    if (now - this.lastProgressBroadcast < this.progressBroadcastInterval) {
      return;
    }
    this.lastProgressBroadcast = now;

    const percent = totalRows > 0 ? Math.round((stats.processed / totalRows) * 100) : 0;
    
    wsHub.broadcast(jobId, {
      status: 'processing',
      totalRows,
      processedRows: stats.processed,
      successfulRows: stats.successful,
      errorRows: stats.errors,
      duplicateRows: stats.duplicates,
      updatedRows: stats.updated,
      message: `Processing companies... ${percent}% complete (${stats.processed}/${totalRows})`
    });
  }

  private async processBatchOptimized(
    batch: any[],
    options: CompanyProcessingOptions
  ): Promise<CompanyProcessingStats> {
    const stats: CompanyProcessingStats = {
      processed: 0,
      successful: 0,
      errors: 0,
      duplicates: 0,
      updated: 0
    };

    const toInsert: Partial<InsertCompany>[] = [];
    const toUpdate: Array<{ id: string; data: Partial<InsertCompany> }> = [];

    for (const record of batch) {
      stats.processed++;
      
      try {
        const transformedRecord = this.transformRecord(record, options.fieldMapping);
        
        if (!transformedRecord.name) {
          stats.errors++;
          this.errorAccumulator.push({
            row: stats.processed,
            error: 'Company name is required',
            data: record
          });
          continue;
        }

        const isDuplicate = this.checkDuplicateInCache(transformedRecord);
        
        if (isDuplicate) {
          if (options.updateExisting) {
            toUpdate.push({ id: isDuplicate.id, data: transformedRecord });
            stats.updated++;
          } else {
            stats.duplicates++;
          }
        } else {
          toInsert.push(transformedRecord);
          this.addToCache(transformedRecord);
        }
      } catch (error: any) {
        stats.errors++;
        this.errorAccumulator.push({
          row: stats.processed,
          error: error.message,
          data: record
        });
      }
    }

    if (toInsert.length > 0) {
      try {
        const result = await storage.bulkInsertCompaniesOptimized(toInsert as InsertCompany[]);
        stats.successful += result.inserted;
      } catch (error: any) {
        // Fallback to individual inserts
        for (const company of toInsert) {
          try {
            await storage.createCompany(company as InsertCompany);
            stats.successful++;
          } catch {
            stats.errors++;
          }
        }
      }
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ id, data }) => 
          storage.updateCompany(id, data).catch(() => {})
        )
      );
    }

    return stats;
  }

  private checkDuplicateInCache(record: Partial<InsertCompany>): { id: string } | null {
    if (record.domains && record.domains.length > 0) {
      for (const domain of record.domains) {
        const cached = this.duplicateCache.get(domain.toLowerCase());
        if (cached) {
          return { id: cached.id };
        }
      }
    }
    
    if (record.name) {
      const normalizedName = record.name.toLowerCase().trim();
      const cached = this.duplicateCache.get(`name:${normalizedName}`);
      if (cached) {
        return { id: cached.id };
      }
    }
    
    return null;
  }

  private addToCache(record: Partial<InsertCompany>): void {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    if (record.domains && record.domains.length > 0) {
      for (const domain of record.domains) {
        this.duplicateCache.set(domain.toLowerCase(), { id: tempId });
      }
    }
    if (record.name) {
      this.duplicateCache.set(`name:${record.name.toLowerCase().trim()}`, { id: tempId });
    }
  }

  private transformRecord(record: any, fieldMapping: Record<string, string>): Partial<InsertCompany> {
    const transformed: any = {};

    for (const [csvHeader, dbField] of Object.entries(fieldMapping)) {
      const value = record[csvHeader];
      if (value !== undefined && value !== null && value !== '') {
        switch (dbField) {
          case 'employees':
          case 'retailLocations':
          case 'foundedYear':
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              transformed[dbField] = numValue;
            }
            break;
          default:
            transformed[dbField] = String(value).trim();
        }
      }
    }

    if (transformed.website) {
      const domain = this.extractDomain(transformed.website);
      if (domain) {
        transformed.domains = [domain];
      }
    }

    return transformed;
  }

  private extractDomain(url: string): string | null {
    try {
      let cleanUrl = url.trim().toLowerCase();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      const urlObj = new URL(cleanUrl);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }

  private async preloadDuplicateCache(): Promise<void> {
    this.duplicateCache.clear();
    const { companies } = await storage.getCompanies({ limit: 10000 });
    
    for (const company of companies) {
      if (company.domains) {
        for (const domain of company.domains) {
          this.duplicateCache.set(domain, company);
        }
      }
      if (company.name) {
        this.duplicateCache.set(`name:${company.name.toLowerCase().trim()}`, company);
      }
    }
  }

  private async countCSVRows(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', () => count++)
        .on('end', () => resolve(count + 1))
        .on('error', reject);
    });
  }

  async getAutoMapping(headers: string[]): Promise<{
    mapping: Record<string, string>;
    confidence: Record<string, number>;
    suggestions: Record<string, Array<{ field: string; confidence: number }>>;
  }> {
    const mapping = companyFieldMapper.mapHeaders(headers);
    const confidence = companyFieldMapper.getMappingConfidence(headers, mapping);
    const suggestions: Record<string, Array<{ field: string; confidence: number }>> = {};
    
    for (const header of headers) {
      suggestions[header] = companyFieldMapper.suggestAlternatives(header, mapping[header]);
    }
    
    return { mapping, confidence, suggestions };
  }

  getAvailableFields(): Array<{ value: string; label: string; category: string }> {
    return companyFieldMapper.getAvailableFields();
  }
}

export const companyCSVProcessor = new CompanyCSVProcessor();
