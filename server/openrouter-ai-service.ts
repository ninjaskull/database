import { db } from "./db";
import { aiUsageLogs, aiResponseCache } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

const nodeFetch = globalThis.fetch ?? require("node-fetch");

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface AIServiceConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  cacheTTLSeconds?: number;
  rateLimitPerMinute?: number;
}

interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached: boolean;
}

const rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

export class OpenRouterAIService {
  private apiKey: string | undefined;
  private config: Required<AIServiceConfig>;

  constructor(config: AIServiceConfig = {}) {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      cacheTTLSeconds: config.cacheTTLSeconds ?? 3600,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 60,
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private checkRateLimit(identifier: string = "global"): boolean {
    const now = Date.now();
    const tracker = rateLimitTracker.get(identifier);

    if (!tracker || now >= tracker.resetTime) {
      rateLimitTracker.set(identifier, {
        count: 1,
        resetTime: now + 60000,
      });
      return true;
    }

    if (tracker.count >= this.config.rateLimitPerMinute) {
      return false;
    }

    rateLimitTracker.set(identifier, {
      count: tracker.count + 1,
      resetTime: tracker.resetTime,
    });
    return true;
  }

  private generateCacheKey(messages: ChatMessage[], model: string): string {
    const content = JSON.stringify({ messages, model });
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ai_cache_${Math.abs(hash).toString(36)}`;
  }

  private async getCachedResponse(cacheKey: string): Promise<AIResponse | null> {
    try {
      const cached = await db.select()
        .from(aiResponseCache)
        .where(
          and(
            eq(aiResponseCache.cacheKey, cacheKey),
            gte(aiResponseCache.expiresAt, new Date())
          )
        )
        .limit(1);

      if (cached.length > 0) {
        const entry = cached[0];
        return {
          content: entry.responseContent,
          model: entry.model,
          usage: entry.usage as AIResponse["usage"],
          cached: true,
        };
      }
    } catch (error) {
      console.error("[AI Service] Cache lookup error:", error);
    }
    return null;
  }

  private async setCachedResponse(
    cacheKey: string,
    response: AIResponse,
    promptHash: string
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.config.cacheTTLSeconds * 1000);
      
      await db.insert(aiResponseCache).values({
        cacheKey,
        promptHash,
        model: response.model,
        responseContent: response.content,
        usage: response.usage ?? null,
        expiresAt,
      }).onConflictDoUpdate({
        target: aiResponseCache.cacheKey,
        set: {
          responseContent: response.content,
          usage: response.usage ?? null,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[AI Service] Cache write error:", error);
    }
  }

  private async logUsage(
    operationType: string,
    model: string,
    success: boolean,
    usage?: AIResponse["usage"],
    error?: string,
    contactId?: string,
    cached?: boolean
  ): Promise<void> {
    try {
      await db.insert(aiUsageLogs).values({
        operationType,
        model,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
        success,
        errorMessage: error,
        contactId,
        cached: cached ?? false,
      });
    } catch (err) {
      console.error("[AI Service] Usage logging error:", err);
    }
  }

  private async makeRequest(
    messages: ChatMessage[],
    model: string = DEFAULT_MODEL,
    attempt: number = 1
  ): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your secrets.");
    }

    const response = await nodeFetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : "http://localhost:5000",
        "X-Title": "CRM Contact Management AI",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 429 && attempt < this.config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
        return this.makeRequest(messages, model, attempt + 1);
      }

      if (response.status === 401) {
        throw new Error("Invalid OpenRouter API key");
      }
      if (response.status === 402) {
        throw new Error("Insufficient credits on OpenRouter account");
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }

  async chat(
    messages: ChatMessage[],
    options: {
      model?: string;
      useCache?: boolean;
      operationType?: string;
      contactId?: string;
    } = {}
  ): Promise<AIResponse> {
    const {
      model = DEFAULT_MODEL,
      useCache = true,
      operationType = "chat",
      contactId,
    } = options;

    if (!this.checkRateLimit()) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }

    const cacheKey = this.generateCacheKey(messages, model);

    if (useCache) {
      const cached = await this.getCachedResponse(cacheKey);
      if (cached) {
        await this.logUsage(operationType, model, true, cached.usage, undefined, contactId, true);
        return cached;
      }
    }

    try {
      const apiResponse = await this.makeRequest(messages, model);
      
      const content = apiResponse.choices[0]?.message?.content ?? "";
      const usage = apiResponse.usage ? {
        promptTokens: apiResponse.usage.prompt_tokens,
        completionTokens: apiResponse.usage.completion_tokens,
        totalTokens: apiResponse.usage.total_tokens,
      } : undefined;

      const result: AIResponse = {
        content,
        model: apiResponse.model,
        usage,
        cached: false,
      };

      if (useCache) {
        await this.setCachedResponse(cacheKey, result, cacheKey);
      }

      await this.logUsage(operationType, model, true, usage, undefined, contactId, false);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.logUsage(operationType, model, false, undefined, errorMessage, contactId, false);
      throw error;
    }
  }

  async enrichContact(contact: {
    fullName?: string;
    email?: string;
    company?: string;
    title?: string;
    industry?: string;
    website?: string;
  }): Promise<{
    suggestedIndustry?: string;
    suggestedTitle?: string;
    suggestedBusinessType?: string;
    leadScore?: number;
    insights?: string;
  }> {
    const prompt = `Analyze this contact and provide enrichment suggestions:
Name: ${contact.fullName || "Unknown"}
Email: ${contact.email || "Unknown"}
Company: ${contact.company || "Unknown"}
Title: ${contact.title || "Unknown"}
Industry: ${contact.industry || "Unknown"}
Website: ${contact.website || "Unknown"}

Respond in JSON format with these fields:
{
  "suggestedIndustry": "most likely industry based on company/email domain",
  "suggestedTitle": "refined or standardized job title if title seems informal",
  "suggestedBusinessType": "B2B, B2C, or Enterprise",
  "leadScore": 0-100 based on completeness and potential value,
  "insights": "brief 1-2 sentence analysis of this contact's potential"
}

Only include fields where you have reasonable confidence. Return valid JSON only.`;

    const response = await this.chat(
      [
        { role: "system", content: "You are a CRM data enrichment specialist. Analyze contacts and provide accurate, professional suggestions. Always return valid JSON." },
        { role: "user", content: prompt },
      ],
      { operationType: "contact_enrichment", useCache: true }
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[AI Service] Failed to parse enrichment response:", e);
    }
    
    return {};
  }

  async detectDuplicates(contacts: Array<{
    id: string;
    fullName?: string;
    email?: string;
    company?: string;
  }>): Promise<Array<{
    contactId1: string;
    contactId2: string;
    confidence: number;
    reason: string;
  }>> {
    if (contacts.length < 2) return [];

    const contactList = contacts.map(c => 
      `ID: ${c.id}, Name: ${c.fullName || "?"}, Email: ${c.email || "?"}, Company: ${c.company || "?"}`
    ).join("\n");

    const prompt = `Analyze these contacts for potential duplicates:
${contactList}

Find contacts that might be the same person (different spellings, company variations, etc).
Respond in JSON format as an array:
[
  {
    "contactId1": "id of first contact",
    "contactId2": "id of second contact", 
    "confidence": 0-100,
    "reason": "brief explanation"
  }
]

Only include pairs with confidence > 50. Return [] if no duplicates found.`;

    const response = await this.chat(
      [
        { role: "system", content: "You are a data quality specialist. Identify potential duplicate contacts with high accuracy. Return valid JSON array only." },
        { role: "user", content: prompt },
      ],
      { operationType: "duplicate_detection", useCache: false }
    );

    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[AI Service] Failed to parse duplicate detection response:", e);
    }
    
    return [];
  }

  async naturalLanguageSearch(query: string): Promise<{
    filters: Record<string, any>;
    interpretation: string;
  }> {
    const prompt = `Convert this natural language search into database filters:
"${query}"

Available filter fields:
- industry: text (Technology, Healthcare, Finance, Manufacturing, etc.)
- country: text (USA, UK, Germany, etc.)
- employeeSizeBracket: text (1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5000+)
- title: text (job title, partial match)
- company: text (company name, partial match)
- leadScore: number 0-100 (high = valuable lead)

Respond in JSON:
{
  "filters": { "fieldName": "value" },
  "interpretation": "human readable interpretation of the search"
}

Use partial matching for text fields where appropriate. Return valid JSON only.`;

    const response = await this.chat(
      [
        { role: "system", content: "You are a search query interpreter. Convert natural language to structured database filters. Be conservative - only add filters you're confident about." },
        { role: "user", content: prompt },
      ],
      { operationType: "natural_language_search", useCache: true }
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("[AI Service] Failed to parse search response:", e);
    }
    
    return { filters: {}, interpretation: "Could not interpret search query" };
  }

  async generateContactSummary(contact: {
    fullName?: string;
    email?: string;
    company?: string;
    title?: string;
    industry?: string;
    leadScore?: number;
    city?: string;
    country?: string;
  }): Promise<string> {
    const prompt = `Generate a brief, professional summary for this CRM contact:
Name: ${contact.fullName || "Unknown"}
Email: ${contact.email || "Unknown"}  
Company: ${contact.company || "Unknown"}
Title: ${contact.title || "Unknown"}
Industry: ${contact.industry || "Unknown"}
Lead Score: ${contact.leadScore ?? "Not scored"}
Location: ${[contact.city, contact.country].filter(Boolean).join(", ") || "Unknown"}

Write a 2-3 sentence professional summary highlighting key points and potential value.`;

    const response = await this.chat(
      [
        { role: "system", content: "You are a CRM assistant. Write concise, professional contact summaries." },
        { role: "user", content: prompt },
      ],
      { operationType: "contact_summary", useCache: true }
    );

    return response.content;
  }

  async getUsageStats(days: number = 30): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cachedResponses: number;
    totalTokens: number;
    byOperationType: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await db.select({
      total: sql<number>`count(*)`,
      successful: sql<number>`sum(case when success = true then 1 else 0 end)`,
      failed: sql<number>`sum(case when success = false then 1 else 0 end)`,
      cached: sql<number>`sum(case when cached = true then 1 else 0 end)`,
      tokens: sql<number>`sum(total_tokens)`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, startDate));

    const byType = await db.select({
      operationType: aiUsageLogs.operationType,
      count: sql<number>`count(*)`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, startDate))
    .groupBy(aiUsageLogs.operationType);

    const typeMap: Record<string, number> = {};
    byType.forEach(t => {
      typeMap[t.operationType] = Number(t.count);
    });

    return {
      totalRequests: Number(stats[0]?.total ?? 0),
      successfulRequests: Number(stats[0]?.successful ?? 0),
      failedRequests: Number(stats[0]?.failed ?? 0),
      cachedResponses: Number(stats[0]?.cached ?? 0),
      totalTokens: Number(stats[0]?.tokens ?? 0),
      byOperationType: typeMap,
    };
  }

  async cleanupExpiredCache(): Promise<number> {
    const result = await db.delete(aiResponseCache)
      .where(sql`${aiResponseCache.expiresAt} < now()`)
      .returning({ id: aiResponseCache.id });
    
    return result.length;
  }
}

export const aiService = new OpenRouterAIService();
