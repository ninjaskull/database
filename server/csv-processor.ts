/**
 * Ultra-Fast CSV Processing Engine
 * Features: True Streaming, Bulk Operations, Smart Batching, WebSocket Progress Broadcasting
 */

import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import csv from 'csv-parser';
import { storage } from './storage';
import { enrichContactData } from '../client/src/lib/data-enrichment';
import { csvFieldMapper } from './nlp-mapper';
import { insertContactSchema, type InsertContact, type InsertContactActivity } from '@shared/schema';
import { wsHub } from './ws-hub';

const pipelineAsync = promisify(pipeline);

interface ProcessingStats {
  processed: number;
  successful: number;
  errors: number;
  duplicates: number;
  updated: number;
}

interface ProcessingOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  autoEnrich: boolean;
  batchSize: number;
  fieldMapping: Record<string, string>;
}

interface ContactBatch {
  contacts: any[];
  duplicates: Map<string, any[]>;
  updates: Map<string, any>;
}

export class AdvancedCSVProcessor {
  private batchSize = 500; // Optimized batch size for performance
  private duplicateCache = new Map<string, any>();
  private errorAccumulator: any[] = [];
  private lastProgressBroadcast = 0;
  private progressBroadcastInterval = 100; // Broadcast every 100ms max

  /**
   * Process CSV file with true streaming - processes batches on the fly
   */
  async processCSVAdvanced(
    filePath: string,
    jobId: string,
    options: ProcessingOptions
  ): Promise<void> {
    const stats: ProcessingStats = {
      processed: 0,
      successful: 0,
      errors: 0,
      duplicates: 0,
      updated: 0
    };

    const startTime = Date.now();
    this.errorAccumulator = [];

    try {
      // Pre-load duplicate detection cache for performance
      await this.preloadDuplicateCache();

      // Get total rows for progress tracking
      const totalRows = await this.countCSVRows(filePath);
      
      await storage.updateImportJob(jobId, {
        status: 'processing',
        totalRows: totalRows - 1, // Exclude header
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
        message: 'Starting import...'
      }, true);

      // True streaming: process batches on the fly without accumulating in memory
      let currentBatch: any[] = [];
      let batchIndex = 0;
      let lastDbUpdate = Date.now();
      const dbUpdateInterval = 2000; // Update DB every 2 seconds

      const streamProcessor = new Transform({
        objectMode: true,
        transform: async (record: any, encoding, callback) => {
          currentBatch.push(record);
          
          if (currentBatch.length >= this.batchSize) {
            try {
              // Process batch immediately instead of accumulating
              const batchResult = await this.processBatchOptimized([...currentBatch], options);
              
              stats.processed += batchResult.processed;
              stats.successful += batchResult.successful;
              stats.errors += batchResult.errors;
              stats.duplicates += batchResult.duplicates;
              stats.updated += batchResult.updated;

              // Broadcast progress via WebSocket
              this.broadcastProgress(jobId, stats, totalRows - 1, false);

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

              batchIndex++;
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
          // Process remaining records in the last batch
          if (currentBatch.length > 0) {
            try {
              const batchResult = await this.processBatchOptimized([...currentBatch], options);
              
              stats.processed += batchResult.processed;
              stats.successful += batchResult.successful;
              stats.errors += batchResult.errors;
              stats.duplicates += batchResult.duplicates;
              stats.updated += batchResult.updated;
            } catch (error) {
              console.error('Final batch processing error:', error);
              stats.errors += currentBatch.length;
            }
          }
          callback();
        }
      });

      // Stream processing pipeline
      await pipelineAsync(
        fs.createReadStream(filePath, { encoding: 'utf8' }),
        csv(),
        streamProcessor
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Final status update
      await storage.updateImportJob(jobId, {
        status: 'completed',
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
        completedAt: new Date(),
        errors: this.errorAccumulator.length > 0 ? {
          summary: `${this.errorAccumulator.length} validation/processing errors`,
          details: this.errorAccumulator.slice(0, 100)
        } : null
      });

      // Broadcast completion via WebSocket
      wsHub.broadcastComplete(jobId, {
        totalRows: totalRows - 1,
        processedRows: stats.processed,
        successfulRows: stats.successful,
        errorRows: stats.errors,
        duplicateRows: stats.duplicates,
        updatedRows: stats.updated,
        message: `Import completed in ${duration}s: ${stats.successful} created, ${stats.updated} updated, ${stats.duplicates} duplicates, ${stats.errors} errors`,
        completedAt: new Date().toISOString()
      });

      console.log(`✅ Import completed in ${duration}s: ${stats.successful} created, ${stats.updated} updated, ${stats.duplicates} duplicates, ${stats.errors} errors`);

    } catch (error) {
      console.error('CSV Processing Error:', error);
      
      await storage.updateImportJob(jobId, {
        status: 'failed',
        errors: { 
          message: error instanceof Error ? error.message : 'Processing failed',
          details: this.errorAccumulator.slice(0, 50)
        },
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
      // Cleanup
      this.duplicateCache.clear();
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Broadcast progress with throttling to avoid flooding WebSocket
   */
  private broadcastProgress(jobId: string, stats: ProcessingStats, totalRows: number, force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastProgressBroadcast < this.progressBroadcastInterval) {
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
      message: `Processing... ${percent}% complete (${stats.processed}/${totalRows})`
    });
  }

  /**
   * Process batch with optimized bulk database operations
   */
  private async processBatchOptimized(
    rawBatch: any[],
    options: ProcessingOptions
  ): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      processed: 0,
      successful: 0,
      errors: 0,
      duplicates: 0,
      updated: 0
    };

    try {
      // Transform and validate batch
      const validatedBatch = this.validateAndTransformBatch(rawBatch, options.fieldMapping);
      
      // Get all emails for duplicate check
      const emails = validatedBatch.map(c => c.email).filter((e): e is string => !!e);
      
      // Bulk duplicate detection
      const existingContacts = await storage.bulkFindDuplicatesByEmails(emails);
      
      // Categorize contacts
      const newContacts: InsertContact[] = [];
      const updates = new Map<string, Partial<InsertContact>>();
      
      for (const contact of validatedBatch) {
        const cacheKey = contact.email?.toLowerCase() || `${contact.fullName}:${contact.company}`;
        
        // Check cache first, then database results
        let existing = this.duplicateCache.get(cacheKey);
        if (!existing && contact.email) {
          existing = existingContacts.get(contact.email.toLowerCase());
        }

        if (existing) {
          if (options.updateExisting) {
            const updateData = this.extractUpdateData(contact, existing);
            if (Object.keys(updateData).length > 0) {
              updates.set(existing.id, updateData);
            } else {
              stats.duplicates++;
            }
          } else {
            stats.duplicates++;
          }
        } else {
          newContacts.push(contact);
          this.duplicateCache.set(cacheKey, contact);
        }
      }

      // Bulk insert new contacts
      if (newContacts.length > 0) {
        // Apply enrichment in parallel if enabled
        const contactsToInsert = options.autoEnrich
          ? await Promise.all(newContacts.map(c => enrichContactData(c)))
          : newContacts;

        try {
          const created = await storage.bulkInsertContactsOptimized(contactsToInsert);
          stats.successful += created.length;

          // Bulk create activities (fire and forget for speed)
          const activities: InsertContactActivity[] = created.map(c => ({
            contactId: c.id,
            activityType: 'created',
            description: 'Contact imported from CSV'
          }));
          storage.bulkCreateContactActivities(activities).catch(() => {});
        } catch (error) {
          // If bulk insert fails, it might be due to duplicate constraints
          // Fall back to individual inserts for this batch
          for (const contact of contactsToInsert) {
            try {
              await storage.createContactWithAutoFill(contact);
              stats.successful++;
            } catch (e) {
              stats.errors++;
              this.errorAccumulator.push({
                contact: contact.fullName || contact.email,
                error: e instanceof Error ? e.message : 'Creation failed'
              });
            }
          }
        }
      }

      // Bulk update existing contacts
      if (updates.size > 0) {
        const updatedCount = await storage.bulkUpdateContactsOptimized(updates);
        stats.updated += updatedCount;
      }

      stats.processed = rawBatch.length;

    } catch (error) {
      console.error('Batch processing error:', error);
      stats.errors = rawBatch.length;
      this.errorAccumulator.push({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return stats;
  }

  /**
   * Validate and transform batch with Zod schema - optimized for speed
   * Enhanced with enterprise-level data cleaning and validation
   */
  private validateAndTransformBatch(rawBatch: any[], fieldMapping: Record<string, string>): InsertContact[] {
    const validatedBatch: InsertContact[] = [];

    for (const rawRecord of rawBatch) {
      try {
        const contactData: any = {};

        // Apply field mapping with data normalization
        Object.entries(rawRecord).forEach(([csvHeader, value]) => {
          const dbField = fieldMapping[csvHeader];
          
          if (dbField && value !== null && value !== undefined && value.toString().trim() !== '') {
            // Handle special field types with enterprise-level normalization
            if (dbField === 'technologies') {
              contactData[dbField] = Array.isArray(value) 
                ? value 
                : value.toString().split(/[;,|]/).map((t: string) => t.trim()).filter(Boolean);
            } else if (dbField === 'employees') {
              const numValue = parseInt(value.toString().replace(/[^\d]/g, ''));
              if (!isNaN(numValue) && numValue > 0) contactData[dbField] = numValue;
            } else if (dbField === 'annualRevenue' || dbField === 'leadScore') {
              const cleanValue = value.toString().replace(/[^\d.-]/g, '');
              if (cleanValue && !isNaN(parseFloat(cleanValue))) {
                contactData[dbField] = cleanValue;
              }
            } else if (dbField === 'email') {
              // Enterprise email validation and normalization
              const email = value.toString().trim().toLowerCase();
              if (this.isValidEmail(email)) {
                contactData[dbField] = email;
              }
            } else if (dbField === 'mobilePhone' || dbField === 'otherPhone' || dbField === 'homePhone' || dbField === 'corporatePhone') {
              // Normalize phone numbers
              const phone = this.normalizePhoneNumber(value.toString());
              if (phone && this.isValidPhoneNumber(phone)) {
                contactData[dbField] = phone;
              }
            } else if (dbField === 'fullName' || dbField === 'firstName' || dbField === 'lastName') {
              // Clean and normalize names
              const cleanName = value.toString().trim().replace(/\s+/g, ' ');
              if (cleanName.length > 0) {
                contactData[dbField] = cleanName;
              }
            } else {
              // General text normalization
              const cleanValue = value.toString().trim().replace(/\s+/g, ' ');
              if (cleanValue.length > 0) {
                contactData[dbField] = cleanValue;
              }
            }
          }
        });

        // Lenient validation - require email OR name
        const hasName = contactData.fullName || contactData.firstName || contactData.lastName;
        const hasEmail = contactData.email;
        
        if (!hasName && !hasEmail) {
          this.errorAccumulator.push({
            row: rawRecord,
            error: 'Missing both name and email',
            severity: 'error'
          });
          continue;
        }

        // Generate fullName if missing
        if (!contactData.fullName && (contactData.firstName || contactData.lastName)) {
          const first = contactData.firstName?.trim() || '';
          const last = contactData.lastName?.trim() || '';
          contactData.fullName = [first, last].filter(Boolean).join(' ');
        }

        // Validate with Zod
        const validated = insertContactSchema.parse(contactData);
        validatedBatch.push(validated);

      } catch (error) {
        this.errorAccumulator.push({
          row: rawRecord,
          error: error instanceof Error ? error.message : 'Validation failed',
          severity: 'error'
        });
      }
    }

    return validatedBatch;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Normalize phone number (remove special chars, keep digits and +)
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[^\d+]/g, '').replace(/\s/g, '');
  }

  /**
   * Validate phone number (at least 10 digits)
   */
  private isValidPhoneNumber(phone: string): boolean {
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }

  /**
   * Pre-load duplicate cache for performance
   */
  private async preloadDuplicateCache(): Promise<void> {
    try {
      const { contacts } = await storage.getContacts({ limit: 10000, sortBy: 'createdAt' });
      
      for (const contact of contacts) {
        if (contact.email) {
          this.duplicateCache.set(contact.email.toLowerCase(), contact);
        }
        if (contact.fullName && contact.company) {
          const nameCompanyKey = `${contact.fullName}:${contact.company}`;
          this.duplicateCache.set(nameCompanyKey, contact);
        }
      }
    } catch (error) {
      console.error('Failed to preload duplicate cache:', error);
    }
  }

  /**
   * Count CSV rows efficiently
   */
  private async countCSVRows(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      fs.createReadStream(filePath)
        .on('data', (chunk) => {
          count += chunk.toString().split('\n').length - 1;
        })
        .on('end', () => resolve(count))
        .on('error', reject);
    });
  }

  /**
   * Extract update data from new contact vs existing
   */
  private extractUpdateData(newContact: any, existingContact: any): any {
    const updateData: any = {};
    
    Object.keys(newContact).forEach(key => {
      const newValue = newContact[key];
      const existingValue = existingContact[key];
      
      if (newValue && newValue !== '' && (!existingValue || existingValue === '')) {
        updateData[key] = newValue;
      }
    });

    return updateData;
  }
}

export const advancedCSVProcessor = new AdvancedCSVProcessor();
