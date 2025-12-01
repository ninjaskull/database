import { Request, Response, NextFunction } from "express";
import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import type { ApiKey } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
      traceId?: string;
      apiVersion?: string;
    }
  }
}

export const API_VERSION = "1.0.0";
export const API_PREFIX = "/api/v1";

export const API_SCOPES = {
  CONTACTS_READ: "contacts:read",
  CONTACTS_WRITE: "contacts:write",
  CONTACTS_DELETE: "contacts:delete",
  CONTACTS_BULK: "contacts:bulk",
  ENRICHMENT_RUN: "enrichment:run",
  ENRICHMENT_READ: "enrichment:read",
  STATS_READ: "stats:read",
  TAGS_READ: "tags:read",
  TAGS_WRITE: "tags:write",
  ACTIVITIES_READ: "activities:read",
} as const;

export type ApiScope = typeof API_SCOPES[keyof typeof API_SCOPES];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  [API_SCOPES.CONTACTS_READ]: "Read contact information",
  [API_SCOPES.CONTACTS_WRITE]: "Create and update contacts",
  [API_SCOPES.CONTACTS_DELETE]: "Delete contacts",
  [API_SCOPES.CONTACTS_BULK]: "Perform bulk operations on contacts",
  [API_SCOPES.ENRICHMENT_RUN]: "Execute data enrichment jobs",
  [API_SCOPES.ENRICHMENT_READ]: "View enrichment job status and history",
  [API_SCOPES.STATS_READ]: "Access analytics and statistics",
  [API_SCOPES.TAGS_READ]: "Read tags",
  [API_SCOPES.TAGS_WRITE]: "Create and manage tags",
  [API_SCOPES.ACTIVITIES_READ]: "View activity logs and audit trail",
};

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  traceId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    pageSize?: number;
    totalItems?: number;
    totalPages?: number;
    apiVersion?: string;
  };
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
} as const;

const rateLimitStore: Map<string, { count: number; resetTime: number; burst: number }> = new Map();

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hashedKey: string } {
  const key = `crm_${randomBytes(32).toString("hex")}`;
  const hashedKey = hashApiKey(key);
  return { key, hashedKey };
}

export function generateTraceId(): string {
  return `trace_${Date.now()}_${randomBytes(8).toString("hex")}`;
}

function checkRateLimit(apiKey: ApiKey): { 
  allowed: boolean; 
  remaining: number; 
  resetIn: number;
  limit: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = apiKey.rateLimitPerMinute || 60;
  const burstLimit = limit * 3;
  
  const keyId = apiKey.id;
  let rateData = rateLimitStore.get(keyId);
  
  if (!rateData || now > rateData.resetTime) {
    rateData = { count: 0, resetTime: now + windowMs, burst: 0 };
    rateLimitStore.set(keyId, rateData);
  }
  
  const remaining = Math.max(0, limit - rateData.count);
  const resetIn = Math.ceil((rateData.resetTime - now) / 1000);
  
  if (rateData.count >= limit) {
    if (rateData.burst >= burstLimit) {
      return { allowed: false, remaining: 0, resetIn, limit };
    }
    rateData.burst++;
  }
  
  rateData.count++;
  return { allowed: true, remaining: remaining - 1, resetIn, limit };
}

export function sendApiError(
  res: Response, 
  statusCode: number, 
  code: string, 
  message: string, 
  details?: any
): void {
  const traceId = (res.req as Request).traceId || generateTraceId();
  
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
      traceId,
    },
  } as ApiResponse);
}

export function sendApiSuccess<T>(
  res: Response, 
  data: T, 
  meta?: ApiResponse['meta'],
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      ...meta,
      apiVersion: API_VERSION,
    },
  } as ApiResponse<T>);
}

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId = generateTraceId();
  req.apiVersion = API_VERSION;
  res.setHeader("X-Trace-Id", req.traceId);
  res.setHeader("X-API-Version", API_VERSION);
  next();
}

export async function validateApiKeyV1(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] as string;
  const apiKeyHeader = req.headers["x-api-key"] as string;
  
  let apiKeyValue: string | undefined;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    apiKeyValue = authHeader.substring(7);
  } else if (apiKeyHeader) {
    apiKeyValue = apiKeyHeader;
  }

  if (!apiKeyValue) {
    sendApiError(res, 401, ERROR_CODES.UNAUTHORIZED, 
      "API key is required. Provide via 'Authorization: Bearer <key>' header or 'X-API-Key' header.");
    return;
  }

  if (!apiKeyValue.startsWith("crm_")) {
    sendApiError(res, 401, ERROR_CODES.UNAUTHORIZED, 
      "Invalid API key format. Key must start with 'crm_'.");
    return;
  }

  try {
    const hashedKey = hashApiKey(apiKeyValue);
    const apiKey = await storage.getApiKeyByHash(hashedKey);

    if (!apiKey) {
      sendApiError(res, 401, ERROR_CODES.UNAUTHORIZED, 
        "Invalid API key. The key does not exist or has been revoked.");
      return;
    }

    if (apiKey.revokedAt) {
      sendApiError(res, 401, ERROR_CODES.UNAUTHORIZED, 
        "API key has been revoked. Please generate a new key.");
      return;
    }

    const rateCheck = checkRateLimit(apiKey);
    res.setHeader("X-RateLimit-Limit", rateCheck.limit);
    res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);
    res.setHeader("X-RateLimit-Reset", rateCheck.resetIn);

    if (!rateCheck.allowed) {
      res.setHeader("Retry-After", rateCheck.resetIn);
      sendApiError(res, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED, 
        `Rate limit exceeded. Limit: ${rateCheck.limit} requests/minute. Retry after ${rateCheck.resetIn} seconds.`,
        { retryAfter: rateCheck.resetIn, limit: rateCheck.limit }
      );
      return;
    }

    storage.updateApiKeyUsage(apiKey.id).catch(console.error);

    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error("[API v1] Key validation error:", error);
    sendApiError(res, 500, ERROR_CODES.INTERNAL_ERROR, 
      "An error occurred while validating the API key.");
  }
}

export function requireScopes(...requiredScopes: ApiScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.apiKey;
    
    if (!apiKey) {
      sendApiError(res, 401, ERROR_CODES.UNAUTHORIZED, 
        "Authentication required.");
      return;
    }

    const keyScopes = apiKey.scopes || [];
    const missingScopes = requiredScopes.filter(scope => !keyScopes.includes(scope));

    if (missingScopes.length > 0) {
      sendApiError(res, 403, ERROR_CODES.INSUFFICIENT_SCOPE, 
        `Insufficient permissions. Required scopes: ${requiredScopes.join(", ")}. Missing: ${missingScopes.join(", ")}.`,
        { required: requiredScopes, missing: missingScopes, current: keyScopes }
      );
      return;
    }

    next();
  };
}

export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendApiError(res, 400, ERROR_CODES.VALIDATION_ERROR,
          "Request validation failed.",
          error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message,
            code: e.code,
          }))
        );
        return;
      }
      sendApiError(res, 400, ERROR_CODES.BAD_REQUEST, "Invalid request body.");
    }
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendApiError(res, 400, ERROR_CODES.VALIDATION_ERROR,
          "Query parameter validation failed.",
          error.errors.map(e => ({
            field: e.path.join("."),
            message: e.message,
            code: e.code,
          }))
        );
        return;
      }
      sendApiError(res, 400, ERROR_CODES.BAD_REQUEST, "Invalid query parameters.");
    }
  };
}

export const paginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  pageSize: z.string().optional().transform(val => {
    const size = val ? parseInt(val) : 20;
    return Math.min(Math.max(size, 1), 100);
  }),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const contactFilterSchema = paginationSchema.extend({
  search: z.string().optional(),
  industry: z.string().optional(),
  employeeSizeBracket: z.string().optional(),
  country: z.string().optional(),
  leadScoreMin: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  leadScoreMax: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  updatedSince: z.string().optional(),
  createdSince: z.string().optional(),
  hasEmail: z.string().optional().transform(val => val === "true"),
  hasPhone: z.string().optional().transform(val => val === "true"),
  hasLinkedIn: z.string().optional().transform(val => val === "true"),
});

export const createContactSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().nullable(),
  title: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  mobilePhone: z.string().optional().nullable(),
  otherPhone: z.string().optional().nullable(),
  homePhone: z.string().optional().nullable(),
  corporatePhone: z.string().optional().nullable(),
  employees: z.number().optional().nullable(),
  employeeSizeBracket: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  companyLinkedIn: z.string().url().optional().nullable(),
  technologies: z.array(z.string()).optional().nullable(),
  annualRevenue: z.string().optional().nullable(),
  personLinkedIn: z.string().url().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyCity: z.string().optional().nullable(),
  companyState: z.string().optional().nullable(),
  companyCountry: z.string().optional().nullable(),
}).refine((data) => {
  return data.fullName || data.firstName || data.lastName || data.email;
}, {
  message: "At least one of fullName, firstName, lastName, or email must be provided",
  path: ["fullName"]
});

export const updateContactSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  title: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  mobilePhone: z.string().optional().nullable(),
  otherPhone: z.string().optional().nullable(),
  homePhone: z.string().optional().nullable(),
  corporatePhone: z.string().optional().nullable(),
  employees: z.number().optional().nullable(),
  employeeSizeBracket: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  website: z.string().url().or(z.literal("")).optional().nullable(),
  companyLinkedIn: z.string().url().or(z.literal("")).optional().nullable(),
  technologies: z.array(z.string()).optional().nullable(),
  annualRevenue: z.string().optional().nullable(),
  personLinkedIn: z.string().url().or(z.literal("")).optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyCity: z.string().optional().nullable(),
  companyState: z.string().optional().nullable(),
  companyCountry: z.string().optional().nullable(),
});

export const bulkCreateContactsSchema = z.object({
  contacts: z.array(createContactSchema).min(1).max(500),
});

export const bulkUpdateContactsSchema = z.object({
  contacts: z.array(z.object({
    id: z.string(),
    updates: updateContactSchema,
  })).min(1).max(500),
});

export const bulkDeleteContactsSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

export const enrichmentSearchSchema = z.object({
  linkedinUrl: z.string().url().refine(
    (url) => url.includes("linkedin.com/in/"),
    "Must be a valid LinkedIn profile URL"
  ),
});

export const createEnrichmentJobSchema = z.object({
  linkedinUrl: z.string().url().refine(
    (url) => url.includes("linkedin.com/in/"),
    "Must be a valid LinkedIn profile URL"
  ),
  contactId: z.string().optional(),
});

export const bulkEnrichmentSchema = z.object({
  jobs: z.array(createEnrichmentJobSchema).min(1).max(100),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(200).optional(),
});

export const addTagToContactSchema = z.object({
  tagId: z.string(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type ContactFilterParams = z.infer<typeof contactFilterSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type BulkCreateContactsInput = z.infer<typeof bulkCreateContactsSchema>;
export type BulkUpdateContactsInput = z.infer<typeof bulkUpdateContactsSchema>;
export type BulkDeleteContactsInput = z.infer<typeof bulkDeleteContactsSchema>;
