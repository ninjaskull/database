import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import type { ApiKey } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hashedKey: string } {
  const key = `crm_${randomBytes(32).toString("hex")}`;
  const hashedKey = hashApiKey(key);
  return { key, hashedKey };
}

function checkRateLimit(apiKey: ApiKey): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = apiKey.rateLimitPerMinute || 60;
  
  const keyId = apiKey.id;
  let rateData = rateLimitStore.get(keyId);
  
  if (!rateData || now > rateData.resetTime) {
    rateData = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(keyId, rateData);
  }
  
  const remaining = Math.max(0, limit - rateData.count);
  const resetIn = Math.ceil((rateData.resetTime - now) / 1000);
  
  if (rateData.count >= limit) {
    return { allowed: false, remaining: 0, resetIn };
  }
  
  rateData.count++;
  return { allowed: true, remaining: remaining - 1, resetIn };
}

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyHeader = req.headers["x-api-key"] as string;

  if (!apiKeyHeader) {
    res.status(401).json({
      success: false,
      error: "API key is required",
      message: "Please provide an API key in the x-api-key header",
    });
    return;
  }

  if (!apiKeyHeader.startsWith("crm_")) {
    res.status(401).json({
      success: false,
      error: "Invalid API key format",
      message: "API key must start with 'crm_'",
    });
    return;
  }

  try {
    const hashedKey = hashApiKey(apiKeyHeader);
    const apiKey = await storage.getApiKeyByHash(hashedKey);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: "Invalid API key",
        message: "The provided API key is invalid or has been revoked",
      });
      return;
    }

    if (apiKey.revokedAt) {
      res.status(401).json({
        success: false,
        error: "API key revoked",
        message: "This API key has been revoked",
      });
      return;
    }

    const rateCheck = checkRateLimit(apiKey);
    res.setHeader("X-RateLimit-Limit", apiKey.rateLimitPerMinute || 60);
    res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);
    res.setHeader("X-RateLimit-Reset", rateCheck.resetIn);

    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        error: "Rate limit exceeded",
        message: `You have exceeded the rate limit of ${apiKey.rateLimitPerMinute || 60} requests per minute. Please wait ${rateCheck.resetIn} seconds.`,
        retryAfter: rateCheck.resetIn,
      });
      return;
    }

    storage.updateApiKeyUsage(apiKey.id).catch(console.error);

    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error("API key validation error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "An error occurred while validating the API key",
    });
  }
}
