/**
 * High-Performance Streaming CSV Parser
 * Optimized for large file processing with memory efficiency
 */

import Papa from 'papaparse';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface StreamingCSVOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  header?: boolean;
  dynamicTyping?: boolean;
  encoding?: BufferEncoding;
  chunkSize?: number;
}

export interface CSVParseResult {
  headers: string[];
  totalRows: number;
  preview: Record<string, any>[];
}

export class StreamingCSVParser {
  
  /**
   * Parse CSV file with streaming for memory efficiency
   */
  static async parseFileStream(
    filePath: string,
    options: StreamingCSVOptions = {}
  ): Promise<AsyncIterableIterator<Record<string, any>>> {
    const {
      delimiter = ',',
      skipEmptyLines = true,
      header = true,
      dynamicTyping = true,
      encoding = 'utf8',
      chunkSize = 1024 * 1024 // 1MB chunks
    } = options;

    const fileStream = fs.createReadStream(filePath, { encoding });
    
    return this.parseStream(fileStream, {
      delimiter,
      skipEmptyLines,
      header,
      dynamicTyping,
      chunkSize
    });
  }

  /**
   * Parse CSV stream with Papa Parse streaming
   */
  static async *parseStream(
    stream: Readable,
    options: StreamingCSVOptions = {}
  ): AsyncIterableIterator<Record<string, any>> {
    const {
      delimiter = ',',
      skipEmptyLines = true,
      header = true,
      dynamicTyping = true,
      chunkSize = 1024 * 1024
    } = options;

    return new Promise<AsyncIterableIterator<Record<string, any>>>((resolve, reject) => {
      const results: Record<string, any>[] = [];
      let headers: string[] = [];
      let isFirstChunk = true;

      Papa.parse(stream, {
        delimiter,
        header,
        skipEmptyLines,
        dynamicTyping,
        chunkSize,
        
        step: (result: Papa.ParseStepResult<any>) => {
          if (result.errors && result.errors.length > 0) {
            console.warn('CSV parsing warnings:', result.errors);
          }

          if (result.data) {
            if (isFirstChunk && header) {
              headers = Object.keys(result.data);
              isFirstChunk = false;
            }
            results.push(result.data);
          }
        },

        complete: () => {
          async function* generator(): AsyncIterableIterator<Record<string, any>> {
            for (const row of results) {
              yield row;
            }
          }
          resolve(generator());
        },

        error: (error: Error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }

  /**
   * Quick file analysis for headers and preview
   */
  static async analyzeCSVFile(filePath: string): Promise<CSVParseResult> {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let headers: string[] = [];
      const preview: Record<string, any>[] = [];
      let totalRows = 0;
      let previewCount = 0;

      Papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        
        step: (result: Papa.ParseStepResult<any>) => {
          if (result.data) {
            totalRows++;
            
            // Capture headers from first row
            if (headers.length === 0) {
              headers = Object.keys(result.data);
            }
            
            // Collect preview data (first 5 rows)
            if (previewCount < 5) {
              preview.push(result.data);
              previewCount++;
            }
          }
        },

        complete: () => {
          resolve({
            headers,
            totalRows,
            preview
          });
        },

        error: (error: Error) => {
          reject(new Error(`CSV analysis failed: ${error.message}`));
        }
      });
    });
  }

  /**
   * Validate CSV file structure and detect issues
   */
  static async validateCSVStructure(filePath: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const analysis = await this.analyzeCSVFile(filePath);
      
      // Check for empty file
      if (analysis.totalRows === 0) {
        issues.push('File appears to be empty');
        return { isValid: false, issues, recommendations };
      }

      // Check for missing headers
      if (analysis.headers.length === 0) {
        issues.push('No headers detected');
        recommendations.push('Ensure first row contains column headers');
      }

      // Check for duplicate headers - Papa Parse automatically renames duplicates
      // so we only warn if there are truly problematic duplicates
      const duplicatePattern = /__\d+$/; // Papa Parse adds __1, __2, etc. to duplicates
      const renamedHeaders = analysis.headers.filter(h => duplicatePattern.test(h));
      if (renamedHeaders.length > 0) {
        console.log('Duplicate headers found and renamed.', renamedHeaders.map(h => h.replace(duplicatePattern, '')));
        recommendations.push(`${renamedHeaders.length} duplicate column headers were automatically renamed`);
      }

      // Check for empty headers
      const emptyHeaders = analysis.headers.filter(h => !h || h.trim() === '');
      if (emptyHeaders.length > 0) {
        issues.push(`${emptyHeaders.length} empty column headers found`);
        recommendations.push('Add names to all columns or remove empty columns');
      }

      // Check data consistency in preview
      if (analysis.preview.length > 0) {
        const firstRowKeys = Object.keys(analysis.preview[0]);
        const inconsistentRows = analysis.preview.filter(row => 
          Object.keys(row).length !== firstRowKeys.length
        );
        
        if (inconsistentRows.length > 0) {
          issues.push('Inconsistent number of columns detected');
          recommendations.push('Ensure all rows have the same number of columns');
        }
      }

      // Performance recommendations
      if (analysis.totalRows > 50000) {
        recommendations.push('Large file detected - processing may take several minutes');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [`File parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Ensure file is a valid CSV format']
      };
    }
  }

  /**
   * Smart CSV delimiter detection
   */
  static async detectDelimiter(filePath: string): Promise<string> {
    const sampleSize = 1024; // Read first 1KB
    const buffer = Buffer.alloc(sampleSize);
    
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
    fs.closeSync(fd);
    
    const sample = buffer.toString('utf8', 0, bytesRead);
    
    // Count potential delimiters
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (sample.match(new RegExp('\\' + delimiter, 'g')) || []).length
    }));
    
    // Return delimiter with highest count
    const bestDelimiter = counts.reduce((max, current) => 
      current.count > max.count ? current : max
    );
    
    return bestDelimiter.delimiter;
  }

  /**
   * Estimate processing time based on file size
   */
  static estimateProcessingTime(filePath: string): number {
    const stats = fs.statSync(filePath);
    const fileSizeKB = stats.size / 1024;
    
    // Rough estimate: 1KB per 0.1 seconds (optimistic)
    // Add overhead for enrichment and database operations
    const baseTime = fileSizeKB * 0.1;
    const enrichmentOverhead = baseTime * 0.5;
    const databaseOverhead = baseTime * 0.3;
    
    return Math.ceil(baseTime + enrichmentOverhead + databaseOverhead);
  }
}