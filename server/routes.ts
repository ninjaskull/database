import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactSchema, insertImportJobSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { enrichContactData } from "../client/src/lib/data-enrichment.js";

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
        const duplicates = await storage.findDuplicateContacts(validatedData.email, validatedData.company);
        if (duplicates.length > 0) {
          return res.status(409).json({ 
            message: "Duplicate contact found",
            duplicates 
          });
        }
      }
      
      // Enrich data
      const enrichedData = await enrichContactData(validatedData);
      
      const contact = await storage.createContact(enrichedData);
      
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

  // CSV Import
  app.post("/api/import", upload.single('csv'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const job = await storage.createImportJob({
        filename: req.file.originalname || 'unknown.csv',
        status: 'processing',
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        errorRows: 0,
        duplicateRows: 0,
        fieldMapping: req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : null,
        errors: null,
      });

      // Process CSV file asynchronously
      processCSVFile(req.file.path, job.id, req.body);

      res.status(202).json({ jobId: job.id, message: "Import started" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start import" });
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

async function processCSVFile(filePath: string, jobId: string, options: any) {
  const fs = await import('fs');
  
  try {
    // Read CSV file
    const csvText = fs.readFileSync(filePath, 'utf8');
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }
    
    // Parse headers
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const dataRows = lines.slice(1);
    
    await storage.updateImportJob(jobId, {
      status: 'processing',
      totalRows: dataRows.length,
    });
    
    const fieldMapping = JSON.parse(options.fieldMapping || '{}');
    let processed = 0;
    let successful = 0;
    let errors = 0;
    let duplicates = 0;
    
    // Process each row
    for (const line of dataRows) {
      try {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const contactData: any = {};
        
        // Map CSV fields to database fields
        headers.forEach((header, index) => {
          const dbField = fieldMapping[header];
          if (dbField && values[index]) {
            contactData[dbField] = values[index];
          }
        });
        
        if (contactData.email) {
          // Check for duplicates
          const duplicateContacts = await storage.findDuplicateContacts(contactData.email, contactData.company);
          if (duplicateContacts.length > 0) {
            duplicates++;
            processed++;
            continue;
          }
        }
        
        // Ensure required fields
        if (!contactData.fullName && !contactData.firstName && !contactData.lastName) {
          errors++;
          processed++;
          continue;
        }
        
        // Set fullName if not provided
        if (!contactData.fullName && (contactData.firstName || contactData.lastName)) {
          contactData.fullName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
        }
        
        // Enrich and create contact
        const enrichedData = await enrichContactData(contactData);
        const newContact = await storage.createContact(enrichedData);
        console.log(`Created contact: ${newContact.fullName}`);
        successful++;
        
      } catch (error) {
        errors++;
      }
      processed++;
      
      // Update progress every 10 rows
      if (processed % 10 === 0) {
        await storage.updateImportJob(jobId, {
          processedRows: processed,
          successfulRows: successful,
          errorRows: errors,
          duplicateRows: duplicates,
        });
      }
    }
    
    // Final update
    await storage.updateImportJob(jobId, {
      status: 'completed',
      processedRows: processed,
      successfulRows: successful,
      errorRows: errors,
      duplicateRows: duplicates,
      completedAt: new Date(),
    });
    
    // Clean up temp file
    fs.unlinkSync(filePath);
    
  } catch (error) {
    await storage.updateImportJob(jobId, {
      status: 'failed',
      errors: { message: error instanceof Error ? error.message : 'Processing failed' },
      completedAt: new Date(),
    });
  }
}
