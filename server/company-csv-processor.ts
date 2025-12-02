/**
 * Company CSV Processing Engine
 * Handles CSV parsing, field mapping, and bulk import of companies
 */

import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import csv from 'csv-parser';
import { storage } from './storage';
import { companyFieldMapper } from './nlp-mapper';
import { type InsertCompany } from '@shared/schema';

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
  private progressUpdateInterval = 500;

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

    try {
      await this.preloadDuplicateCache();

      const totalRows = await this.countCSVRows(filePath);
      
      await storage.updateImportJob(jobId, {
        status: 'processing',
        totalRows: totalRows - 1,
        processedRows: 0,
      });

      const batches: any[][] = [];
      let currentBatch: any[] = [];

      const batchProcessor = new Transform({
        objectMode: true,
        transform: (record: any, encoding, callback) => {
          currentBatch.push(record);
          
          if (currentBatch.length >= this.batchSize) {
            batches.push([...currentBatch]);
            currentBatch = [];
          }
          
          callback();
        },
        flush: (callback) => {
          if (currentBatch.length > 0) {
            batches.push([...currentBatch]);
          }
          callback();
        }
      });

      await pipelineAsync(
        fs.createReadStream(filePath),
        csv(),
        batchProcessor
      );

      let lastProgressUpdate = Date.now();
      
      for (const batch of batches) {
        const batchResults = await this.processBatchOptimized(batch, options);
        stats.processed += batchResults.processed;
        stats.successful += batchResults.successful;
        stats.errors += batchResults.errors;
        stats.duplicates += batchResults.duplicates;
        stats.updated += batchResults.updated;

        const now = Date.now();
        if (now - lastProgressUpdate >= this.progressUpdateInterval) {
          await storage.updateImportJob(jobId, {
            processedRows: stats.processed,
            successfulRows: stats.successful,
            errorRows: stats.errors,
            duplicateRows: stats.duplicates,
          });
          lastProgressUpdate = now;
        }
      }

      await storage.updateImportJob(jobId, {
        status: 'completed',
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
        completedAt: new Date(),
        errors: this.errorAccumulator.length > 0 ? this.errorAccumulator : null,
      });

      console.log(`🏢 Company import completed:`, stats);
    } catch (error) {
      console.error('Company CSV processing error:', error);
      await storage.updateImportJob(jobId, {
        status: 'failed',
        errors: [{ message: String(error) }],
      });
      throw error;
    }
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
            stats.successful++;
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
        const insertedCount = await this.bulkInsertCompanies(toInsert);
        stats.successful += insertedCount;
      } catch (error: any) {
        stats.errors += toInsert.length;
        console.error('Bulk insert error:', error);
      }
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ id, data }) => 
          this.updateExistingCompany(id, data).catch(() => {})
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

  private async bulkInsertCompanies(companies: Partial<InsertCompany>[]): Promise<number> {
    if (companies.length === 0) return 0;

    try {
      const result = await storage.bulkInsertCompaniesOptimized(companies as InsertCompany[]);
      return result.inserted;
    } catch (error) {
      console.error('Bulk insert failed, falling back to individual inserts:', error);
      let inserted = 0;
      for (const company of companies) {
        try {
          await storage.createCompany(company as InsertCompany);
          inserted++;
        } catch {
        }
      }
      return inserted;
    }
  }

  private async processBatch(
    batch: any[],
    options: CompanyProcessingOptions
  ): Promise<CompanyProcessingStats> {
    return this.processBatchOptimized(batch, options);
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

  private async checkDuplicate(record: Partial<InsertCompany>): Promise<{ id: string } | null> {
    if (record.domains && record.domains.length > 0) {
      for (const domain of record.domains) {
        const cached = this.duplicateCache.get(domain);
        if (cached) {
          return { id: cached.id };
        }
        
        const existing = await storage.getCompanyByDomain(domain);
        if (existing) {
          this.duplicateCache.set(domain, existing);
          return { id: existing.id };
        }
      }
    }
    
    if (record.name) {
      const normalizedName = record.name.toLowerCase().trim();
      const cached = this.duplicateCache.get(`name:${normalizedName}`);
      if (cached) {
        return { id: cached.id };
      }
      
      const existing = await storage.getCompanyByName(record.name);
      if (existing) {
        this.duplicateCache.set(`name:${normalizedName}`, existing);
        return { id: existing.id };
      }
    }
    
    return null;
  }

  private async insertCompany(record: Partial<InsertCompany>): Promise<void> {
    const company = await storage.createCompany(record as InsertCompany);
    
    if (record.domains && record.domains.length > 0) {
      for (const domain of record.domains) {
        this.duplicateCache.set(domain, company);
      }
    }
    if (record.name) {
      this.duplicateCache.set(`name:${record.name.toLowerCase().trim()}`, company);
    }
  }

  private async updateExistingCompany(id: string, record: Partial<InsertCompany>): Promise<void> {
    await storage.updateCompany(id, record);
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
    
    console.log(`📦 Preloaded ${companies.length} companies into duplicate cache`);
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
