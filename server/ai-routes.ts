import { Router, Request, Response } from "express";
import { aiService } from "./openrouter-ai-service";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { z } from "zod";

const router = Router();

router.use(requireAuth);

const enrichContactSchema = z.object({
  contactId: z.string(),
});

const detectDuplicatesSchema = z.object({
  contactIds: z.array(z.string()).optional(),
  limit: z.number().optional().default(100),
});

const naturalLanguageSearchSchema = z.object({
  query: z.string().min(1),
});

const contactSummarySchema = z.object({
  contactId: z.string(),
});

const bulkEnrichSchema = z.object({
  contactIds: z.array(z.string()),
});

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const configured = aiService.isConfigured();
    res.json({
      success: true,
      data: {
        configured,
        model: "google/gemini-2.0-flash-exp:free",
        provider: "OpenRouter",
        features: [
          "Contact Enrichment",
          "Duplicate Detection",
          "Natural Language Search",
          "Contact Summaries",
          "Predictive Lead Scoring",
          "Sales Intelligence",
          "AI Email Generation",
          "Activity Pattern Analysis",
          "Next Best Actions",
          "Company Fit Analysis",
        ],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/enrich-contact", async (req: Request, res: Response) => {
  try {
    const parsed = enrichContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const contact = await storage.getContact(parsed.data.contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Contact not found",
      });
    }

    const enrichment = await aiService.enrichContact({
      fullName: contact.fullName,
      email: contact.email ?? undefined,
      company: contact.company ?? undefined,
      title: contact.title ?? undefined,
      industry: contact.industry ?? undefined,
      website: contact.website ?? undefined,
    });

    const updates: Record<string, any> = {};
    if (enrichment.suggestedIndustry && !contact.industry) {
      updates.industry = enrichment.suggestedIndustry;
    }
    if (enrichment.suggestedBusinessType && !contact.businessType) {
      updates.businessType = enrichment.suggestedBusinessType;
    }
    if (enrichment.leadScore !== undefined) {
      updates.leadScore = String(enrichment.leadScore);
    }

    let updatedContact = contact;
    if (Object.keys(updates).length > 0) {
      updatedContact = await storage.updateContact(contact.id, updates) ?? contact;
      
      await storage.createContactActivity({
        contactId: contact.id,
        activityType: "enriched",
        description: `AI enriched: ${Object.keys(updates).join(", ")}`,
        changes: { enrichment, updates },
      });
    }

    res.json({
      success: true,
      data: {
        contact: updatedContact,
        enrichment,
        fieldsUpdated: Object.keys(updates),
      },
    });
  } catch (error) {
    console.error("[AI Routes] Enrich contact error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/detect-duplicates", async (req: Request, res: Response) => {
  try {
    const parsed = detectDuplicatesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    let contacts;
    if (parsed.data.contactIds && parsed.data.contactIds.length > 0) {
      const allContacts = await Promise.all(
        parsed.data.contactIds.map(id => storage.getContact(id))
      );
      contacts = allContacts.filter((c): c is NonNullable<typeof c> => c !== undefined);
    } else {
      const result = await storage.getContacts({ limit: parsed.data.limit });
      contacts = result.contacts;
    }

    const contactsForAI = contacts.map(c => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email ?? undefined,
      company: c.company ?? undefined,
    }));

    const duplicates = await aiService.detectDuplicates(contactsForAI);

    res.json({
      success: true,
      data: {
        duplicates,
        analyzed: contacts.length,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Detect duplicates error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/search", async (req: Request, res: Response) => {
  try {
    const parsed = naturalLanguageSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const searchResult = await aiService.naturalLanguageSearch(parsed.data.query);

    const contacts = await storage.getContacts({
      page: 1,
      limit: 50,
      industry: searchResult.filters.industry,
      country: searchResult.filters.country,
      employeeSizeBracket: searchResult.filters.employeeSizeBracket,
      search: searchResult.filters.title || searchResult.filters.company,
    });

    res.json({
      success: true,
      data: {
        query: parsed.data.query,
        interpretation: searchResult.interpretation,
        filters: searchResult.filters,
        contacts: contacts.contacts,
        total: contacts.total,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Natural language search error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/contact-summary", async (req: Request, res: Response) => {
  try {
    const parsed = contactSummarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const contact = await storage.getContact(parsed.data.contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Contact not found",
      });
    }

    const summary = await aiService.generateContactSummary({
      fullName: contact.fullName,
      email: contact.email ?? undefined,
      company: contact.company ?? undefined,
      title: contact.title ?? undefined,
      industry: contact.industry ?? undefined,
      leadScore: contact.leadScore ? Number(contact.leadScore) : undefined,
      city: contact.city ?? undefined,
      country: contact.country ?? undefined,
    });

    res.json({
      success: true,
      data: {
        contactId: contact.id,
        summary,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Contact summary error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/bulk-enrich", async (req: Request, res: Response) => {
  try {
    const parsed = bulkEnrichSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const results: Array<{
      contactId: string;
      success: boolean;
      enrichment?: any;
      fieldsUpdated?: string[];
      error?: string;
    }> = [];

    for (const contactId of parsed.data.contactIds) {
      try {
        const contact = await storage.getContact(contactId);
        if (!contact) {
          results.push({ contactId, success: false, error: "Contact not found" });
          continue;
        }

        const enrichment = await aiService.enrichContact({
          fullName: contact.fullName,
          email: contact.email ?? undefined,
          company: contact.company ?? undefined,
          title: contact.title ?? undefined,
          industry: contact.industry ?? undefined,
          website: contact.website ?? undefined,
        });

        const updates: Record<string, any> = {};
        if (enrichment.suggestedIndustry && !contact.industry) {
          updates.industry = enrichment.suggestedIndustry;
        }
        if (enrichment.suggestedBusinessType && !contact.businessType) {
          updates.businessType = enrichment.suggestedBusinessType;
        }
        if (enrichment.leadScore !== undefined) {
          updates.leadScore = String(enrichment.leadScore);
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateContact(contact.id, updates);
          await storage.createContactActivity({
            contactId: contact.id,
            activityType: "enriched",
            description: `AI enriched: ${Object.keys(updates).join(", ")}`,
            changes: { enrichment, updates },
          });
        }

        results.push({
          contactId,
          success: true,
          enrichment,
          fieldsUpdated: Object.keys(updates),
        });
      } catch (error) {
        results.push({
          contactId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      data: {
        summary: {
          total: parsed.data.contactIds.length,
          successful: successCount,
          failed: failedCount,
        },
        results,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Bulk enrich error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/usage", async (_req: Request, res: Response) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured",
      });
    }

    const stats = await aiService.getUsageStats(30);

    res.json({
      success: true,
      data: {
        period: "30 days",
        ...stats,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Usage stats error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/cleanup-cache", async (_req: Request, res: Response) => {
  try {
    const deleted = await aiService.cleanupExpiredCache();
    res.json({
      success: true,
      data: {
        deletedCacheEntries: deleted,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Cache cleanup error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============ ENTERPRISE AI FEATURES ============

const predictiveScoreSchema = z.object({
  contactId: z.string(),
});

router.post("/predictive-score", async (req: Request, res: Response) => {
  try {
    const parsed = predictiveScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const contact = await storage.getContact(parsed.data.contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Contact not found",
      });
    }

    const activities = await storage.getContactActivities(contact.id);
    const activityData = activities.map(a => ({
      type: a.activityType,
      date: a.createdAt?.toISOString() ?? "",
      description: a.description,
    }));

    const prediction = await aiService.predictiveLeadScore({
      fullName: contact.fullName,
      email: contact.email ?? undefined,
      company: contact.company ?? undefined,
      title: contact.title ?? undefined,
      industry: contact.industry ?? undefined,
      employees: contact.employees ?? undefined,
      website: contact.website ?? undefined,
      city: contact.city ?? undefined,
      country: contact.country ?? undefined,
      activities: activityData,
    });

    res.json({
      success: true,
      data: {
        contactId: contact.id,
        contactName: contact.fullName,
        prediction,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Predictive score error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/sales-insights", async (_req: Request, res: Response) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const result = await storage.getContacts({ limit: 100 });
    const contacts = result.contacts.map(c => ({
      id: c.id,
      fullName: c.fullName,
      company: c.company ?? undefined,
      industry: c.industry ?? undefined,
      title: c.title ?? undefined,
      leadScore: c.leadScore ? Number(c.leadScore) : undefined,
      country: c.country ?? undefined,
    }));

    const insights = await aiService.generateSalesInsights(contacts);

    res.json({
      success: true,
      data: {
        contactsAnalyzed: contacts.length,
        insights,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Sales insights error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const generateEmailSchema = z.object({
  contactId: z.string(),
  purpose: z.string().min(1),
  tone: z.enum(["formal", "friendly", "professional", "casual"]).default("professional"),
  senderName: z.string().min(1),
  senderCompany: z.string().optional(),
  context: z.string().optional(),
});

router.post("/generate-email", async (req: Request, res: Response) => {
  try {
    const parsed = generateEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const contact = await storage.getContact(parsed.data.contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Contact not found",
      });
    }

    const email = await aiService.generateEmail({
      contactName: contact.fullName,
      contactTitle: contact.title ?? undefined,
      contactCompany: contact.company ?? undefined,
      senderName: parsed.data.senderName,
      senderCompany: parsed.data.senderCompany,
      purpose: parsed.data.purpose,
      tone: parsed.data.tone,
      context: parsed.data.context,
    });

    res.json({
      success: true,
      data: {
        contactId: contact.id,
        email,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Generate email error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/activity-analysis", async (_req: Request, res: Response) => {
  try {
    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const allActivities = await storage.getAllContactActivities(100);
    const activitiesForAI = allActivities.map(a => ({
      type: a.activityType,
      description: a.description,
      createdAt: a.createdAt?.toISOString() ?? "",
      contactId: a.contactId ?? undefined,
    }));

    const analysis = await aiService.analyzeActivityPattern(activitiesForAI);

    res.json({
      success: true,
      data: {
        activitiesAnalyzed: activitiesForAI.length,
        analysis,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Activity analysis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const nextActionsSchema = z.object({
  contactId: z.string(),
});

router.post("/next-actions", async (req: Request, res: Response) => {
  try {
    const parsed = nextActionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    const contact = await storage.getContact(parsed.data.contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Contact not found",
      });
    }

    const activities = await storage.getContactActivities(contact.id);
    const lastActivity = activities[0];
    const activityData = activities.slice(0, 5).map(a => ({
      type: a.activityType,
      description: a.description,
      date: a.createdAt?.toISOString() ?? "",
    }));

    const actions = await aiService.suggestNextActions({
      fullName: contact.fullName,
      email: contact.email ?? undefined,
      company: contact.company ?? undefined,
      title: contact.title ?? undefined,
      industry: contact.industry ?? undefined,
      leadScore: contact.leadScore ? Number(contact.leadScore) : undefined,
      lastActivityDate: lastActivity?.createdAt?.toISOString(),
      activities: activityData,
    });

    res.json({
      success: true,
      data: {
        contactId: contact.id,
        contactName: contact.fullName,
        actions,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Next actions error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

const companyFitSchema = z.object({
  companyId: z.string().optional(),
  companyName: z.string().optional(),
  targetIndustries: z.array(z.string()).optional(),
  minEmployees: z.number().optional(),
  maxEmployees: z.number().optional(),
});

router.post("/company-fit", async (req: Request, res: Response) => {
  try {
    const parsed = companyFitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request body",
        details: parsed.error.errors,
      });
    }

    if (!aiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: "AI service not configured. Please add OPENROUTER_API_KEY to secrets.",
      });
    }

    let company;
    if (parsed.data.companyId) {
      company = await storage.getCompany(parsed.data.companyId);
    } else if (parsed.data.companyName) {
      const companies = await storage.searchCompanies(parsed.data.companyName, 1);
      company = companies[0];
    }

    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found",
      });
    }

    const fitAnalysis = await aiService.analyzeCompanyFit(
      {
        name: company.name,
        industry: company.industry ?? undefined,
        employees: company.employees ?? undefined,
        website: company.website ?? undefined,
        annualRevenue: company.annualRevenue ?? undefined,
        technologies: company.technologies ?? undefined,
        country: company.country ?? undefined,
      },
      parsed.data.targetIndustries || parsed.data.minEmployees || parsed.data.maxEmployees
        ? {
            targetIndustries: parsed.data.targetIndustries,
            minEmployees: parsed.data.minEmployees,
            maxEmployees: parsed.data.maxEmployees,
          }
        : undefined
    );

    res.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.name,
        fitAnalysis,
      },
    });
  } catch (error) {
    console.error("[AI Routes] Company fit error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
