import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { validateSession } from "./auth";
import { validateApiKey } from "./api-auth";
import { z } from "zod";

const router = Router();

const linkedinLookupSchema = z.object({
  linkedinUrl: z.string().url().refine(
    (url) => url.includes("linkedin.com"),
    "Must be a LinkedIn URL"
  ),
});

async function checkExtensionUsage(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  message?: string;
}> {
  const user = await storage.getUserById(userId);
  if (!user) {
    return { allowed: false, remaining: 0, limit: 0, message: "User not found" };
  }

  const plan = user.planId ? await storage.getSubscriptionPlan(user.planId) : null;
  
  if (!plan?.canUseChromeExtension) {
    return { 
      allowed: false, 
      remaining: 0, 
      limit: 0, 
      message: "Chrome extension not available on your plan" 
    };
  }

  const limit = plan.extensionLookupLimit || 50;
  const used = user.dailyExtensionUsage || 0;
  const remaining = Math.max(0, limit - used);

  if (remaining === 0) {
    return { 
      allowed: false, 
      remaining: 0, 
      limit, 
      message: "Daily extension lookup limit reached" 
    };
  }

  return { allowed: true, remaining, limit };
}

async function incrementExtensionUsage(userId: string): Promise<void> {
  const user = await storage.getUserById(userId);
  if (user) {
    const today = new Date();
    const resetDate = user.usageResetDate ? new Date(user.usageResetDate) : null;
    
    if (!resetDate || resetDate.toDateString() !== today.toDateString()) {
      await storage.updateUser(userId, {
        dailyExtensionUsage: 1,
        usageResetDate: today,
      });
    } else {
      await storage.updateUser(userId, {
        dailyExtensionUsage: (user.dailyExtensionUsage || 0) + 1,
      });
    }
  }
}

router.get("/validate", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        valid: false, 
        message: "No token provided" 
      });
    }

    const { valid, user } = await validateSession(token);
    
    if (!valid || !user) {
      return res.status(401).json({ 
        valid: false, 
        message: "Invalid or expired token" 
      });
    }

    const fullUser = await storage.getUserById(user.id);
    const plan = fullUser?.planId ? await storage.getSubscriptionPlan(fullUser.planId) : null;

    const usageCheck = await checkExtensionUsage(user.id);

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      plan: plan ? {
        name: plan.name,
        displayName: plan.displayName,
        canUseChromeExtension: plan.canUseChromeExtension,
        extensionLookupLimit: plan.extensionLookupLimit,
      } : null,
      usage: {
        remaining: usageCheck.remaining,
        limit: usageCheck.limit,
        used: usageCheck.limit - usageCheck.remaining,
      },
    });
  } catch (error) {
    console.error("Extension validation error:", error);
    res.status(500).json({ valid: false, message: "Internal server error" });
  }
});

router.post("/lookup", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const { valid, user } = await validateSession(token);
    
    if (!valid || !user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }

    const usageCheck = await checkExtensionUsage(user.id);
    if (!usageCheck.allowed) {
      return res.status(403).json({ 
        success: false, 
        message: usageCheck.message,
        usage: {
          remaining: usageCheck.remaining,
          limit: usageCheck.limit,
        }
      });
    }

    const parsed = linkedinLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid LinkedIn URL" 
      });
    }

    const { linkedinUrl } = parsed.data;
    
    const normalizedUrl = linkedinUrl
      .toLowerCase()
      .replace(/\/$/, "")
      .replace(/^https?:\/\/(www\.)?/, "https://www.");

    const contacts = await storage.findContactsByLinkedInUrl(normalizedUrl);
    
    await incrementExtensionUsage(user.id);

    const updatedUsage = await checkExtensionUsage(user.id);

    if (contacts.length > 0) {
      const contact = contacts[0];
      res.json({
        success: true,
        found: true,
        contact: {
          id: contact.id,
          fullName: contact.fullName,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          mobilePhone: contact.mobilePhone,
          title: contact.title,
          company: contact.company,
          industry: contact.industry,
          website: contact.website,
          personLinkedIn: contact.personLinkedIn,
          companyLinkedIn: contact.companyLinkedIn,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          leadScore: contact.leadScore,
        },
        usage: {
          remaining: updatedUsage.remaining,
          limit: updatedUsage.limit,
        },
      });
    } else {
      res.json({
        success: true,
        found: false,
        message: "No contact found for this LinkedIn profile",
        usage: {
          remaining: updatedUsage.remaining,
          limit: updatedUsage.limit,
        },
      });
    }
  } catch (error) {
    console.error("Extension lookup error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

router.post("/search", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const { valid, user } = await validateSession(token);
    
    if (!valid || !user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }

    const usageCheck = await checkExtensionUsage(user.id);
    if (!usageCheck.allowed) {
      return res.status(403).json({ 
        success: false, 
        message: usageCheck.message,
        usage: {
          remaining: usageCheck.remaining,
          limit: usageCheck.limit,
        }
      });
    }

    const { query, limit = 10 } = req.body;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ 
        success: false, 
        message: "Search query is required" 
      });
    }

    const { contacts } = await storage.getContacts({
      search: query,
      limit: Math.min(limit, 20),
      page: 1,
    });

    await incrementExtensionUsage(user.id);

    const updatedUsage = await checkExtensionUsage(user.id);

    res.json({
      success: true,
      contacts: contacts.map(c => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        title: c.title,
        company: c.company,
        personLinkedIn: c.personLinkedIn,
      })),
      count: contacts.length,
      usage: {
        remaining: updatedUsage.remaining,
        limit: updatedUsage.limit,
      },
    });
  } catch (error) {
    console.error("Extension search error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

export const extensionRouter = router;
