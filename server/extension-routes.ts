import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { validateSession } from "./auth";
import { z } from "zod";

const router = Router();

// CORS middleware for Chrome extension requests
router.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const linkedinLookupSchema = z.object({
  linkedinUrl: z.string().url().refine(
    (url) => url.includes("linkedin.com"),
    "Must be a LinkedIn URL"
  ),
});

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
      } : { name: "free", displayName: "Free" },
      usage: {
        remaining: null,
        limit: null,
        used: 0,
        unlimited: true,
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
          remaining: null,
          limit: null,
          unlimited: true,
        },
      });
    } else {
      res.json({
        success: true,
        found: false,
        message: "No contact found for this LinkedIn profile",
        usage: {
          remaining: null,
          limit: null,
          unlimited: true,
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
        remaining: null,
        limit: null,
        unlimited: true,
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
