import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { enrichContactData } from "../client/src/lib/data-enrichment";
import { linkedinEnrichmentService } from "./linkedin-enrichment";
import {
  API_PREFIX,
  API_VERSION,
  API_SCOPES,
  SCOPE_DESCRIPTIONS,
  ERROR_CODES,
  traceMiddleware,
  validateApiKeyV1,
  requireScopes,
  validateBody,
  validateQuery,
  sendApiError,
  sendApiSuccess,
  paginationSchema,
  contactFilterSchema,
  createContactSchema,
  updateContactSchema,
  bulkCreateContactsSchema,
  bulkUpdateContactsSchema,
  bulkDeleteContactsSchema,
  enrichmentSearchSchema,
  createEnrichmentJobSchema,
  bulkEnrichmentSchema,
  createTagSchema,
  addTagToContactSchema,
} from "./api-v1-middleware";

const router = Router();

router.use(traceMiddleware);

router.get("/", (req: Request, res: Response) => {
  sendApiSuccess(res, {
    name: "CRM Public API",
    version: API_VERSION,
    documentation: "/api/v1/docs",
    endpoints: {
      contacts: {
        list: "GET /api/v1/contacts",
        get: "GET /api/v1/contacts/:id",
        create: "POST /api/v1/contacts",
        update: "PATCH /api/v1/contacts/:id",
        delete: "DELETE /api/v1/contacts/:id",
        bulkCreate: "POST /api/v1/contacts/bulk",
        bulkUpdate: "PATCH /api/v1/contacts/bulk",
        bulkDelete: "DELETE /api/v1/contacts/bulk",
      },
      enrichment: {
        search: "POST /api/v1/enrichment/search",
        createJob: "POST /api/v1/enrichment/jobs",
        listJobs: "GET /api/v1/enrichment/jobs",
        getJob: "GET /api/v1/enrichment/jobs/:id",
        bulkEnrich: "POST /api/v1/enrichment/jobs/bulk",
      },
      tags: {
        list: "GET /api/v1/tags",
        create: "POST /api/v1/tags",
        delete: "DELETE /api/v1/tags/:id",
        addToContact: "POST /api/v1/contacts/:id/tags",
        removeFromContact: "DELETE /api/v1/contacts/:id/tags/:tagId",
      },
      activities: {
        list: "GET /api/v1/activities",
        byContact: "GET /api/v1/contacts/:id/activities",
      },
      stats: {
        overview: "GET /api/v1/stats",
        comprehensive: "GET /api/v1/stats/comprehensive",
      },
      schema: {
        fields: "GET /api/v1/schema/contacts",
        scopes: "GET /api/v1/schema/scopes",
      },
    },
    authentication: {
      method: "API Key",
      headers: ["Authorization: Bearer <api-key>", "X-API-Key: <api-key>"],
    },
  });
});

router.get("/schema/contacts", (req: Request, res: Response) => {
  sendApiSuccess(res, {
    fields: {
      personal: {
        fullName: { type: "string", required: false, description: "Full name (auto-generated from firstName + lastName if not provided)" },
        firstName: { type: "string", required: false, description: "First name" },
        lastName: { type: "string", required: false, description: "Last name" },
        email: { type: "string", required: false, format: "email", description: "Email address" },
        title: { type: "string", required: false, description: "Job title" },
      },
      phones: {
        mobilePhone: { type: "string", required: false, description: "Mobile phone number" },
        otherPhone: { type: "string", required: false, description: "Other phone number" },
        homePhone: { type: "string", required: false, description: "Home phone number" },
        corporatePhone: { type: "string", required: false, description: "Corporate phone number" },
      },
      company: {
        company: { type: "string", required: false, description: "Company name" },
        employees: { type: "integer", required: false, description: "Number of employees" },
        employeeSizeBracket: { type: "string", required: false, description: "Employee size bracket (e.g., '1-10', '11-50')" },
        industry: { type: "string", required: false, description: "Industry sector" },
        website: { type: "string", required: false, format: "url", description: "Company website" },
        companyLinkedIn: { type: "string", required: false, format: "url", description: "Company LinkedIn URL" },
        technologies: { type: "array", items: "string", required: false, description: "Technologies used" },
        annualRevenue: { type: "string", required: false, description: "Annual revenue" },
      },
      social: {
        personLinkedIn: { type: "string", required: false, format: "url", description: "Personal LinkedIn URL" },
      },
      location: {
        city: { type: "string", required: false, description: "City" },
        state: { type: "string", required: false, description: "State/Province" },
        country: { type: "string", required: false, description: "Country" },
        companyAddress: { type: "string", required: false, description: "Company street address" },
        companyCity: { type: "string", required: false, description: "Company city" },
        companyState: { type: "string", required: false, description: "Company state" },
        companyCountry: { type: "string", required: false, description: "Company country" },
      },
      enriched: {
        emailDomain: { type: "string", readOnly: true, description: "Email domain (auto-enriched)" },
        countryCode: { type: "string", readOnly: true, description: "Country code (auto-enriched)" },
        timezone: { type: "string", readOnly: true, description: "Timezone (auto-enriched)" },
        leadScore: { type: "number", readOnly: true, description: "Lead score (auto-calculated)" },
        companyAge: { type: "integer", readOnly: true, description: "Company age in years (auto-enriched)" },
        technologyCategory: { type: "string", readOnly: true, description: "Technology category (auto-enriched)" },
        region: { type: "string", readOnly: true, description: "Geographic region (auto-enriched)" },
        businessType: { type: "string", readOnly: true, description: "Business type (auto-enriched)" },
      },
      metadata: {
        id: { type: "string", readOnly: true, description: "Unique identifier" },
        createdAt: { type: "datetime", readOnly: true, description: "Creation timestamp" },
        updatedAt: { type: "datetime", readOnly: true, description: "Last update timestamp" },
      },
    },
    industries: [
      "Technology", "Healthcare", "Finance", "Manufacturing", "Retail",
      "Education", "Real Estate", "Consulting", "Marketing", "Legal",
      "Energy", "Transportation", "Hospitality", "Media", "Agriculture",
    ],
    employeeSizeBrackets: [
      "1-10", "11-50", "51-200", "201-500", "501-1000",
      "1001-5000", "5001-10000", "10000+",
    ],
  });
});

router.get("/schema/scopes", (req: Request, res: Response) => {
  sendApiSuccess(res, {
    scopes: Object.entries(SCOPE_DESCRIPTIONS).map(([scope, description]) => ({
      scope,
      description,
    })),
    scopeGroups: {
      contacts: [API_SCOPES.CONTACTS_READ, API_SCOPES.CONTACTS_WRITE, API_SCOPES.CONTACTS_DELETE, API_SCOPES.CONTACTS_BULK],
      enrichment: [API_SCOPES.ENRICHMENT_RUN, API_SCOPES.ENRICHMENT_READ],
      analytics: [API_SCOPES.STATS_READ],
      tags: [API_SCOPES.TAGS_READ, API_SCOPES.TAGS_WRITE],
      activities: [API_SCOPES.ACTIVITIES_READ],
    },
  });
});

router.get(
  "/contacts",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_READ),
  validateQuery(contactFilterSchema),
  async (req: Request, res: Response) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        search,
        industry,
        employeeSizeBracket,
        country,
        sortBy = "createdAt",
        sortOrder = "desc",
        leadScoreMin,
        leadScoreMax,
        updatedSince,
        createdSince,
        hasEmail,
        hasPhone,
        hasLinkedIn,
      } = req.query as any;

      const result = await storage.getContacts({
        page,
        limit: pageSize,
        search,
        industry,
        employeeSizeBracket,
        country,
        sortBy,
        sortOrder,
      });

      let filteredContacts = result.contacts;

      if (leadScoreMin !== undefined) {
        filteredContacts = filteredContacts.filter(c => 
          c.leadScore !== null && parseFloat(String(c.leadScore)) >= leadScoreMin
        );
      }
      if (leadScoreMax !== undefined) {
        filteredContacts = filteredContacts.filter(c => 
          c.leadScore !== null && parseFloat(String(c.leadScore)) <= leadScoreMax
        );
      }
      if (updatedSince) {
        const sinceDate = new Date(updatedSince);
        filteredContacts = filteredContacts.filter(c => 
          c.updatedAt && new Date(c.updatedAt) >= sinceDate
        );
      }
      if (createdSince) {
        const sinceDate = new Date(createdSince);
        filteredContacts = filteredContacts.filter(c => 
          c.createdAt && new Date(c.createdAt) >= sinceDate
        );
      }
      if (hasEmail) {
        filteredContacts = filteredContacts.filter(c => c.email && c.email.trim() !== "");
      }
      if (hasPhone) {
        filteredContacts = filteredContacts.filter(c => 
          (c.mobilePhone && c.mobilePhone.trim() !== "") ||
          (c.corporatePhone && c.corporatePhone.trim() !== "")
        );
      }
      if (hasLinkedIn) {
        filteredContacts = filteredContacts.filter(c => 
          c.personLinkedIn && c.personLinkedIn.trim() !== ""
        );
      }

      const totalPages = Math.ceil(result.total / pageSize);

      sendApiSuccess(res, {
        contacts: filteredContacts.map(c => ({
          id: c.id,
          fullName: c.fullName,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          title: c.title,
          company: c.company,
          mobilePhone: c.mobilePhone,
          otherPhone: c.otherPhone,
          homePhone: c.homePhone,
          corporatePhone: c.corporatePhone,
          employees: c.employees,
          employeeSizeBracket: c.employeeSizeBracket,
          industry: c.industry,
          website: c.website,
          companyLinkedIn: c.companyLinkedIn,
          technologies: c.technologies,
          annualRevenue: c.annualRevenue,
          personLinkedIn: c.personLinkedIn,
          city: c.city,
          state: c.state,
          country: c.country,
          companyAddress: c.companyAddress,
          companyCity: c.companyCity,
          companyState: c.companyState,
          companyCountry: c.companyCountry,
          emailDomain: c.emailDomain,
          countryCode: c.countryCode,
          timezone: c.timezone,
          leadScore: c.leadScore,
          companyAge: c.companyAge,
          technologyCategory: c.technologyCategory,
          region: c.region,
          businessType: c.businessType,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      }, {
        page,
        pageSize,
        totalItems: result.total,
        totalPages,
      });
    } catch (error) {
      console.error("[API v1] List contacts error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch contacts");
    }
  }
);

router.get(
  "/contacts/:id",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_READ),
  async (req: Request, res: Response) => {
    try {
      const contact = await storage.getContact(req.params.id);
      
      if (!contact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      sendApiSuccess(res, { contact });
    } catch (error) {
      console.error("[API v1] Get contact error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch contact");
    }
  }
);

router.post(
  "/contacts",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_WRITE),
  validateBody(createContactSchema),
  async (req: Request, res: Response) => {
    try {
      const rawData = req.body;
      
      if (!rawData.fullName && (rawData.firstName || rawData.lastName)) {
        const first = rawData.firstName?.trim() || "";
        const last = rawData.lastName?.trim() || "";
        rawData.fullName = [first, last].filter(Boolean).join(" ");
      }
      
      if (!rawData.fullName && rawData.email) {
        rawData.fullName = rawData.email.split("@")[0];
      }

      if (rawData.email) {
        const duplicates = await storage.findDuplicateContacts(rawData.email, rawData.company || undefined);
        if (duplicates.length > 0) {
          sendApiError(res, 409, ERROR_CODES.DUPLICATE_RESOURCE, 
            "A contact with this email already exists",
            { existingContacts: duplicates.map(d => ({ id: d.id, email: d.email, company: d.company })) }
          );
          return;
        }
      }

      const enrichedData = await enrichContactData(rawData);
      const contact = await storage.createContactWithAutoFill(enrichedData);

      await storage.createContactActivity({
        contactId: contact.id,
        activityType: "created",
        description: "Contact created via API v1",
      });

      sendApiSuccess(res, { contact }, undefined, 201);
    } catch (error) {
      console.error("[API v1] Create contact error:", error);
      if (error instanceof z.ZodError) {
        sendApiError(res, 400, ERROR_CODES.VALIDATION_ERROR, "Invalid contact data", error.errors);
        return;
      }
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to create contact");
    }
  }
);

router.patch(
  "/contacts/:id",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_WRITE),
  validateBody(updateContactSchema),
  async (req: Request, res: Response) => {
    try {
      const existingContact = await storage.getContact(req.params.id);
      if (!existingContact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      const cleanedUpdates = Object.fromEntries(
        Object.entries(req.body).map(([key, value]) => [
          key, 
          value === "" ? null : value
        ])
      );

      const contact = await storage.updateContactWithAutoFill(req.params.id, cleanedUpdates);

      sendApiSuccess(res, { contact });
    } catch (error) {
      console.error("[API v1] Update contact error:", error);
      if (error instanceof z.ZodError) {
        sendApiError(res, 400, ERROR_CODES.VALIDATION_ERROR, "Invalid update data", error.errors);
        return;
      }
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to update contact");
    }
  }
);

router.delete(
  "/contacts/:id",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_DELETE),
  async (req: Request, res: Response) => {
    try {
      const existingContact = await storage.getContact(req.params.id);
      if (!existingContact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      await storage.deleteContact(req.params.id);

      sendApiSuccess(res, { 
        message: "Contact deleted successfully",
        deletedId: req.params.id,
      });
    } catch (error) {
      console.error("[API v1] Delete contact error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to delete contact");
    }
  }
);

router.post(
  "/contacts/bulk",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_BULK),
  validateBody(bulkCreateContactsSchema),
  async (req: Request, res: Response) => {
    try {
      const { contacts } = req.body;
      const results: { index: number; success: boolean; contact?: any; error?: string }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        const contactData = { ...contacts[i] };
        
        try {
          if (!contactData.fullName) {
            if (contactData.firstName || contactData.lastName) {
              const firstName = contactData.firstName?.trim() || "";
              const lastName = contactData.lastName?.trim() || "";
              contactData.fullName = [firstName, lastName].filter(Boolean).join(" ");
            } else if (contactData.email) {
              contactData.fullName = contactData.email.split("@")[0];
            }
          }

          const enrichedData = await enrichContactData(contactData);
          const contact = await storage.createContactWithAutoFill(enrichedData);

          await storage.createContactActivity({
            contactId: contact.id,
            activityType: "created",
            description: "Contact created via API v1 (bulk)",
          });

          results.push({
            index: i,
            success: true,
            contact: { id: contact.id, fullName: contact.fullName, email: contact.email },
          });
          successCount++;
        } catch (error) {
          results.push({
            index: i,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      sendApiSuccess(res, {
        summary: {
          total: contacts.length,
          created: successCount,
          failed: errorCount,
        },
        results,
      }, undefined, successCount > 0 ? 201 : 400);
    } catch (error) {
      console.error("[API v1] Bulk create contacts error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to create contacts in bulk");
    }
  }
);

router.patch(
  "/contacts/bulk",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_BULK),
  validateBody(bulkUpdateContactsSchema),
  async (req: Request, res: Response) => {
    try {
      const { contacts } = req.body;
      const results: { id: string; success: boolean; error?: string }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const item of contacts) {
        try {
          const cleanedUpdates = Object.fromEntries(
            Object.entries(item.updates).map(([key, value]) => [
              key, 
              value === "" ? null : value
            ])
          );

          const contact = await storage.updateContactWithAutoFill(item.id, cleanedUpdates);
          
          if (contact) {
            results.push({ id: item.id, success: true });
            successCount++;
          } else {
            results.push({ id: item.id, success: false, error: "Contact not found" });
            errorCount++;
          }
        } catch (error) {
          results.push({
            id: item.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      sendApiSuccess(res, {
        summary: {
          total: contacts.length,
          updated: successCount,
          failed: errorCount,
        },
        results,
      });
    } catch (error) {
      console.error("[API v1] Bulk update contacts error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to update contacts in bulk");
    }
  }
);

router.delete(
  "/contacts/bulk",
  validateApiKeyV1,
  requireScopes(API_SCOPES.CONTACTS_BULK, API_SCOPES.CONTACTS_DELETE),
  validateBody(bulkDeleteContactsSchema),
  async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      const results: { id: string; success: boolean; error?: string }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        try {
          const deleted = await storage.deleteContact(id);
          if (deleted) {
            results.push({ id, success: true });
            successCount++;
          } else {
            results.push({ id, success: false, error: "Contact not found" });
            errorCount++;
          }
        } catch (error) {
          results.push({
            id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      sendApiSuccess(res, {
        summary: {
          total: ids.length,
          deleted: successCount,
          failed: errorCount,
        },
        results,
      });
    } catch (error) {
      console.error("[API v1] Bulk delete contacts error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to delete contacts in bulk");
    }
  }
);

router.post(
  "/enrichment/search",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ENRICHMENT_READ),
  validateBody(enrichmentSearchSchema),
  async (req: Request, res: Response) => {
    try {
      const { linkedinUrl } = req.body;
      
      const existingContacts = await storage.findContactsByLinkedInUrl(linkedinUrl);
      
      sendApiSuccess(res, {
        linkedinUrl,
        matchingContacts: existingContacts.map(c => ({
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          company: c.company,
          title: c.title,
          personLinkedIn: c.personLinkedIn,
        })),
        matchCount: existingContacts.length,
      });
    } catch (error) {
      console.error("[API v1] Enrichment search error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to search LinkedIn URL");
    }
  }
);

router.post(
  "/enrichment/jobs",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ENRICHMENT_RUN),
  validateBody(createEnrichmentJobSchema),
  async (req: Request, res: Response) => {
    try {
      const { linkedinUrl, contactId } = req.body;

      if (contactId) {
        const contact = await storage.getContact(contactId);
        if (!contact) {
          sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
          return;
        }
      }

      const job = await storage.createEnrichmentJob({
        linkedinUrl,
        contactId: contactId || null,
        status: "pending",
        provider: "proxycurl",
      });

      sendApiSuccess(res, {
        job: {
          id: job.id,
          linkedinUrl: job.linkedinUrl,
          contactId: job.contactId,
          status: job.status,
          provider: job.provider,
          createdAt: job.createdAt,
        },
        message: "Enrichment job created. Check status using GET /api/v1/enrichment/jobs/:id",
      }, undefined, 201);
    } catch (error) {
      console.error("[API v1] Create enrichment job error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to create enrichment job");
    }
  }
);

router.get(
  "/enrichment/jobs",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ENRICHMENT_READ),
  validateQuery(paginationSchema.extend({
    status: z.enum(["pending", "processing", "completed", "failed"]).optional(),
    contactId: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      const { page = 1, pageSize = 20, status, contactId } = req.query as any;

      let jobs = await storage.getRecentEnrichmentJobs(100);

      if (status) {
        jobs = jobs.filter(j => j.status === status);
      }
      if (contactId) {
        jobs = jobs.filter(j => j.contactId === contactId);
      }

      const startIndex = (page - 1) * pageSize;
      const paginatedJobs = jobs.slice(startIndex, startIndex + pageSize);

      sendApiSuccess(res, {
        jobs: paginatedJobs.map(j => ({
          id: j.id,
          linkedinUrl: j.linkedinUrl,
          contactId: j.contactId,
          status: j.status,
          provider: j.provider,
          enrichedEmail: j.enrichedEmail,
          enrichedPhone: j.enrichedPhone,
          errorMessage: j.errorMessage,
          creditsUsed: j.creditsUsed,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
        })),
      }, {
        page,
        pageSize,
        totalItems: jobs.length,
        totalPages: Math.ceil(jobs.length / pageSize),
      });
    } catch (error) {
      console.error("[API v1] List enrichment jobs error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch enrichment jobs");
    }
  }
);

router.get(
  "/enrichment/jobs/:id",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ENRICHMENT_READ),
  async (req: Request, res: Response) => {
    try {
      const job = await storage.getEnrichmentJob(req.params.id);
      
      if (!job) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Enrichment job not found");
        return;
      }

      sendApiSuccess(res, {
        job: {
          id: job.id,
          linkedinUrl: job.linkedinUrl,
          contactId: job.contactId,
          status: job.status,
          provider: job.provider,
          enrichedEmail: job.enrichedEmail,
          enrichedPhone: job.enrichedPhone,
          enrichedData: job.enrichedData,
          errorMessage: job.errorMessage,
          creditsUsed: job.creditsUsed,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        },
      });
    } catch (error) {
      console.error("[API v1] Get enrichment job error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch enrichment job");
    }
  }
);

router.post(
  "/enrichment/jobs/bulk",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ENRICHMENT_RUN, API_SCOPES.CONTACTS_BULK),
  validateBody(bulkEnrichmentSchema),
  async (req: Request, res: Response) => {
    try {
      const { jobs } = req.body;
      const results: { index: number; success: boolean; job?: any; error?: string }[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < jobs.length; i++) {
        const jobData = jobs[i];
        
        try {
          if (jobData.contactId) {
            const contact = await storage.getContact(jobData.contactId);
            if (!contact) {
              results.push({ index: i, success: false, error: "Contact not found" });
              errorCount++;
              continue;
            }
          }

          const job = await storage.createEnrichmentJob({
            linkedinUrl: jobData.linkedinUrl,
            contactId: jobData.contactId || null,
            status: "pending",
            provider: "proxycurl",
          });

          results.push({
            index: i,
            success: true,
            job: { id: job.id, linkedinUrl: job.linkedinUrl, status: job.status },
          });
          successCount++;
        } catch (error) {
          results.push({
            index: i,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errorCount++;
        }
      }

      sendApiSuccess(res, {
        summary: {
          total: jobs.length,
          created: successCount,
          failed: errorCount,
        },
        results,
      }, undefined, successCount > 0 ? 201 : 400);
    } catch (error) {
      console.error("[API v1] Bulk enrichment error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to create enrichment jobs in bulk");
    }
  }
);

router.get(
  "/tags",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_READ),
  async (req: Request, res: Response) => {
    try {
      const tags = await storage.getTags();
      sendApiSuccess(res, { tags });
    } catch (error) {
      console.error("[API v1] List tags error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch tags");
    }
  }
);

router.post(
  "/tags",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_WRITE),
  validateBody(createTagSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, color, description } = req.body;
      const apiKey = req.apiKey!;

      const tag = await storage.createTag({
        name,
        color: color || "#6366f1",
        description,
        ownerUserId: apiKey.ownerUserId,
      });

      sendApiSuccess(res, { tag }, undefined, 201);
    } catch (error) {
      console.error("[API v1] Create tag error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to create tag");
    }
  }
);

router.delete(
  "/tags/:id",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_WRITE),
  async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTag(req.params.id);
      
      if (!deleted) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Tag not found");
        return;
      }

      sendApiSuccess(res, { 
        message: "Tag deleted successfully",
        deletedId: req.params.id,
      });
    } catch (error) {
      console.error("[API v1] Delete tag error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to delete tag");
    }
  }
);

router.get(
  "/contacts/:id/tags",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_READ),
  async (req: Request, res: Response) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      const tags = await storage.getContactTags(req.params.id);
      sendApiSuccess(res, { contactId: req.params.id, tags });
    } catch (error) {
      console.error("[API v1] Get contact tags error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch contact tags");
    }
  }
);

router.post(
  "/contacts/:id/tags",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_WRITE),
  validateBody(addTagToContactSchema),
  async (req: Request, res: Response) => {
    try {
      const { tagId } = req.body;
      const contactId = req.params.id;

      const contact = await storage.getContact(contactId);
      if (!contact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      const tag = await storage.getTag(tagId);
      if (!tag) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Tag not found");
        return;
      }

      await storage.addTagToContact(contactId, tagId);

      await storage.createContactActivity({
        contactId,
        activityType: "updated",
        description: `Tag "${tag.name}" added via API v1`,
      });

      sendApiSuccess(res, { 
        message: "Tag added to contact successfully",
        contactId,
        tagId,
      }, undefined, 201);
    } catch (error) {
      console.error("[API v1] Add tag to contact error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to add tag to contact");
    }
  }
);

router.delete(
  "/contacts/:id/tags/:tagId",
  validateApiKeyV1,
  requireScopes(API_SCOPES.TAGS_WRITE),
  async (req: Request, res: Response) => {
    try {
      const { id: contactId, tagId } = req.params;

      const contact = await storage.getContact(contactId);
      if (!contact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      const removed = await storage.removeTagFromContact(contactId, tagId);
      if (!removed) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Tag not found on contact");
        return;
      }

      sendApiSuccess(res, { 
        message: "Tag removed from contact successfully",
        contactId,
        tagId,
      });
    } catch (error) {
      console.error("[API v1] Remove tag from contact error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to remove tag from contact");
    }
  }
);

router.get(
  "/activities",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ACTIVITIES_READ),
  validateQuery(paginationSchema.extend({
    activityType: z.string().optional(),
    contactId: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      const { page = 1, pageSize = 50, activityType, contactId } = req.query as any;

      let activities = await storage.getRecentActivities(500);

      if (activityType) {
        activities = activities.filter(a => a.activityType === activityType);
      }
      if (contactId) {
        activities = activities.filter(a => a.contactId === contactId);
      }

      const startIndex = (page - 1) * pageSize;
      const paginatedActivities = activities.slice(startIndex, startIndex + pageSize);

      sendApiSuccess(res, {
        activities: paginatedActivities.map(a => ({
          id: a.id,
          contactId: a.contactId,
          activityType: a.activityType,
          description: a.description,
          changes: a.changes,
          createdAt: a.createdAt,
        })),
      }, {
        page,
        pageSize,
        totalItems: activities.length,
        totalPages: Math.ceil(activities.length / pageSize),
      });
    } catch (error) {
      console.error("[API v1] List activities error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch activities");
    }
  }
);

router.get(
  "/contacts/:id/activities",
  validateApiKeyV1,
  requireScopes(API_SCOPES.ACTIVITIES_READ),
  async (req: Request, res: Response) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        sendApiError(res, 404, ERROR_CODES.NOT_FOUND, "Contact not found");
        return;
      }

      const activities = await storage.getContactActivities(req.params.id);

      sendApiSuccess(res, {
        contactId: req.params.id,
        activities: activities.map(a => ({
          id: a.id,
          activityType: a.activityType,
          description: a.description,
          changes: a.changes,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      console.error("[API v1] Get contact activities error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch contact activities");
    }
  }
);

router.get(
  "/stats",
  validateApiKeyV1,
  requireScopes(API_SCOPES.STATS_READ),
  async (req: Request, res: Response) => {
    try {
      const stats = await storage.getContactStats();
      
      sendApiSuccess(res, {
        stats: {
          totalContacts: stats.totalContacts,
          totalCompanies: stats.totalCompanies,
          validEmails: stats.validEmails,
          averageLeadScore: stats.averageLeadScore,
        },
      });
    } catch (error) {
      console.error("[API v1] Get stats error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch statistics");
    }
  }
);

router.get(
  "/stats/comprehensive",
  validateApiKeyV1,
  requireScopes(API_SCOPES.STATS_READ),
  async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getComprehensiveAnalytics();
      sendApiSuccess(res, { analytics });
    } catch (error) {
      console.error("[API v1] Get comprehensive stats error:", error);
      sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, "Failed to fetch comprehensive analytics");
    }
  }
);

export const apiV1Router = router;
