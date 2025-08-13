import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertImportJobSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { enrichContactData } from "../client/src/lib/data-enrichment";
import { csvFieldMapper } from "./nlp-mapper";
import { StreamingCSVParser } from "./streaming-csv-parser";
import { advancedCSVProcessor } from "./csv-processor";

const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get contacts with pagination and filtering
  app.get("/api/contacts", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const industry = req.query.industry as string || '';
      const employeeSizeBracket = req.query.employeeSizeBracket as string || '';
      const country = req.query.country as string || '';
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';
      
      const result = await storage.getContacts({
        page,
        limit,
        search,
        industry,
        employeeSizeBracket,
        country,
        sortBy,
        sortOrder
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Get single contact
  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id!);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  // Create contact
  app.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      
      // Check for duplicates
      if (validatedData.email) {
        const duplicates = await storage.findDuplicateContacts(validatedData.email, validatedData.company || undefined);
        if (duplicates.length > 0) {
          return res.status(409).json({ 
            message: "Duplicate contact found",
            duplicates 
          });
        }
      }
      
      // Enrich data
      const enrichedData = await enrichContactData(validatedData);
      
      // Ensure fullName is provided
      const fullName = enrichedData.fullName || `${enrichedData.firstName || ''} ${enrichedData.lastName || ''}`.trim() || 'Unknown';
      
      const contact = await storage.createContact({
        ...enrichedData,
        fullName
      });
      
      // Log enrichment activity
      await storage.createContactActivity({
        contactId: contact.id,
        activityType: 'enriched',
        description: 'Contact data automatically enriched',
      });
      
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Update contact
  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const updates = insertContactSchema.partial().parse(req.body);
      
      // Enrich updated data
      const enrichedUpdates = await enrichContactData(updates);
      
      const contact = await storage.updateContact(req.params.id!, enrichedUpdates);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Bulk delete contacts
  app.delete("/api/contacts", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      
      const deletedCount = await storage.bulkDeleteContacts(ids);
      res.json({ deletedCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contacts" });
    }
  });

  // Get contact stats  
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getContactStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get contact activities
  app.get("/api/contacts/:id/activities", async (req, res) => {
    try {
      const activities = await storage.getContactActivities(req.params.id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Ultra-fast auto-map CSV headers using advanced streaming parser and NLP
  app.post("/api/import/auto-map", upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate CSV structure first
      const validation = await StreamingCSVParser.validateCSVStructure(req.file.path);
      if (!validation.isValid) {
        return res.status(400).json({ 
          message: "Invalid CSV file structure",
          issues: validation.issues,
          recommendations: validation.recommendations
        });
      }

      // Fast CSV analysis with streaming parser
      const analysis = await StreamingCSVParser.analyzeCSVFile(req.file.path);
      
      // Auto-detect optimal delimiter
      const delimiter = await StreamingCSVParser.detectDelimiter(req.file.path);
      
      // Use advanced NLP model to automatically map fields
      const autoMapping = csvFieldMapper.mapHeaders(analysis.headers);
      const confidence = csvFieldMapper.getMappingConfidence(analysis.headers, autoMapping);
      
      // Get intelligent suggestions for low-confidence mappings
      const suggestions: Record<string, Array<{ field: string; confidence: number }>> = {};
      for (const header of analysis.headers) {
        if (!autoMapping[header] || confidence[header] < 0.7) {
          suggestions[header] = csvFieldMapper.suggestAlternatives(header, autoMapping[header]);
        }
      }

      // Estimate processing time for user feedback
      const estimatedTime = StreamingCSVParser.estimateProcessingTime(req.file.path);

      // Store file for later import with improved naming
      const fs = await import('fs');
      const tempFileName = `${Date.now()}_${Buffer.from(req.file.originalname).toString('hex')}.csv`;
      const tempPath = `uploads/${tempFileName}`;
      fs.renameSync(req.file.path, tempPath);

      res.json({
        headers: analysis.headers,
        autoMapping,
        confidence,
        suggestions,
        preview: analysis.preview,
        totalRows: analysis.totalRows,
        tempFile: tempFileName,
        delimiter,
        estimatedProcessingTime: estimatedTime,
        validation: {
          isValid: validation.isValid,
          recommendations: validation.recommendations
        }
      });
    } catch (error) {
      console.error('Advanced auto-mapping error:', error);
      res.status(500).json({ 
        message: "Failed to analyze CSV file",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Ultra-fast CSV Import with advanced processing
  app.post("/api/import", upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Parse import options with defaults
      const options = {
        skipDuplicates: req.body.options ? JSON.parse(req.body.options).skipDuplicates : true,
        updateExisting: req.body.options ? JSON.parse(req.body.options).updateExisting : true,
        autoEnrich: req.body.options ? JSON.parse(req.body.options).autoEnrich : true,
        batchSize: 100, // Optimized batch size
        fieldMapping: req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {}
      };

      // Create import job with enhanced metadata
      const job = await storage.createImportJob({
        filename: req.file.originalname || 'unknown.csv',
        status: 'processing',
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        errorRows: 0,
        duplicateRows: 0,
        fieldMapping: options.fieldMapping,
        errors: null,
      });

      // Use advanced CSV processor with streaming and parallel processing
      advancedCSVProcessor.processCSVAdvanced(req.file.path, job.id, options)
        .catch((error) => {
          console.error('Advanced CSV processing failed:', error);
        });

      res.status(202).json({ 
        jobId: job.id, 
        message: "Ultra-fast import started - processing with streaming, batching, and parallel operations",
        estimatedTime: StreamingCSVParser.estimateProcessingTime(req.file.path)
      });
    } catch (error) {
      console.error('Import initialization failed:', error);
      res.status(500).json({ 
        message: "Failed to start import",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get import job status
  app.get("/api/import/:jobId", async (req, res) => {
    try {
      const job = await storage.getImportJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Import job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch import job" });
    }
  });

  // Export contacts
  app.get("/api/export", async (req, res) => {
    try {
      const { contacts: contactsList } = await storage.getContacts({ limit: 10000 });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      
      // Create CSV header
      const headers = [
        'Full Name', 'First Name', 'Last Name', 'Title', 'Company', 'Email',
        'Mobile Phone', 'Other Phone', 'Home Phone', 'Corporate Phone',
        'Employees', 'Employee Size Bracket', 'Industry', 'Person LinkedIn',
        'Website', 'Company LinkedIn', 'City', 'State', 'Country',
        'Company Address', 'Company City', 'Company State', 'Company Country',
        'Technologies', 'Annual Revenue', 'Lead Score', 'Created At'
      ];
      
      let csv = headers.join(',') + '\n';
      
      for (const contact of contactsList) {
        const row = [
          contact.fullName || '',
          contact.firstName || '',
          contact.lastName || '',
          contact.title || '',
          contact.company || '',
          contact.email || '',
          contact.mobilePhone || '',
          contact.otherPhone || '',
          contact.homePhone || '',
          contact.corporatePhone || '',
          contact.employees || '',
          contact.employeeSizeBracket || '',
          contact.industry || '',
          contact.personLinkedIn || '',
          contact.website || '',
          contact.companyLinkedIn || '',
          contact.city || '',
          contact.state || '',
          contact.country || '',
          contact.companyAddress || '',
          contact.companyCity || '',
          contact.companyState || '',
          contact.companyCountry || '',
          contact.technologies?.join('; ') || '',
          contact.annualRevenue || '',
          contact.leadScore || '',
          contact.createdAt?.toISOString() || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`);
        
        csv += row.join(',') + '\n';
      }
      
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export contacts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Legacy processCSVFile function removed - replaced with AdvancedCSVProcessor
// which provides streaming, batching, parallel processing, and memory optimization
