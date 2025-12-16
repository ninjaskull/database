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

export default router;
