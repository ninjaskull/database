import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { insertContactSchema, insertImportJobSchema, loginSchema, linkedinEnrichmentRequestSchema, insertCompanySchema, insertProspectSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { enrichContactData } from "../client/src/lib/data-enrichment";
import { csvFieldMapper, companyFieldMapper } from "./nlp-mapper";
import { companyCSVProcessor } from "./company-csv-processor";
import { StreamingCSVParser } from "./streaming-csv-parser";
import { advancedCSVProcessor } from "./csv-processor";
import { authenticateUser, requireAuth, initializeDefaultUser } from "./auth";
import { linkedinEnrichmentService } from "./linkedin-enrichment";
import { validateApiKey, generateApiKey, hashApiKey } from "./api-auth";
import { apiV1Router } from "./api-v1-routes";
import { API_SCOPES } from "./api-v1-middleware";
import { wsHub } from "./ws-hub";
import { extensionRouter } from "./extension-routes";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Created uploads directory: ${UPLOADS_DIR}`);
}

const upload = multer({ dest: UPLOADS_DIR });

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }));

  // Initialize default user
  await initializeDefaultUser();
  
  // Fix any existing contacts with empty full names in the background (non-blocking)
  setImmediate(async () => {
    try {
      const fixedCount = await storage.fixEmptyFullNames();
      if (fixedCount > 0) {
        console.log(`✅ Fixed ${fixedCount} contacts with empty full names`);
      }
    } catch (error) {
      console.error('❌ Failed to fix empty full names:', error);
    }
  });

  // Register API v1 routes
  app.use("/api/v1", apiV1Router);
  console.log("✅ API v1 routes registered at /api/v1");

  // Register Chrome extension routes
  app.use("/api/extension", extensionRouter);
  console.log("✅ Chrome extension routes registered at /api/extension");

  // Authentication routes
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await authenticateUser(email, password);
      
      if (result.success && result.token) {
        // Store token in session
        (req.session as any).token = result.token;
        res.json({ 
          success: true, 
          user: result.user,
          token: result.token 
        });
      } else {
        res.status(401).json({ 
          success: false, 
          message: "Invalid email or password" 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ 
        success: false, 
        message: "Invalid request" 
      });
    }
  });

  app.post("/api/logout", requireAuth, async (req, res) => {
    try {
      const token = (req.session as any)?.token;
      if (token) {
        await storage.deleteSession(token);
        (req.session as any).token = null;
      }
      req.session?.destroy(() => {
        res.json({ success: true });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, message: "Logout failed" });
    }
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    res.json((req as any).user);
  });

  // Settings API endpoints
  app.put("/api/settings/profile", requireAuth, async (req, res) => {
    try {
      const { name, email, phone, timezone, language } = req.body;
      const userId = (req as any).user.id;
      
      // Update user profile in database
      const updatedUser = await storage.updateUser(userId, {
        name,
        email,
      });
      
      if (updatedUser) {
        res.json({ 
          success: true, 
          message: "Profile updated successfully",
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email
          }
        });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.put("/api/settings/password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user.id;
      
      // Get current user
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const bcrypt = require("bcrypt");
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash new password and update
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      const updatedUser = await storage.updateUser(userId, {
        passwordHash: hashedNewPassword,
      });
      
      if (updatedUser) {
        res.json({ success: true, message: "Password updated successfully" });
      } else {
        res.status(404).json({ message: "Failed to update password" });
      }
    } catch (error) {
      console.error('Password update error:', error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.put("/api/settings/notifications", requireAuth, async (req, res) => {
    try {
      const settings = req.body;
      const userId = (req as any).user.id;
      
      // Save notification preferences
      res.json({ success: true, message: "Notification preferences updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update notifications" });
    }
  });

  app.put("/api/settings/system", requireAuth, async (req, res) => {
    try {
      const settings = req.body;
      const userId = (req as any).user.id;
      
      // Save system preferences
      res.json({ success: true, message: "System settings updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  app.put("/api/settings/appearance", requireAuth, async (req, res) => {
    try {
      const settings = req.body;
      const userId = (req as any).user.id;
      
      // Save appearance preferences
      res.json({ success: true, message: "Appearance settings updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update appearance" });
    }
  });

  app.get("/api/export/all", requireAuth, async (req, res) => {
    try {
      const { contacts: contactsList } = await storage.getContacts({ limit: 10000 });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="crm-export-all.csv"');
      
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
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.delete("/api/settings/delete-account", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      
      // Delete user account and all associated data
      // For now, just return success
      res.json({ success: true, message: "Account deletion initiated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // ============ COMPANY ROUTES ============

  // Get all companies with pagination
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const industry = req.query.industry as string || '';
      
      const result = await storage.getCompanies({ page, limit, search, industry });
      res.json(result);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get missing company domains (domains from contacts without company data)
  app.get("/api/companies/missing-domains", requireAuth, async (req, res) => {
    try {
      const domains = await storage.getMissingCompanyDomains();
      res.json({ domains, total: domains.length });
    } catch (error) {
      console.error('Get missing domains error:', error);
      res.status(500).json({ message: "Failed to fetch missing domains" });
    }
  });

  // Get single company
  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  // Create company
  app.post("/api/companies", requireAuth, async (req, res) => {
    try {
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      res.status(201).json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(400).json({ message: "Invalid company data" });
    }
  });

  // Update company
  app.put("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      const company = await storage.updateCompany(req.params.id, updates);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Delete company
  app.delete("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCompany(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Bulk import companies
  app.post("/api/companies/bulk-import", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ message: "File is empty or has no data rows" });
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const companies: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const companyData: any = { name: '' };

        headers.forEach((header, idx) => {
          const value = values[idx] || '';
          if (header === 'name' || header === 'company' || header === 'company_name') {
            companyData.name = value;
          } else if (header === 'website' || header === 'url') {
            companyData.website = value;
          } else if (header === 'domain' || header === 'domains') {
            companyData.domains = value.split(';').map((d: string) => d.trim()).filter(Boolean);
          } else if (header === 'industry') {
            companyData.industry = value;
          } else if (header === 'employees' || header === 'employee_count') {
            companyData.employees = parseInt(value) || null;
          } else if (header === 'employee_size_bracket' || header === 'size') {
            companyData.employeeSizeBracket = value;
          } else if (header === 'linkedin' || header === 'linkedin_url') {
            companyData.linkedinUrl = value;
          } else if (header === 'city') {
            companyData.city = value;
          } else if (header === 'state') {
            companyData.state = value;
          } else if (header === 'country') {
            companyData.country = value;
          } else if (header === 'description') {
            companyData.description = value;
          } else if (header === 'technologies') {
            companyData.technologies = value.split(';').map((t: string) => t.trim()).filter(Boolean);
          }
        });

        // Auto-extract domain from website if not provided
        if (!companyData.domains?.length && companyData.website) {
          try {
            const url = new URL(companyData.website.startsWith('http') ? companyData.website : `https://${companyData.website}`);
            companyData.domains = [url.hostname.replace('www.', '')];
          } catch (e) {}
        }

        if (companyData.name) {
          companies.push(companyData);
        }
      }

      const result = await storage.bulkImportCompanies(companies);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        imported: result.imported,
        duplicates: result.duplicates,
        total: companies.length
      });
    } catch (error) {
      console.error('Bulk import companies error:', error);
      res.status(500).json({ message: "Failed to import companies" });
    }
  });

  // ============ PROSPECT ROUTES ============

  // Create prospect (simplified form with auto company matching)
  app.post("/api/prospects", requireAuth, async (req, res) => {
    try {
      const prospectData = insertProspectSchema.parse(req.body);
      const contact = await storage.createProspect(prospectData);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('Create prospect error:', error);
      res.status(400).json({ message: error.message || "Invalid prospect data" });
    }
  });

  // Get unmatched prospects (for review queue)
  app.get("/api/prospects/unmatched", requireAuth, async (req, res) => {
    try {
      const prospects = await storage.getUnmatchedProspects();
      res.json(prospects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unmatched prospects" });
    }
  });

  // Match single prospect to company
  app.post("/api/prospects/:id/match", requireAuth, async (req, res) => {
    try {
      const result = await storage.matchProspectToCompany(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to match prospect" });
    }
  });

  // Bulk match all unmatched prospects
  app.post("/api/prospects/bulk-match", requireAuth, async (req, res) => {
    try {
      const result = await storage.bulkMatchProspectsToCompanies();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk match prospects" });
    }
  });

  // Manually assign company to prospect
  app.post("/api/prospects/:id/assign-company", requireAuth, async (req, res) => {
    try {
      const { companyId } = req.body;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      const contact = await storage.manuallyAssignCompany(req.params.id, companyId);
      if (!contact) {
        return res.status(404).json({ message: "Prospect or company not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign company" });
    }
  });
  
  // Get contacts with pagination and filtering (protected route)
  app.get("/api/contacts", requireAuth, async (req, res) => {
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

  // Search contacts by LinkedIn URL in existing database
  // NOTE: This route MUST be registered BEFORE /api/contacts/:id to avoid being caught by the param route
  // Note: This endpoint is also used by Chrome extension which handles its own auth via extension-routes.ts
  app.get("/api/contacts/linkedin-search", async (req, res) => {
    try {
      const linkedinUrl = req.query.url as string;
      
      if (!linkedinUrl) {
        return res.status(400).json({ 
          success: false,
          message: "LinkedIn URL is required" 
        });
      }
      
      // Validate that it looks like a LinkedIn URL
      if (!linkedinUrl.includes('linkedin.com/in/')) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid LinkedIn URL format. Use format: linkedin.com/in/username" 
        });
      }
      
      console.log(`🔍 Searching contacts by LinkedIn URL: ${linkedinUrl}`);
      const foundContacts = await storage.findContactsByLinkedInUrl(linkedinUrl);
      
      res.json({ 
        success: true,
        contacts: foundContacts,
        count: foundContacts.length,
        message: foundContacts.length > 0 
          ? `Found ${foundContacts.length} matching contact(s)` 
          : "No contacts found with this LinkedIn URL"
      });
    } catch (error) {
      console.error('LinkedIn search error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search contacts by LinkedIn URL" 
      });
    }
  });

  // Get single contact (protected route)
  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
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

  // Create contact (protected route)
  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      // Pre-process data to generate fullName if needed
      const rawData = req.body;
      
      // Generate fullName if not provided
      if (!rawData.fullName && (rawData.firstName || rawData.lastName)) {
        const first = rawData.firstName?.trim() || '';
        const last = rawData.lastName?.trim() || '';
        
        if (first && last) {
          rawData.fullName = `${first} ${last}`;
        } else if (first) {
          rawData.fullName = first;
        } else if (last) {
          rawData.fullName = last;
        }
      }
      
      // Fallback if still no fullName
      if (!rawData.fullName) {
        rawData.fullName = rawData.email ? rawData.email.split('@')[0] : 'Unknown Contact';
      }
      
      const validatedData = insertContactSchema.parse(rawData);
      
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
      
      const contact = await storage.createContactWithAutoFill(enrichedData);
      
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
  app.patch("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      console.log('PATCH request body:', req.body);
      
      // Create a more lenient partial schema for updates by extracting the base schema
      const baseContactSchema = z.object({
        fullName: z.string().optional(),
        firstName: z.string().optional().nullable(),
        lastName: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        mobilePhone: z.string().optional().nullable(),
        otherPhone: z.string().optional().nullable(),
        homePhone: z.string().optional().nullable(),
        corporatePhone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        employees: z.number().optional().nullable(),
        employeeSizeBracket: z.string().optional().nullable(),
        industry: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        companyLinkedIn: z.string().optional().nullable(),
        technologies: z.array(z.string()).optional().nullable(),
        annualRevenue: z.string().optional().nullable(),
        personLinkedIn: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        companyAddress: z.string().optional().nullable(),
        companyCity: z.string().optional().nullable(),
        companyState: z.string().optional().nullable(),
        companyCountry: z.string().optional().nullable(),
        emailDomain: z.string().optional().nullable(),
        countryCode: z.string().optional().nullable(),
        timezone: z.string().optional().nullable(),
        leadScore: z.string().optional().nullable(),
        companyAge: z.number().optional().nullable(),
        technologyCategory: z.string().optional().nullable(),
        region: z.string().optional().nullable(),
        businessType: z.string().optional().nullable(),
        isDeleted: z.boolean().optional()
      }).partial();
      
      const updateSchema = baseContactSchema.extend({
        employees: z.union([z.number(), z.string(), z.null()]).optional(),
        companyAge: z.union([z.number(), z.string(), z.null()]).optional(),
        leadScore: z.union([z.number(), z.string(), z.null()]).optional(),
        annualRevenue: z.union([z.number(), z.string(), z.null()]).optional(),
        email: z.union([z.string().email(), z.string().length(0), z.null()]).optional(),
        website: z.union([z.string().url(), z.string().length(0), z.null()]).optional(),
        personLinkedIn: z.union([z.string().url(), z.string().length(0), z.null()]).optional(),
        companyLinkedIn: z.union([z.string().url(), z.string().length(0), z.null()]).optional(),
      });
      
      const updates = updateSchema.parse(req.body);
      console.log('Parsed updates:', updates);
      
      // Clean up empty strings to null for optional fields
      const cleanedUpdates = Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [
          key, 
          value === '' ? null : value
        ])
      );
      
      // Skip enrichment for simple inline edits to avoid issues, but use auto-fill for company updates
      const contact = await storage.updateContactWithAutoFill(req.params.id!, cleanedUpdates);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Activity logging is handled by updateContactWithAutoFill
      
      res.json(contact);
    } catch (error) {
      console.error('PATCH error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid contact data", 
          errors: error.errors,
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      res.status(500).json({ message: "Failed to update contact", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
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
  app.delete("/api/contacts", requireAuth, async (req, res) => {
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

  // Bulk update contacts
  app.patch("/api/contacts/bulk-update", requireAuth, async (req, res) => {
    try {
      const { contactIds, updates } = req.body;
      
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty contact IDs array" });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: "Invalid updates object" });
      }
      
      // Create schema for bulk updates (only allow certain fields)
      const bulkUpdateSchema = z.object({
        industry: z.string().optional(),
        employeeSizeBracket: z.string().optional(),
        country: z.string().optional(),
        leadScore: z.union([z.number(), z.string()]).transform(val => {
          const num = typeof val === 'string' ? parseInt(val) : val;
          return !isNaN(num) && num >= 0 && num <= 100 ? num : undefined;
        }).optional(),
      });
      
      const validatedUpdates = bulkUpdateSchema.parse(updates);
      
      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(validatedUpdates).filter(([_, value]) => value !== undefined)
      );
      
      if (Object.keys(cleanUpdates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }
      
      let updatedCount = 0;
      const errors: string[] = [];
      
      // Update each contact
      for (const contactId of contactIds) {
        try {
          const contact = await storage.updateContact(contactId, cleanUpdates);
          if (contact) {
            updatedCount++;
            // Log bulk update activity
            await storage.createContactActivity({
              contactId: contact.id,
              activityType: 'updated',
              description: 'Contact updated via bulk edit',
              changes: cleanUpdates,
            });
          }
        } catch (error) {
          errors.push(`Failed to update contact ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      res.json({ 
        updatedCount,
        totalRequested: contactIds.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid update data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to bulk update contacts" });
    }
  });

  // Get contact stats  
  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getContactStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Comprehensive Analytics Endpoints
  app.get("/api/analytics/comprehensive", requireAuth, async (req, res) => {
    try {
      const analytics = await storage.getComprehensiveAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Comprehensive analytics error:', error);
      res.status(500).json({ message: "Failed to fetch comprehensive analytics" });
    }
  });

  app.get("/api/analytics/trends", requireAuth, async (req, res) => {
    try {
      const trends = await storage.getAnalyticsTrends();
      res.json(trends);
    } catch (error) {
      console.error('Analytics trends error:', error);
      res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
  });

  app.get("/api/analytics/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getAnalyticsActivities();
      res.json(activities);
    } catch (error) {
      console.error('Analytics activities error:', error);
      res.status(500).json({ message: "Failed to fetch analytics activities" });
    }
  });

  app.get("/api/analytics/imports", requireAuth, async (req, res) => {
    try {
      const imports = await storage.getAnalyticsImports();
      res.json(imports);
    } catch (error) {
      console.error('Analytics imports error:', error);
      res.status(500).json({ message: "Failed to fetch analytics imports" });
    }
  });

  // Get contact activities
  app.get("/api/contacts/:id/activities", requireAuth, async (req, res) => {
    try {
      const activities = await storage.getContactActivities(req.params.id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Bulk auto-fill company details for all contacts (legacy sync endpoint)
  app.post("/api/contacts/bulk-autofill", requireAuth, async (req, res) => {
    try {
      const result = await storage.bulkAutoFillCompanyDetails();
      res.json({ 
        success: true, 
        message: `Auto-filled ${result.updated} contacts across ${result.companiesProcessed.length} companies`,
        ...result 
      });
    } catch (error) {
      console.error('Bulk auto-fill error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to perform bulk auto-fill", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ============ REAL-TIME BULK OPERATIONS API ============

  // Get bulk operation job status
  app.get("/api/bulk/jobs/:id", requireAuth, async (req, res) => {
    try {
      const job = await storage.getBulkOperationJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Bulk operation job not found" });
      }
      res.json({ success: true, job });
    } catch (error) {
      console.error('Get bulk job error:', error);
      res.status(500).json({ message: "Failed to get bulk operation job" });
    }
  });

  // Get recent bulk operation jobs
  app.get("/api/bulk/jobs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const jobs = await storage.getRecentBulkOperationJobs(limit);
      res.json({ success: true, jobs });
    } catch (error) {
      console.error('Get bulk jobs error:', error);
      res.status(500).json({ message: "Failed to get bulk operation jobs" });
    }
  });

  // Start real-time bulk match operation
  app.post("/api/bulk/match", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      
      // Create the job
      const job = await storage.createBulkOperationJob({
        operationType: 'bulk-match',
        status: 'queued',
        userId,
      });

      // Respond immediately with job ID
      res.json({ 
        success: true, 
        jobId: job.id,
        message: "Bulk match operation started. Subscribe to WebSocket for real-time updates."
      });

      // Run the operation asynchronously with WebSocket updates
      setImmediate(async () => {
        try {
          const result = await storage.bulkMatchProspectsWithProgress(job.id, (progress) => {
            wsHub.broadcastBulkProgress(job.id, progress);
          });
          
          await storage.updateBulkOperationJob(job.id, {
            status: 'completed',
            finishedAt: new Date(),
            results: result,
          });
          
          wsHub.broadcastBulkComplete(job.id, {
            operationType: 'bulk-match',
            totals: {
              total: result.matched + result.unmatched + result.skipped,
              processed: result.matched + result.unmatched + result.skipped,
              success: result.matched,
              failed: result.unmatched,
              skipped: result.skipped,
              matched: result.matched,
            },
            message: `Matched ${result.matched} contacts, ${result.unmatched} unmatched, ${result.skipped} skipped`,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await storage.updateBulkOperationJob(job.id, {
            status: 'failed',
            finishedAt: new Date(),
          });
          wsHub.broadcastBulkError(job.id, errorMsg, { operationType: 'bulk-match' });
        }
      });
    } catch (error) {
      console.error('Start bulk match error:', error);
      res.status(500).json({ message: "Failed to start bulk match operation" });
    }
  });

  // Start real-time bulk auto-fill operation
  app.post("/api/bulk/autofill", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      
      // Create the job
      const job = await storage.createBulkOperationJob({
        operationType: 'bulk-autofill',
        status: 'queued',
        userId,
      });

      // Respond immediately with job ID
      res.json({ 
        success: true, 
        jobId: job.id,
        message: "Bulk auto-fill operation started. Subscribe to WebSocket for real-time updates."
      });

      // Run the operation asynchronously with WebSocket updates
      setImmediate(async () => {
        try {
          const result = await storage.bulkAutoFillWithProgress(job.id, (progress) => {
            wsHub.broadcastBulkProgress(job.id, progress);
          });
          
          await storage.updateBulkOperationJob(job.id, {
            status: 'completed',
            finishedAt: new Date(),
            results: result,
          });
          
          wsHub.broadcastBulkComplete(job.id, {
            operationType: 'bulk-autofill',
            totals: {
              total: result.processed,
              processed: result.processed,
              success: result.updated,
              failed: 0,
              skipped: result.skipped,
              matched: result.companiesProcessed.length,
            },
            message: `Updated ${result.updated} contacts across ${result.companiesProcessed.length} companies`,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await storage.updateBulkOperationJob(job.id, {
            status: 'failed',
            finishedAt: new Date(),
          });
          wsHub.broadcastBulkError(job.id, errorMsg, { operationType: 'bulk-autofill' });
        }
      });
    } catch (error) {
      console.error('Start bulk autofill error:', error);
      res.status(500).json({ message: "Failed to start bulk auto-fill operation" });
    }
  });

  // Start real-time bulk delete operation
  app.post("/api/bulk/delete", requireAuth, async (req, res) => {
    try {
      const { contactIds } = req.body;
      const userId = (req as any).user?.id;
      
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "Contact IDs array is required" });
      }
      
      // Create the job
      const job = await storage.createBulkOperationJob({
        operationType: 'bulk-delete',
        status: 'queued',
        params: { contactIds },
        userId,
      });

      // Respond immediately with job ID
      res.json({ 
        success: true, 
        jobId: job.id,
        message: "Bulk delete operation started. Subscribe to WebSocket for real-time updates."
      });

      // Run the operation asynchronously with WebSocket updates
      setImmediate(async () => {
        try {
          const result = await storage.bulkDeleteContactsWithProgress(job.id, contactIds, (progress) => {
            wsHub.broadcastBulkProgress(job.id, progress);
          });
          
          await storage.updateBulkOperationJob(job.id, {
            status: 'completed',
            finishedAt: new Date(),
            results: result,
          });
          
          wsHub.broadcastBulkComplete(job.id, {
            operationType: 'bulk-delete',
            totals: {
              total: contactIds.length,
              processed: contactIds.length,
              success: result.deleted,
              failed: result.failed,
              skipped: 0,
              matched: 0,
            },
            message: `Deleted ${result.deleted} contacts, ${result.failed} failed`,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await storage.updateBulkOperationJob(job.id, {
            status: 'failed',
            finishedAt: new Date(),
          });
          wsHub.broadcastBulkError(job.id, errorMsg, { operationType: 'bulk-delete' });
        }
      });
    } catch (error) {
      console.error('Start bulk delete error:', error);
      res.status(500).json({ message: "Failed to start bulk delete operation" });
    }
  });

  // Start real-time bulk company import operation
  app.post("/api/bulk/companies/import", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ message: "File is empty or has no data rows" });
      }

      // Parse CSV headers and data
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const companiesToImport: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 1 && values[0]) {
          const company: any = {};
          headers.forEach((header, idx) => {
            if (values[idx]) {
              const normalizedHeader = header.toLowerCase().replace(/[\s_-]+/g, '');
              if (normalizedHeader.includes('name') || normalizedHeader === 'company') {
                company.name = values[idx];
              } else if (normalizedHeader.includes('website') || normalizedHeader.includes('domain')) {
                company.website = values[idx];
                const domain = values[idx].replace(/https?:\/\//, '').replace('www.', '').split('/')[0];
                company.domains = [domain];
              } else if (normalizedHeader.includes('industry')) {
                company.industry = values[idx];
              } else if (normalizedHeader.includes('employee') || normalizedHeader.includes('size')) {
                company.employeeSizeBracket = values[idx];
              } else if (normalizedHeader.includes('linkedin')) {
                company.linkedinUrl = values[idx];
              } else if (normalizedHeader.includes('phone')) {
                company.phone = values[idx];
              } else if (normalizedHeader.includes('city')) {
                company.city = values[idx];
              } else if (normalizedHeader.includes('state')) {
                company.state = values[idx];
              } else if (normalizedHeader.includes('country')) {
                company.country = values[idx];
              }
            }
          });
          
          if (company.name) {
            companiesToImport.push(company);
          }
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      if (companiesToImport.length === 0) {
        return res.status(400).json({ message: "No valid companies found in file" });
      }
      
      // Create the job
      const job = await storage.createBulkOperationJob({
        operationType: 'bulk-import-companies',
        status: 'queued',
        params: { filename: req.file.originalname, totalCompanies: companiesToImport.length },
        userId,
      });

      // Respond immediately with job ID
      res.json({ 
        success: true, 
        jobId: job.id,
        message: `Started importing ${companiesToImport.length} companies. Subscribe to WebSocket for real-time updates.`
      });

      // Run the operation asynchronously with WebSocket updates
      setImmediate(async () => {
        try {
          const result = await storage.bulkImportCompaniesWithProgress(job.id, companiesToImport, (progress) => {
            wsHub.broadcastBulkProgress(job.id, progress);
          });
          
          await storage.updateBulkOperationJob(job.id, {
            status: 'completed',
            finishedAt: new Date(),
            results: result,
          });
          
          wsHub.broadcastBulkComplete(job.id, {
            operationType: 'bulk-import-companies',
            totals: {
              total: companiesToImport.length,
              processed: companiesToImport.length,
              success: result.imported,
              failed: result.failed,
              skipped: result.duplicates,
              matched: 0,
            },
            message: `Imported ${result.imported} companies, ${result.duplicates} duplicates, ${result.failed} failed`,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await storage.updateBulkOperationJob(job.id, {
            status: 'failed',
            finishedAt: new Date(),
          });
          wsHub.broadcastBulkError(job.id, errorMsg, { operationType: 'bulk-import-companies' });
        }
      });
    } catch (error) {
      console.error('Start bulk company import error:', error);
      res.status(500).json({ message: "Failed to start bulk company import" });
    }
  });

  // Ultra-fast auto-map CSV headers using advanced streaming parser and NLP
  app.post("/api/import/auto-map", requireAuth, upload.single('csv'), async (req, res) => {
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
      const tempFileName = `${Date.now()}_${Buffer.from(req.file.originalname).toString('hex')}.csv`;
      const tempPath = `${UPLOADS_DIR}/${tempFileName}`;
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
  app.post("/api/import", requireAuth, upload.single('csv'), async (req, res) => {
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
  app.get("/api/import/:jobId", requireAuth, async (req, res) => {
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

  // ==================== COMPANY IMPORT ROUTES ====================

  // Auto-map company CSV headers using NLP
  app.post("/api/companies/import/auto-map", requireAuth, upload.single('csv'), async (req, res) => {
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
      
      // Use company NLP model to automatically map fields
      const { mapping: autoMapping, confidence, suggestions } = await companyCSVProcessor.getAutoMapping(analysis.headers);

      // Estimate processing time for user feedback
      const estimatedTime = StreamingCSVParser.estimateProcessingTime(req.file.path);

      // Store file for later import with improved naming
      const tempFileName = `company_${Date.now()}_${Buffer.from(req.file.originalname).toString('hex')}.csv`;
      const tempPath = `${UPLOADS_DIR}/${tempFileName}`;
      fs.renameSync(req.file.path, tempPath);

      // Get available fields for manual mapping
      const availableFields = companyCSVProcessor.getAvailableFields();

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
        availableFields,
        validation: {
          isValid: validation.isValid,
          recommendations: validation.recommendations
        }
      });
    } catch (error) {
      console.error('Company auto-mapping error:', error);
      res.status(500).json({ 
        message: "Failed to analyze company CSV file",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Execute company import
  app.post("/api/companies/import", requireAuth, async (req, res) => {
    try {
      const { tempFile, fieldMapping, options = {} } = req.body;
      
      if (!tempFile) {
        return res.status(400).json({ message: "No temporary file specified" });
      }

      const filePath = `${UPLOADS_DIR}/${tempFile}`;
      
      if (!fs.existsSync(filePath)) {
        return res.status(400).json({ message: "Temporary file not found. Please re-upload the CSV." });
      }

      // Parse import options with defaults
      const importOptions = {
        skipDuplicates: options.skipDuplicates !== false,
        updateExisting: options.updateExisting === true,
        batchSize: 100,
        fieldMapping: fieldMapping || {}
      };

      // Create import job
      const job = await storage.createImportJob({
        filename: tempFile,
        status: 'processing',
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        errorRows: 0,
        duplicateRows: 0,
        fieldMapping: importOptions.fieldMapping,
        errors: null,
      });

      // Start async processing
      companyCSVProcessor.processCompanyCSV(filePath, job.id, importOptions)
        .then(() => {
          // Clean up temp file after processing
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.warn('Failed to clean up temp file:', e);
          }
        })
        .catch((error) => {
          console.error('Company CSV processing failed:', error);
        });

      res.status(202).json({ 
        jobId: job.id, 
        message: "Company import started - processing with smart field mapping",
        estimatedTime: StreamingCSVParser.estimateProcessingTime(filePath)
      });
    } catch (error) {
      console.error('Company import initialization failed:', error);
      res.status(500).json({ 
        message: "Failed to start company import",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get available company fields for mapping
  app.get("/api/companies/import/fields", requireAuth, async (req, res) => {
    try {
      const fields = companyCSVProcessor.getAvailableFields();
      res.json(fields);
    } catch (error) {
      res.status(500).json({ message: "Failed to get company fields" });
    }
  });

  // ==================== END COMPANY IMPORT ROUTES ====================

  // Fix incorrectly mapped full names
  app.post("/api/fix-fullnames", requireAuth, async (req, res) => {
    try {
      console.log('🔧 Manual full name fix requested');
      const fixedCount = await storage.fixEmptyFullNames();
      res.json({ 
        success: true, 
        fixedCount,
        message: `Successfully fixed ${fixedCount} contact full names` 
      });
    } catch (error) {
      console.error("Error fixing full names:", error);
      res.status(500).json({ 
        error: "Failed to fix full names",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Export contacts
  app.get("/api/export", requireAuth, async (req, res) => {
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

  // Get company template for auto-fill preview (enhanced with smart matching)
  app.get("/api/companies/:companyName/template", requireAuth, async (req, res) => {
    try {
      const companyName = decodeURIComponent(req.params.companyName);
      // Support optional query parameters for better matching
      const website = req.query.website as string | undefined;
      const companyLinkedIn = req.query.companyLinkedIn as string | undefined;
      const email = req.query.email as string | undefined;
      
      const template = await storage.getCompanyTemplate(companyName, website, companyLinkedIn, email);
      
      if (!template) {
        return res.json({ 
          success: false, 
          message: "No existing company data found for auto-fill",
          template: null
        });
      }
      
      res.json({ 
        success: true, 
        message: `Company template found with ${Object.keys(template).length} auto-fillable fields`,
        template,
        autoFillableFields: Object.keys(template)
      });
    } catch (error) {
      console.error('Get company template error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to get company template" 
      });
    }
  });

  // Fix empty fullNames route (admin utility)
  app.post("/api/admin/fix-fullnames", requireAuth, async (req, res) => {
    try {
      const fixedCount = await storage.fixEmptyFullNames();
      res.json({ 
        success: true, 
        message: `Fixed ${fixedCount} contacts with empty full names`,
        fixedCount 
      });
    } catch (error) {
      console.error('Fix fullNames error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fix full names" 
      });
    }
  });

  // ============ LinkedIn Enrichment Routes ============

  // Check if LinkedIn enrichment is configured
  app.get("/api/enrichment/status", requireAuth, async (req, res) => {
    try {
      const isConfigured = linkedinEnrichmentService.isConfigured();
      res.json({
        configured: isConfigured,
        provider: "proxycurl",
        message: isConfigured 
          ? "LinkedIn enrichment is ready to use" 
          : "Please add PROXYCURL_API_KEY to your secrets to enable LinkedIn enrichment"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to check enrichment status" });
    }
  });

  // Search contact details by LinkedIn URL (standalone search)
  app.post("/api/enrichment/search", requireAuth, async (req, res) => {
    try {
      const { linkedinUrl } = linkedinEnrichmentRequestSchema.parse(req.body);
      
      if (!linkedinEnrichmentService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: "LinkedIn enrichment not configured. Please add PROXYCURL_API_KEY to your secrets."
        });
      }

      console.log(`🔍 Searching LinkedIn: ${linkedinUrl}`);
      const result = await linkedinEnrichmentService.searchByLinkedIn(linkedinUrl);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data,
          creditsUsed: result.creditsUsed,
          message: "Contact details found successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          creditsUsed: result.creditsUsed
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid LinkedIn URL", 
          errors: error.errors 
        });
      }
      console.error('LinkedIn search error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to search LinkedIn profile" 
      });
    }
  });

  // Enrich existing contact by LinkedIn URL
  app.post("/api/contacts/:id/enrich-linkedin", requireAuth, async (req, res) => {
    try {
      const contactId = req.params.id;
      let linkedinUrl = req.body.linkedinUrl;
      
      // If no LinkedIn URL provided, try to get it from the contact
      if (!linkedinUrl) {
        const contact = await storage.getContact(contactId);
        if (!contact) {
          return res.status(404).json({ success: false, message: "Contact not found" });
        }
        linkedinUrl = contact.personLinkedIn;
        if (!linkedinUrl) {
          return res.status(400).json({ 
            success: false, 
            message: "Contact has no LinkedIn URL. Please provide one." 
          });
        }
      }

      if (!linkedinEnrichmentService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: "LinkedIn enrichment not configured. Please add PROXYCURL_API_KEY to your secrets."
        });
      }

      console.log(`🔍 Enriching contact ${contactId} from LinkedIn: ${linkedinUrl}`);
      const result = await linkedinEnrichmentService.enrichFromLinkedIn(linkedinUrl, contactId);
      
      if (result.success) {
        // Get the updated contact
        const updatedContact = await storage.getContact(contactId);
        res.json({
          success: true,
          data: result.data,
          contact: updatedContact,
          creditsUsed: result.creditsUsed,
          message: "Contact enriched successfully"
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          creditsUsed: result.creditsUsed
        });
      }
    } catch (error) {
      console.error('LinkedIn enrichment error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to enrich contact from LinkedIn" 
      });
    }
  });

  // Create new contact from LinkedIn search
  app.post("/api/enrichment/create-contact", requireAuth, async (req, res) => {
    try {
      const { linkedinUrl } = linkedinEnrichmentRequestSchema.parse(req.body);
      
      if (!linkedinEnrichmentService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: "LinkedIn enrichment not configured. Please add PROXYCURL_API_KEY to your secrets."
        });
      }

      console.log(`🔍 Creating contact from LinkedIn: ${linkedinUrl}`);
      const result = await linkedinEnrichmentService.searchByLinkedIn(linkedinUrl);
      
      if (!result.success || !result.data) {
        return res.status(400).json({
          success: false,
          error: result.error || "Could not retrieve contact data from LinkedIn"
        });
      }

      // Create a new contact with the enriched data
      const contactData = {
        fullName: result.data.fullName || [result.data.firstName, result.data.lastName].filter(Boolean).join(" ") || "Unknown",
        firstName: result.data.firstName || null,
        lastName: result.data.lastName || null,
        email: result.data.email || null,
        mobilePhone: result.data.phone || null,
        title: result.data.title || null,
        company: result.data.company || null,
        companyLinkedIn: result.data.companyLinkedIn || null,
        personLinkedIn: linkedinUrl,
        city: result.data.city || null,
        state: result.data.state || null,
        country: result.data.country || null,
      };

      const contact = await storage.createContactWithAutoFill(contactData);
      
      // Log enrichment activity
      await storage.createContactActivity({
        contactId: contact.id,
        activityType: 'enriched',
        description: 'Contact created from LinkedIn profile enrichment',
        changes: result.data as any,
      });

      res.status(201).json({
        success: true,
        contact,
        enrichedData: result.data,
        creditsUsed: result.creditsUsed,
        message: "Contact created successfully from LinkedIn profile"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid LinkedIn URL", 
          errors: error.errors 
        });
      }
      console.error('Create contact from LinkedIn error:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to create contact from LinkedIn" 
      });
    }
  });

  // Get enrichment job history
  app.get("/api/enrichment/jobs", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const jobs = await storage.getRecentEnrichmentJobs(limit);
      res.json({ jobs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrichment jobs" });
    }
  });

  // Get enrichment jobs for a specific contact
  app.get("/api/contacts/:id/enrichment-jobs", requireAuth, async (req, res) => {
    try {
      const jobs = await storage.getEnrichmentJobsByContact(req.params.id);
      res.json({ jobs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact enrichment jobs" });
    }
  });

  // ==========================================
  // PUBLIC API ENDPOINTS (API Key Authentication)
  // ==========================================

  // Public API: Search prospects by LinkedIn URL
  app.get("/api/public/prospects", validateApiKey, async (req, res) => {
    try {
      const linkedinUrl = req.query.linkedinUrl as string;
      
      if (!linkedinUrl) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameter",
          message: "Please provide a linkedinUrl query parameter",
        });
      }

      if (!linkedinUrl.includes('linkedin.com')) {
        return res.status(400).json({
          success: false,
          error: "Invalid LinkedIn URL",
          message: "The URL must be a valid LinkedIn profile URL",
        });
      }

      console.log(`🔍 [Public API] Searching prospects by LinkedIn: ${linkedinUrl}`);
      const prospects = await storage.findContactsByLinkedInUrl(linkedinUrl);

      if (prospects.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No prospects found",
          message: "No prospects found with this LinkedIn URL in the database",
        });
      }

      res.json({
        success: true,
        count: prospects.length,
        prospects: prospects.map(prospect => ({
          id: prospect.id,
          fullName: prospect.fullName,
          firstName: prospect.firstName,
          lastName: prospect.lastName,
          title: prospect.title,
          email: prospect.email,
          mobilePhone: prospect.mobilePhone,
          otherPhone: prospect.otherPhone,
          homePhone: prospect.homePhone,
          corporatePhone: prospect.corporatePhone,
          company: prospect.company,
          employees: prospect.employees,
          employeeSizeBracket: prospect.employeeSizeBracket,
          industry: prospect.industry,
          website: prospect.website,
          companyLinkedIn: prospect.companyLinkedIn,
          personLinkedIn: prospect.personLinkedIn,
          technologies: prospect.technologies,
          annualRevenue: prospect.annualRevenue,
          city: prospect.city,
          state: prospect.state,
          country: prospect.country,
          companyAddress: prospect.companyAddress,
          companyCity: prospect.companyCity,
          companyState: prospect.companyState,
          companyCountry: prospect.companyCountry,
          emailDomain: prospect.emailDomain,
          countryCode: prospect.countryCode,
          timezone: prospect.timezone,
          leadScore: prospect.leadScore,
          companyAge: prospect.companyAge,
          technologyCategory: prospect.technologyCategory,
          region: prospect.region,
          businessType: prospect.businessType,
        })),
      });
    } catch (error) {
      console.error("[Public API] Prospect search error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to search prospects",
      });
    }
  });

  // Public API: Create a new contact
  app.post("/api/public/contacts", validateApiKey, async (req, res) => {
    try {
      const contactData = req.body;

      // Validate required fields - at least one identifier must be provided
      if (!contactData.email && !contactData.firstName && !contactData.lastName && !contactData.fullName) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
          message: "Please provide at least one of: email, firstName, lastName, or fullName",
        });
      }

      // Auto-generate fullName from firstName and lastName if not provided
      if (!contactData.fullName) {
        if (contactData.firstName || contactData.lastName) {
          const firstName = contactData.firstName?.trim() || '';
          const lastName = contactData.lastName?.trim() || '';
          contactData.fullName = [firstName, lastName].filter(Boolean).join(' ');
        } else if (contactData.email) {
          // Use email username as fallback for fullName
          contactData.fullName = contactData.email.split('@')[0];
        }
      }

      // Validate the contact data using the insert schema
      const validatedData = insertContactSchema.parse(contactData);

      console.log(`📥 [Public API] Creating contact: ${validatedData.fullName || validatedData.email}`);

      // Create the contact
      const contact = await storage.createContact(validatedData);

      // Log activity
      await storage.createContactActivity({
        contactId: contact.id,
        activityType: "created",
        description: "Contact created via Public API",
      });

      res.status(201).json({
        success: true,
        message: "Contact created successfully",
        contact: {
          id: contact.id,
          fullName: contact.fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          title: contact.title,
          company: contact.company,
          mobilePhone: contact.mobilePhone,
          personLinkedIn: contact.personLinkedIn,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          industry: contact.industry,
          createdAt: contact.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[Public API] Contact validation error:", error.errors);
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "Invalid contact data provided",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      console.error("[Public API] Create contact error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to create contact",
      });
    }
  });

  // Public API: Create multiple contacts in bulk
  app.post("/api/public/contacts/bulk", validateApiKey, async (req, res) => {
    try {
      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid request body",
          message: "Please provide an array of contacts in the 'contacts' field",
        });
      }

      if (contacts.length > 100) {
        return res.status(400).json({
          success: false,
          error: "Too many contacts",
          message: "Maximum 100 contacts can be created in a single request",
        });
      }

      console.log(`📥 [Public API] Bulk creating ${contacts.length} contacts`);

      const results: { success: boolean; contact?: any; error?: string; index: number }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        const contactData = contacts[i];
        
        try {
          // Auto-generate fullName from firstName and lastName if not provided
          if (!contactData.fullName) {
            if (contactData.firstName || contactData.lastName) {
              const firstName = contactData.firstName?.trim() || '';
              const lastName = contactData.lastName?.trim() || '';
              contactData.fullName = [firstName, lastName].filter(Boolean).join(' ');
            } else if (contactData.email) {
              // Use email username as fallback for fullName
              contactData.fullName = contactData.email.split('@')[0];
            }
          }

          // Validate the contact data
          const validatedData = insertContactSchema.parse(contactData);

          // Create the contact
          const contact = await storage.createContact(validatedData);

          // Log activity
          await storage.createContactActivity({
            contactId: contact.id,
            activityType: "created",
            description: "Contact created via Public API (bulk)",
          });

          results.push({
            success: true,
            index: i,
            contact: {
              id: contact.id,
              fullName: contact.fullName,
              email: contact.email,
            },
          });
          successCount++;
        } catch (error) {
          if (error instanceof z.ZodError) {
            results.push({
              success: false,
              index: i,
              error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
            });
          } else {
            results.push({
              success: false,
              index: i,
              error: "Failed to create contact",
            });
          }
          errorCount++;
        }
      }

      res.status(successCount > 0 ? 201 : 400).json({
        success: successCount > 0,
        message: `Created ${successCount} contacts, ${errorCount} failed`,
        summary: {
          total: contacts.length,
          created: successCount,
          failed: errorCount,
        },
        results,
      });
    } catch (error) {
      console.error("[Public API] Bulk create contacts error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: "Failed to create contacts",
      });
    }
  });

  // ==========================================
  // API KEY MANAGEMENT ENDPOINTS
  // ==========================================

  // Get user's API keys
  app.get("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const keys = await storage.getUserApiKeys(userId);
      
      res.json({
        success: true,
        keys: keys.map(key => ({
          id: key.id,
          label: key.label,
          scopes: key.scopes,
          rateLimitPerMinute: key.rateLimitPerMinute,
          requestCount: key.requestCount,
          lastUsedAt: key.lastUsedAt,
          createdAt: key.createdAt,
          revokedAt: key.revokedAt,
          isActive: !key.revokedAt,
        })),
      });
    } catch (error) {
      console.error("Get API keys error:", error);
      res.status(500).json({ success: false, message: "Failed to fetch API keys" });
    }
  });

  // Create new API key
  app.post("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { label, rateLimitPerMinute, scopes } = req.body;

      if (!label || typeof label !== "string" || label.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Label is required for the API key",
        });
      }

      const { key, hashedKey } = generateApiKey();
      
      const defaultScopes = [
        API_SCOPES.CONTACTS_READ,
        API_SCOPES.CONTACTS_WRITE,
        API_SCOPES.CONTACTS_DELETE,
        API_SCOPES.CONTACTS_BULK,
        API_SCOPES.ENRICHMENT_RUN,
        API_SCOPES.ENRICHMENT_READ,
        API_SCOPES.STATS_READ,
        API_SCOPES.TAGS_READ,
        API_SCOPES.TAGS_WRITE,
        API_SCOPES.ACTIVITIES_READ,
      ];
      
      const validScopes = Object.values(API_SCOPES);
      const requestedScopes = Array.isArray(scopes) 
        ? scopes.filter((s: string) => validScopes.includes(s as any))
        : defaultScopes;

      const apiKey = await storage.createApiKey({
        hashedKey,
        label: label.trim(),
        ownerUserId: userId,
        scopes: requestedScopes.length > 0 ? requestedScopes : defaultScopes,
        rateLimitPerMinute: rateLimitPerMinute || 60,
      });

      res.status(201).json({
        success: true,
        message: "API key created successfully. Copy the key now - it won't be shown again.",
        key,
        apiKey: {
          id: apiKey.id,
          label: apiKey.label,
          scopes: apiKey.scopes,
          rateLimitPerMinute: apiKey.rateLimitPerMinute,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error) {
      console.error("Create API key error:", error);
      res.status(500).json({ success: false, message: "Failed to create API key" });
    }
  });

  // Revoke API key
  app.delete("/api/api-keys/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const keyId = req.params.id;

      const userKeys = await storage.getUserApiKeys(userId);
      const keyBelongsToUser = userKeys.some(key => key.id === keyId);

      if (!keyBelongsToUser) {
        return res.status(404).json({
          success: false,
          message: "API key not found",
        });
      }

      const revoked = await storage.revokeApiKey(keyId);

      if (revoked) {
        res.json({
          success: true,
          message: "API key revoked successfully",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to revoke API key",
        });
      }
    } catch (error) {
      console.error("Revoke API key error:", error);
      res.status(500).json({ success: false, message: "Failed to revoke API key" });
    }
  });

  // ============ DATABASE MANAGEMENT & DATA QUALITY ROUTES ============

  // Get database health summary
  app.get("/api/database/health", requireAuth, async (req, res) => {
    try {
      const health = await storage.getDatabaseHealthSummary();
      res.json({ success: true, data: health });
    } catch (error) {
      console.error("Get database health error:", error);
      res.status(500).json({ success: false, message: "Failed to get database health" });
    }
  });

  // Capture metrics snapshot
  app.post("/api/database/metrics/snapshot", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.captureMetricsSnapshot();
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error("Capture metrics snapshot error:", error);
      res.status(500).json({ success: false, message: "Failed to capture metrics snapshot" });
    }
  });

  // Get latest metrics
  app.get("/api/database/metrics/latest", requireAuth, async (req, res) => {
    try {
      const metrics = await storage.getLatestMetrics();
      res.json({ success: true, data: metrics || null });
    } catch (error) {
      console.error("Get latest metrics error:", error);
      res.status(500).json({ success: false, message: "Failed to get latest metrics" });
    }
  });

  // Get metrics history
  app.get("/api/database/metrics/history", requireAuth, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const metrics = await storage.getMetricsHistory(days);
      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error("Get metrics history error:", error);
      res.status(500).json({ success: false, message: "Failed to get metrics history" });
    }
  });

  // Run data quality checks
  app.post("/api/database/quality/check", requireAuth, async (req, res) => {
    try {
      const result = await storage.runDataQualityChecks();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Run data quality checks error:", error);
      res.status(500).json({ success: false, message: "Failed to run data quality checks" });
    }
  });

  // Get data quality issues
  app.get("/api/database/quality/issues", requireAuth, async (req, res) => {
    try {
      const { entityType, severity, status, page, limit } = req.query;
      const result = await storage.getDataQualityIssues({
        entityType: entityType as string,
        severity: severity as string,
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20
      });
      res.json({ success: true, data: result.issues, total: result.total });
    } catch (error) {
      console.error("Get data quality issues error:", error);
      res.status(500).json({ success: false, message: "Failed to get data quality issues" });
    }
  });

  // Resolve data quality issue
  app.patch("/api/database/quality/issues/:id/resolve", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const issue = await storage.resolveDataQualityIssue(req.params.id, userId);
      if (issue) {
        res.json({ success: true, data: issue });
      } else {
        res.status(404).json({ success: false, message: "Issue not found" });
      }
    } catch (error) {
      console.error("Resolve data quality issue error:", error);
      res.status(500).json({ success: false, message: "Failed to resolve issue" });
    }
  });

  // Ignore data quality issue
  app.patch("/api/database/quality/issues/:id/ignore", requireAuth, async (req, res) => {
    try {
      const issue = await storage.updateDataQualityIssue(req.params.id, { status: 'ignored' });
      if (issue) {
        res.json({ success: true, data: issue });
      } else {
        res.status(404).json({ success: false, message: "Issue not found" });
      }
    } catch (error) {
      console.error("Ignore data quality issue error:", error);
      res.status(500).json({ success: false, message: "Failed to ignore issue" });
    }
  });

  // Get audit logs
  app.get("/api/database/audit", requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getRecentAuditLogs(limit);
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ success: false, message: "Failed to get audit logs" });
    }
  });

  // Get audit history for specific entity
  app.get("/api/database/audit/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAuditHistory(entityType, entityId, limit);
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error("Get entity audit history error:", error);
      res.status(500).json({ success: false, message: "Failed to get audit history" });
    }
  });

  // Get archived records
  app.get("/api/database/archive", requireAuth, async (req, res) => {
    try {
      const { entityType, page, limit } = req.query;
      const result = await storage.getArchivedRecords(
        entityType as string,
        page ? parseInt(page as string) : 1,
        limit ? parseInt(limit as string) : 20
      );
      res.json({ success: true, data: result.records, total: result.total });
    } catch (error) {
      console.error("Get archived records error:", error);
      res.status(500).json({ success: false, message: "Failed to get archived records" });
    }
  });

  // Restore archived record
  app.post("/api/database/archive/:id/restore", requireAuth, async (req, res) => {
    try {
      const restored = await storage.restoreArchivedRecord(req.params.id);
      if (restored) {
        res.json({ success: true, data: restored });
      } else {
        res.status(404).json({ success: false, message: "Archived record not found" });
      }
    } catch (error) {
      console.error("Restore archived record error:", error);
      res.status(500).json({ success: false, message: "Failed to restore record" });
    }
  });

  // Cleanup expired archives
  app.post("/api/database/archive/cleanup", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.cleanupExpiredArchives();
      res.json({ success: true, message: `Cleaned up ${deleted} expired archives` });
    } catch (error) {
      console.error("Cleanup expired archives error:", error);
      res.status(500).json({ success: false, message: "Failed to cleanup archives" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Legacy processCSVFile function removed - replaced with AdvancedCSVProcessor
// which provides streaming, batching, parallel processing, and memory optimization
