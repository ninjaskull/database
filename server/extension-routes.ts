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
  linkedinUrl: z.string().url().optional(),
  salesNavigatorUrl: z.string().optional(),
}).refine(
  (data) => data.linkedinUrl || data.salesNavigatorUrl,
  "At least one URL (linkedinUrl or salesNavigatorUrl) is required"
);

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
        message: "At least one URL (linkedinUrl or salesNavigatorUrl) is required" 
      });
    }

    const { linkedinUrl, salesNavigatorUrl } = parsed.data;
    
    let normalizedLinkedInUrl: string | undefined;
    if (linkedinUrl) {
      normalizedLinkedInUrl = linkedinUrl
        .toLowerCase()
        .replace(/\/$/, "")
        .replace(/^https?:\/\/(www\.)?/, "https://www.");
    }

    const contact = await storage.findContactByLinkedInUrls(
      normalizedLinkedInUrl,
      salesNavigatorUrl
    );

    if (contact) {
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
          otherPhone: contact.otherPhone,
          title: contact.title,
          company: contact.company,
          industry: contact.industry,
          website: contact.website,
          city: contact.city,
          state: contact.state,
          country: contact.country,
          leadScore: contact.leadScore,
          personLinkedIn: contact.personLinkedIn,
          salesNavigatorUrl: contact.salesNavigatorUrl,
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
        message: "No contact found for this profile",
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

router.post("/save-profile", async (req: Request, res: Response) => {
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

    const { linkedinUrl, salesNavigatorUrl, fullName, firstName, lastName, title, company, email, location } = req.body;
    
    if (!fullName) {
      return res.status(400).json({ 
        success: false, 
        message: "Full name is required" 
      });
    }

    if (!linkedinUrl && !salesNavigatorUrl) {
      return res.status(400).json({ 
        success: false, 
        message: "At least one URL (linkedinUrl or salesNavigatorUrl) is required" 
      });
    }

    // Check if either URL already exists
    const existing = await storage.findContactByLinkedInUrls(linkedinUrl, salesNavigatorUrl);
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: "This profile is already saved" 
      });
    }

    // Extract first and last name if not provided
    let firstName_ = firstName;
    let lastName_ = lastName;
    
    if (!firstName_ && !lastName_) {
      const nameParts = fullName.trim().split(/\s+/);
      firstName_ = nameParts[0] || "";
      lastName_ = nameParts.slice(1).join(" ") || "";
    }

    // Create the contact with both URLs
    const contact = await storage.createProspect({
      firstName: firstName_ || "",
      lastName: lastName_ || "",
      email: email || "",
      personLinkedIn: linkedinUrl || "",
      salesNavigatorUrl: salesNavigatorUrl || undefined,
      ...(title && { title }),
      ...(company && { company }),
    });

    res.json({
      success: true,
      message: "Profile saved successfully",
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        personLinkedIn: contact.personLinkedIn,
        salesNavigatorUrl: contact.salesNavigatorUrl,
      },
    });
  } catch (error) {
    console.error("Extension save profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save profile" 
    });
  }
});

export const extensionRouter = router;
