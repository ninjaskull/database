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
import { insertCompanySchema, type InsertCompany } from '@shared/schema';
import { z } from 'zod';

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
  private batchSize = 100;
  private duplicateCache = new Map<string, any>();
  private errorAccumulator: any[] = [];

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

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, options);
        stats.processed += batchResults.processed;
        stats.successful += batchResults.successful;
        stats.errors += batchResults.errors;
        stats.duplicates += batchResults.duplicates;
        stats.updated += batchResults.updated;

        await storage.updateImportJob(jobId, {
          processedRows: stats.processed,
          successfulRows: stats.successful,
          errorRows: stats.errors,
          duplicateRows: stats.duplicates,
        });
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

  private async processBatch(
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

        const isDuplicate = await this.checkDuplicate(transformedRecord);
        
        if (isDuplicate) {
          if (options.updateExisting) {
            await this.updateExistingCompany(isDuplicate.id, transformedRecord);
            stats.updated++;
            stats.successful++;
          } else if (options.skipDuplicates) {
            stats.duplicates++;
          } else {
            stats.duplicates++;
          }
        } else {
          await this.insertCompany(transformedRecord);
          stats.successful++;
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

    return stats;
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
