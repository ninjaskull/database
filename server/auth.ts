import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { Request, Response, NextFunction } from "express";

const SALT_ROUNDS = 12;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function authenticateUser(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any }> {
  try {
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return { success: false };
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return { success: false };
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    
    await storage.createSession({
      userId: user.id,
      token,
      expiresAt,
    });

    return { 
      success: true, 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false };
  }
}

export async function validateSession(token: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const session = await storage.getSessionByToken(token);
    if (!session) {
      return { valid: false };
    }

    const user = await storage.getUserById(session.userId);
    if (!user) {
      return { valid: false };
    }

    // Check if session is expired
    if (session.expiresAt && session.expiresAt < new Date()) {
      await storage.deleteSession(token);
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.session as any)?.token;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { valid, user } = await validateSession(token);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
}

// Initialize default subscription plans
export async function initializeSubscriptionPlans(): Promise<void> {
  try {
    const plans = await storage.getSubscriptionPlans();
    if (plans.length === 0) {
      // Create default plans
      await storage.createSubscriptionPlan({
        name: "free",
        displayName: "Free",
        description: "Basic access for individual users",
        dailyApiLimit: 50,
        monthlyApiLimit: 500,
        canExportData: false,
        canBulkImport: false,
        canUseEnrichment: false,
        canAccessAdvancedSearch: false,
        canCreateApiKeys: true,
        maxApiKeys: 1,
        canUseChromeExtension: true,
        extensionLookupLimit: 25,
        priceMonthly: "0",
        sortOrder: 1,
      });
      
      await storage.createSubscriptionPlan({
        name: "starter",
        displayName: "Starter",
        description: "For small teams getting started",
        dailyApiLimit: 200,
        monthlyApiLimit: 3000,
        canExportData: true,
        canBulkImport: true,
        canUseEnrichment: false,
        canAccessAdvancedSearch: true,
        canCreateApiKeys: true,
        maxApiKeys: 3,
        canUseChromeExtension: true,
        extensionLookupLimit: 100,
        priceMonthly: "29",
        sortOrder: 2,
      });
      
      await storage.createSubscriptionPlan({
        name: "professional",
        displayName: "Professional",
        description: "For growing sales teams",
        dailyApiLimit: 1000,
        monthlyApiLimit: 20000,
        canExportData: true,
        canBulkImport: true,
        canUseEnrichment: true,
        canAccessAdvancedSearch: true,
        canCreateApiKeys: true,
        maxApiKeys: 10,
        canUseChromeExtension: true,
        extensionLookupLimit: 500,
        priceMonthly: "99",
        sortOrder: 3,
      });
      
      await storage.createSubscriptionPlan({
        name: "enterprise",
        displayName: "Enterprise",
        description: "Unlimited access for large organizations",
        dailyApiLimit: 10000,
        monthlyApiLimit: 100000,
        canExportData: true,
        canBulkImport: true,
        canUseEnrichment: true,
        canAccessAdvancedSearch: true,
        canCreateApiKeys: true,
        maxApiKeys: 50,
        canUseChromeExtension: true,
        extensionLookupLimit: 2000,
        priceMonthly: "299",
        sortOrder: 4,
      });
      
      console.log('✅ Default subscription plans created');
    }
  } catch (error) {
    console.error('Error initializing subscription plans:', error);
  }
}

// Initialize default user
export async function initializeDefaultUser(): Promise<void> {
  try {
    // Initialize subscription plans first
    await initializeSubscriptionPlans();
    
    const defaultEmail = "amit@fallowl.com";
    const defaultPassword = "DemonFlare@254039";
    
    const existingUser = await storage.getUserByEmail(defaultEmail);
    if (!existingUser) {
      const passwordHash = await hashPassword(defaultPassword);
      
      // Get the free plan to assign by default
      const freePlan = await storage.getSubscriptionPlanByName("free");
      
      await storage.createUser({
        email: defaultEmail,
        passwordHash,
        name: "Amit",
        role: "admin",
        planId: freePlan?.id,
      });
      console.log('✅ Default admin user created');
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
}