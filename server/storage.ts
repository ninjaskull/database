import { 
  contacts, 
  contactActivities, 
  importJobs,
  users,
  sessions,
  enrichmentJobs,
  apiKeys,
  tags,
  contactTags,
  apiRequestLogs,
  type Contact, 
  type InsertContact,
  type ContactActivity,
  type InsertContactActivity,
  type ImportJob,
  type InsertImportJob,
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type EnrichmentJob,
  type InsertEnrichmentJob,
  type ApiKey,
  type InsertApiKey,
  type Tag,
  type InsertTag,
  type ContactTag,
  type InsertContactTag,
  type ApiRequestLog,
  type InsertApiRequestLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc, asc, count, sql, or, isNull, isNotNull, ne } from "drizzle-orm";

export interface IStorage {
  // Contact operations
  getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ contacts: Contact[], total: number }>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  bulkDeleteContacts(ids: string[]): Promise<number>;
  
  // Duplicate detection
  findDuplicateContacts(email: string, company?: string): Promise<Contact[]>;
  findFuzzyDuplicateContacts(email?: string, fullName?: string, company?: string): Promise<Contact[]>;
  
  // Stats
  getContactStats(): Promise<{
    totalContacts: number;
    totalCompanies: number;
    validEmails: number;
    averageLeadScore: number;
  }>;

  // Comprehensive Analytics
  getComprehensiveAnalytics(): Promise<any>;
  getAnalyticsTrends(): Promise<any>;
  getAnalyticsActivities(): Promise<any>;
  getAnalyticsImports(): Promise<any>;
  
  // Activity logging
  createContactActivity(activity: InsertContactActivity): Promise<ContactActivity>;
  getContactActivities(contactId: string): Promise<ContactActivity[]>;
  
  // Import jobs
  createImportJob(job: InsertImportJob): Promise<ImportJob>;
  updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob | undefined>;
  getImportJob(id: string): Promise<ImportJob | undefined>;
  
  // User authentication
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Session management
  createSession(session: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<boolean>;
  deleteExpiredSessions(): Promise<number>;
  
  // Utility operations
  fixEmptyFullNames(): Promise<number>;
  
  // Company details auto-fill operations
  getCompanyTemplate(companyName: string): Promise<Partial<Contact> | null>;
  createContactWithAutoFill(contact: InsertContact): Promise<Contact>;
  updateContactWithAutoFill(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined>;
  bulkAutoFillCompanyDetails(): Promise<{ processed: number; updated: number; companiesProcessed: string[] }>;
  
  // LinkedIn enrichment operations
  createEnrichmentJob(job: InsertEnrichmentJob): Promise<EnrichmentJob>;
  updateEnrichmentJob(id: string, updates: Partial<EnrichmentJob>): Promise<EnrichmentJob | undefined>;
  getEnrichmentJob(id: string): Promise<EnrichmentJob | undefined>;
  getEnrichmentJobsByContact(contactId: string): Promise<EnrichmentJob[]>;
  getRecentEnrichmentJobs(limit?: number): Promise<EnrichmentJob[]>;
  
  // LinkedIn URL search in existing contacts
  findContactsByLinkedInUrl(linkedinUrl: string): Promise<Contact[]>;
  
  // API Key operations
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeyByHash(hashedKey: string): Promise<ApiKey | undefined>;
  getUserApiKeys(userId: string): Promise<ApiKey[]>;
  updateApiKeyUsage(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<boolean>;
  
  // Tag operations
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
  getContactTags(contactId: string): Promise<Tag[]>;
  addTagToContact(contactId: string, tagId: string): Promise<ContactTag>;
  removeTagFromContact(contactId: string, tagId: string): Promise<boolean>;
  
  // Activity operations
  getRecentActivities(limit?: number): Promise<ContactActivity[]>;
  
  // API Request Logging
  logApiRequest(log: InsertApiRequestLog): Promise<ApiRequestLog>;
  
  // User operations
  getUserById(id: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
}

// Utility function to generate full name from first and last name
function generateFullName(firstName?: string | null, lastName?: string | null, existingFullName?: string | null): string {
  // If fullName already exists and is not empty, keep it
  if (existingFullName && existingFullName.trim()) {
    return existingFullName.trim();
  }
  
  // Generate from firstName and lastName
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  
  if (first && last) {
    return `${first} ${last}`;
  } else if (first) {
    return first;
  } else if (last) {
    return last;
  }
  
  // Return existing fullName if no components available
  return existingFullName || '';
}

export class DatabaseStorage implements IStorage {
  async getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ contacts: Contact[], total: number }> {
    const {
      page = 1,
      limit = 20,
      search = '',
      industry = '',
      employeeSizeBracket = '',
      country = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;
    const offset = (page - 1) * limit;
    
    let query = db.select().from(contacts).where(eq(contacts.isDeleted, false));
    
    // Apply filters
    const conditions = [eq(contacts.isDeleted, false)];
    
    if (search) {
      conditions.push(
        sql`(${contacts.fullName} ILIKE ${`%${search}%`} OR 
            ${contacts.email} ILIKE ${`%${search}%`} OR 
            ${contacts.company} ILIKE ${`%${search}%`})`
      );
    }
    
    if (industry) {
      conditions.push(eq(contacts.industry, industry));
    }
    
    if (employeeSizeBracket) {
      conditions.push(eq(contacts.employeeSizeBracket, employeeSizeBracket));
    }
    
    if (country) {
      conditions.push(eq(contacts.country, country));
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(contacts)
      .where(whereClause);
    
    // Get contacts with pagination and sorting
    let sortColumn: any = contacts.createdAt;
    if (sortBy === 'fullName') sortColumn = contacts.fullName;
    else if (sortBy === 'email') sortColumn = contacts.email;
    else if (sortBy === 'company') sortColumn = contacts.company;
    else if (sortBy === 'industry') sortColumn = contacts.industry;
    else if (sortBy === 'country') sortColumn = contacts.country;
    else if (sortBy === 'createdAt') sortColumn = contacts.createdAt;
    else if (sortBy === 'updatedAt') sortColumn = contacts.updatedAt;
    
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    const contactsList = await db
      .select()
      .from(contacts)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
    
    return { contacts: contactsList, total };
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    // Auto-generate fullName if not provided
    const contactData = {
      ...insertContact,
      fullName: generateFullName(insertContact.firstName, insertContact.lastName, insertContact.fullName),
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(contactData)
      .returning();
    
    // Log activity
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: 'Contact added to database',
    });
    
    return contact;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    // Get existing contact to check current fullName
    const existingContact = await this.getContact(id);
    if (!existingContact) return undefined;
    
    // Auto-generate fullName if firstName or lastName is being updated
    const updatedData = { ...updates };
    if ('firstName' in updates || 'lastName' in updates || ('fullName' in updates && !updates.fullName)) {
      updatedData.fullName = generateFullName(
        updates.firstName ?? existingContact.firstName,
        updates.lastName ?? existingContact.lastName,
        updates.fullName ?? existingContact.fullName
      );
    }
    
    const [contact] = await db
      .update(contacts)
      .set({
        ...updatedData,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'updated',
        description: 'Contact information updated',
        changes: updates,
      });
    }
    
    return contact || undefined;
  }

  async deleteContact(id: string): Promise<boolean> {
    const [contact] = await db
      .update(contacts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'deleted',
        description: 'Contact deleted',
      });
      return true;
    }
    
    return false;
  }

  async bulkDeleteContacts(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    let deletedCount = 0;
    
    // Delete each contact individually to ensure proper logging
    for (const id of ids) {
      const success = await this.deleteContact(id);
      if (success) deletedCount++;
    }
    
    return deletedCount;
  }

  async findDuplicateContacts(email: string, company?: string): Promise<Contact[]> {
    const conditions = [eq(contacts.isDeleted, false)];
    
    if (email) {
      conditions.push(eq(contacts.email, email));
    }
    
    if (company) {
      conditions.push(eq(contacts.company, company));
    }
    
    return await db
      .select()
      .from(contacts)
      .where(and(...conditions));
  }

  async findFuzzyDuplicateContacts(
    email?: string, 
    fullName?: string, 
    company?: string
  ): Promise<Contact[]> {
    const conditions = [eq(contacts.isDeleted, false)];
    
    // Exact email match is highest priority
    if (email) {
      conditions.push(eq(contacts.email, email));
      return await db
        .select()
        .from(contacts)
        .where(and(...conditions));
    }
    
    // If no email, try fuzzy name matching with company
    if (fullName && company) {
      const nameWords = fullName.toLowerCase().split(' ').filter(w => w.length > 1);
      if (nameWords.length >= 2) {
        // Use SQL LIKE for fuzzy matching
        conditions.push(
          sql`LOWER(${contacts.fullName}) LIKE ${`%${nameWords[0]}%`} AND LOWER(${contacts.fullName}) LIKE ${`%${nameWords[nameWords.length - 1]}%`}`
        );
        conditions.push(eq(contacts.company, company));
        
        return await db
          .select()
          .from(contacts)
          .where(and(...conditions));
      }
    }
    
    return [];
  }

  async getContactStats() {
    const [stats] = await db
      .select({
        totalContacts: count(),
        validEmails: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        averageLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        totalCompanies: sql<number>`COUNT(DISTINCT ${contacts.company})`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));
    
    return {
      totalContacts: Number(stats.totalContacts),
      totalCompanies: Number(stats.totalCompanies),
      validEmails: Number(stats.validEmails),
      averageLeadScore: Number(stats.averageLeadScore) || 0,
    };
  }

  async getComprehensiveAnalytics() {
    const [basicStats] = await db
      .select({
        totalContacts: count(),
        validEmails: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        averageLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        totalCompanies: sql<number>`COUNT(DISTINCT CASE WHEN ${contacts.company} IS NOT NULL AND ${contacts.company} != '' THEN ${contacts.company} END)`,
        uniqueIndustries: sql<number>`COUNT(DISTINCT CASE WHEN ${contacts.industry} IS NOT NULL AND ${contacts.industry} != '' THEN ${contacts.industry} END)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Geographic distribution
    const geographicDistribution = await db
      .select({
        country: contacts.country,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.country), ne(contacts.country, '')))
      .groupBy(contacts.country)
      .orderBy(desc(count()))
      .limit(10);

    // Industry distribution
    const industryDistribution = await db
      .select({
        industry: contacts.industry,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.industry), ne(contacts.industry, '')))
      .groupBy(contacts.industry)
      .orderBy(desc(count()))
      .limit(15);

    // Company size distribution
    const companySizeDistribution = await db
      .select({
        size: contacts.employeeSizeBracket,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.employeeSizeBracket), ne(contacts.employeeSizeBracket, '')))
      .groupBy(contacts.employeeSizeBracket)
      .orderBy(desc(count()));

    // Top companies
    const topCompanies = await db
      .select({
        company: contacts.company,
        industry: contacts.industry,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.company), ne(contacts.company, '')))
      .groupBy(contacts.company, contacts.industry)
      .orderBy(desc(count()))
      .limit(20);

    // Lead score distribution
    const leadScoreDistribution = await db
      .select({
        range: sql<string>`CASE 
          WHEN ${contacts.leadScore} >= 9 THEN '9-10'
          WHEN ${contacts.leadScore} >= 8 THEN '8-9'
          WHEN ${contacts.leadScore} >= 7 THEN '7-8'
          WHEN ${contacts.leadScore} >= 6 THEN '6-7'
          WHEN ${contacts.leadScore} >= 5 THEN '5-6'
          WHEN ${contacts.leadScore} >= 4 THEN '4-5'
          WHEN ${contacts.leadScore} >= 3 THEN '3-4'
          WHEN ${contacts.leadScore} >= 2 THEN '2-3'
          WHEN ${contacts.leadScore} >= 1 THEN '1-2'
          ELSE '0-1'
        END`,
        count: count(),
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.leadScore)))
      .groupBy(sql`CASE 
        WHEN ${contacts.leadScore} >= 9 THEN '9-10'
        WHEN ${contacts.leadScore} >= 8 THEN '8-9'
        WHEN ${contacts.leadScore} >= 7 THEN '7-8'
        WHEN ${contacts.leadScore} >= 6 THEN '6-7'
        WHEN ${contacts.leadScore} >= 5 THEN '5-6'
        WHEN ${contacts.leadScore} >= 4 THEN '4-5'
        WHEN ${contacts.leadScore} >= 3 THEN '3-4'
        WHEN ${contacts.leadScore} >= 2 THEN '2-3'
        WHEN ${contacts.leadScore} >= 1 THEN '1-2'
        ELSE '0-1'
      END`)
      .orderBy(desc(count()));

    // Communication channels
    const [communicationChannels] = await db
      .select({
        email: sql<number>`COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END)`,
        phone: sql<number>`COUNT(CASE WHEN (${contacts.mobilePhone} IS NOT NULL AND ${contacts.mobilePhone} != '') OR (${contacts.corporatePhone} IS NOT NULL AND ${contacts.corporatePhone} != '') THEN 1 END)`,
        linkedin: sql<number>`COUNT(CASE WHEN ${contacts.personLinkedIn} IS NOT NULL AND ${contacts.personLinkedIn} != '' THEN 1 END)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Top technologies
    const topTechnologies = await db
      .select({
        technology: sql<string>`unnest(${contacts.technologies})`,
        count: sql<number>`count(*)`,
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.technologies)))
      .groupBy(sql`unnest(${contacts.technologies})`)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    // Data completeness
    const [dataCompleteness] = await db
      .select({
        email: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.email} IS NOT NULL AND ${contacts.email} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        phone: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.mobilePhone} IS NOT NULL AND ${contacts.mobilePhone} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        company: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.company} IS NOT NULL AND ${contacts.company} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        industry: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.industry} IS NOT NULL AND ${contacts.industry} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        title: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.title} IS NOT NULL AND ${contacts.title} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        location: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.country} IS NOT NULL AND ${contacts.country} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        linkedin: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.personLinkedIn} IS NOT NULL AND ${contacts.personLinkedIn} != '' THEN 1 END) * 100.0) / COUNT(*), 1)`,
        leadScore: sql<number>`ROUND((COUNT(CASE WHEN ${contacts.leadScore} IS NOT NULL THEN 1 END) * 100.0) / COUNT(*), 1)`,
      })
      .from(contacts)
      .where(eq(contacts.isDeleted, false));

    // Regional breakdown with stats
    const regionalBreakdown = await db
      .select({
        region: contacts.region,
        count: count(),
        avgLeadScore: sql<number>`AVG(${contacts.leadScore})`,
        companies: sql<number>`COUNT(DISTINCT ${contacts.company})`,
        industries: sql<number>`COUNT(DISTINCT ${contacts.industry})`,
      })
      .from(contacts)
      .where(and(eq(contacts.isDeleted, false), isNotNull(contacts.region), ne(contacts.region, '')))
      .groupBy(contacts.region)
      .orderBy(desc(count()));

    // Calculate data quality score
    const completenessValues = Object.values(dataCompleteness).map(v => Number(v) || 0);
    const dataQualityScore = completenessValues.reduce((sum, val) => sum + val, 0) / completenessValues.length;

    return {
      totalContacts: Number(basicStats.totalContacts),
      totalCompanies: Number(basicStats.totalCompanies),
      uniqueIndustries: Number(basicStats.uniqueIndustries),
      validEmails: Number(basicStats.validEmails),
      averageLeadScore: Number(basicStats.averageLeadScore) || 0,
      contactGrowth: 12, // Placeholder - would calculate from historical data
      leadQualityDistribution: {
        high: Math.round(((leadScoreDistribution.filter(d => ['9-10', '8-9', '7-8'].includes(d.range)).reduce((sum, d) => sum + Number(d.count), 0)) / Number(basicStats.totalContacts)) * 100)
      },
      geographicDistribution: geographicDistribution.map(g => ({
        name: g.country,
        count: Number(g.count)
      })),
      industryDistribution: industryDistribution.map(i => ({
        industry: i.industry,
        count: Number(i.count)
      })),
      companySizeDistribution: companySizeDistribution.map(c => ({
        name: c.size || 'Unknown',
        count: Number(c.count)
      })),
      topCompanies: topCompanies.map(c => ({
        company: c.company,
        industry: c.industry,
        count: Number(c.count)
      })),
      leadScoreDistribution: leadScoreDistribution.map(l => ({
        range: l.range,
        count: Number(l.count)
      })),
      communicationChannels: {
        email: Number(communicationChannels.email),
        phone: Number(communicationChannels.phone),
        linkedin: Number(communicationChannels.linkedin),
      },
      topTechnologies: topTechnologies.map(t => ({
        technology: t.technology,
        count: Number(t.count)
      })),
      dataCompleteness: {
        email: Number(dataCompleteness.email),
        phone: Number(dataCompleteness.phone),
        company: Number(dataCompleteness.company),
        industry: Number(dataCompleteness.industry),
        title: Number(dataCompleteness.title),
        location: Number(dataCompleteness.location),
        linkedin: Number(dataCompleteness.linkedin),
        leadScore: Number(dataCompleteness.leadScore),
      },
      regionalBreakdown: regionalBreakdown.map(r => ({
        region: r.region,
        count: Number(r.count),
        avgLeadScore: Number(r.avgLeadScore) || 0,
        companies: Number(r.companies),
        industries: Number(r.industries),
      })),
      dataQualityScore,
      completeProfiles: Math.round((dataQualityScore / 100) * Number(basicStats.totalContacts)),
      missingCriticalData: Math.round(((100 - dataQualityScore) / 100) * Number(basicStats.totalContacts)),
      enrichedContacts: Math.round((Number(dataCompleteness.leadScore) / 100) * Number(basicStats.totalContacts)),
      contactSources: [
        { source: 'CSV Import', count: Math.round(Number(basicStats.totalContacts) * 0.75) },
        { source: 'Manual Entry', count: Math.round(Number(basicStats.totalContacts) * 0.15) },
        { source: 'API Integration', count: Math.round(Number(basicStats.totalContacts) * 0.10) },
      ]
    };
  }

  async getAnalyticsTrends() {
    // Generate contact growth trend (last 30 days)
    const contactGrowth = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayStats] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          new: sql<number>`COUNT(CASE WHEN DATE(${contacts.createdAt}) = ${dateStr} THEN 1 END)`,
        })
        .from(contacts)
        .where(and(
          eq(contacts.isDeleted, false),
          sql`${contacts.createdAt} <= ${date.toISOString()}`
        ));
      
      contactGrowth.push({
        date: dateStr,
        total: Number(dayStats.total),
        new: Number(dayStats.new),
      });
    }

    return { contactGrowth };
  }

  async getAnalyticsActivities() {
    // Activity timeline (last 30 days)
    const timeline = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const [dayActivities] = await db
        .select({
          created: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'created' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
          updated: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'updated' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
          enriched: sql<number>`COUNT(CASE WHEN ${contactActivities.activityType} = 'enriched' AND DATE(${contactActivities.createdAt}) = ${dateStr} THEN 1 END)`,
        })
        .from(contactActivities)
        .where(sql`DATE(${contactActivities.createdAt}) = ${dateStr}`);
      
      timeline.push({
        date: dateStr,
        created: Number(dayActivities.created),
        updated: Number(dayActivities.updated),
        enriched: Number(dayActivities.enriched),
      });
    }

    // Activity summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const summary = await db
      .select({
        type: contactActivities.activityType,
        count: count(),
      })
      .from(contactActivities)
      .where(sql`${contactActivities.createdAt} >= ${thirtyDaysAgo.toISOString()}`)
      .groupBy(contactActivities.activityType)
      .orderBy(desc(count()));

    // Recent activities
    const recent = await db
      .select()
      .from(contactActivities)
      .orderBy(desc(contactActivities.createdAt))
      .limit(20);

    return {
      timeline,
      summary: summary.map(s => ({
        type: s.type,
        count: Number(s.count),
      })),
      recent: recent.map(r => ({
        id: r.id,
        activityType: r.activityType,
        description: r.description,
        createdAt: r.createdAt,
      })),
    };
  }

  async getAnalyticsImports() {
    // Import summary
    const [summary] = await db
      .select({
        totalImports: count(),
        totalRecords: sql<number>`SUM(${importJobs.totalRows})`,
        successfulRecords: sql<number>`SUM(${importJobs.successfulRows})`,
      })
      .from(importJobs);

    const successRate = summary.totalRecords > 0 
      ? Math.round((Number(summary.successfulRecords) / Number(summary.totalRecords)) * 100)
      : 0;

    // Import history
    const history = await db
      .select()
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(20);

    return {
      summary: {
        totalImports: Number(summary.totalImports),
        totalRecords: Number(summary.totalRecords),
        successRate,
      },
      history: history.map(h => ({
        id: h.id,
        filename: h.filename,
        status: h.status,
        totalRows: h.totalRows,
        successfulRows: h.successfulRows,
        createdAt: h.createdAt,
      })),
    };
  }

  async createContactActivity(activity: InsertContactActivity): Promise<ContactActivity> {
    const [created] = await db
      .insert(contactActivities)
      .values(activity)
      .returning();
    return created;
  }

  async getContactActivities(contactId: string): Promise<ContactActivity[]> {
    return await db
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, contactId))
      .orderBy(desc(contactActivities.createdAt));
  }

  async createImportJob(job: InsertImportJob): Promise<ImportJob> {
    const [created] = await db
      .insert(importJobs)
      .values(job)
      .returning();
    return created;
  }

  async updateImportJob(id: string, updates: Partial<ImportJob>): Promise<ImportJob | undefined> {
    const [updated] = await db
      .update(importJobs)
      .set(updates)
      .where(eq(importJobs.id, id))
      .returning();
    return updated || undefined;
  }

  async getImportJob(id: string): Promise<ImportJob | undefined> {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, id));
    return job || undefined;
  }

  // User authentication methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  // Session management methods
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.token, token), sql`${sessions.expiresAt} > NOW()`));
    return session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.token, token));
    return (result.rowCount || 0) > 0;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await db.delete(sessions).where(sql`${sessions.expiresAt} <= NOW()`);
    return result.rowCount || 0;
  }

  // Fix empty or incorrectly mapped fullNames for existing contacts
  async fixEmptyFullNames(): Promise<number> {
    console.log('🔧 Starting comprehensive full name fix process...');
    
    // Get all contacts with issues in fullName mapping
    const contactsToFix = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isDeleted, false),
          or(
            // Empty or null fullName
            sql`(${contacts.fullName} IS NULL OR TRIM(${contacts.fullName}) = '')`,
            // Hex ID pattern (MongoDB ObjectId-like strings)
            sql`${contacts.fullName} ~ '^[a-f0-9]{24}$'`,
            // Other ID-like patterns
            sql`${contacts.fullName} ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'`,
            // Incorrect mapping when both names exist
            and(
              isNotNull(contacts.firstName),
              isNotNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.firstName}) || ' ' || TRIM(${contacts.lastName})`
            ),
            // Incorrect mapping when only firstName exists
            and(
              isNotNull(contacts.firstName),
              isNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.firstName})`
            ),
            // Incorrect mapping when only lastName exists  
            and(
              isNull(contacts.firstName),
              isNotNull(contacts.lastName),
              sql`${contacts.fullName} != TRIM(${contacts.lastName})`
            )
          ),
          // Only fix if we have name data to work with
          sql`(${contacts.firstName} IS NOT NULL OR ${contacts.lastName} IS NOT NULL)`
        )
      );

    console.log(`📊 Found ${contactsToFix.length} contacts with missing/incorrect full names`);

    let fixedCount = 0;
    
    for (const contact of contactsToFix) {
      const oldFullName = contact.fullName;
      const newFullName = generateFullName(contact.firstName, contact.lastName, null);
      
      if (newFullName && newFullName.trim() && newFullName !== oldFullName) {
        await db
          .update(contacts)
          .set({ 
            fullName: newFullName,
            updatedAt: new Date()
          })
          .where(eq(contacts.id, contact.id));
          
        console.log(`✅ Fixed: "${oldFullName}" → "${newFullName}" (${contact.email})`);
        
        // Log activity for this fix
        await this.createContactActivity({
          contactId: contact.id,
          activityType: 'updated',
          description: `Fixed full name mapping from "${oldFullName}" to "${newFullName}"`,
          changes: { fullName: newFullName }
        });
        
        fixedCount++;
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} contact full names`);
    return fixedCount;
  }

  // Enhanced company auto-fill functionality - searches by company name, website, or LinkedIn
  async getCompanyTemplate(companyName?: string, website?: string, companyLinkedIn?: string): Promise<Partial<Contact> | null> {
    // Build search conditions for any of the three key identifiers
    const searchConditions = [];
    
    if (companyName?.trim()) {
      searchConditions.push(ilike(contacts.company, `%${companyName.trim()}%`));
    }
    
    if (website?.trim()) {
      // Clean URL for better matching
      const cleanWebsite = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      searchConditions.push(ilike(contacts.website, `%${cleanWebsite}%`));
    }
    
    if (companyLinkedIn?.trim()) {
      const cleanLinkedIn = companyLinkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '');
      searchConditions.push(ilike(contacts.companyLinkedIn, `%${cleanLinkedIn}%`));
    }

    if (searchConditions.length === 0) return null;

    // Find contacts matching any of the identifiers
    const companyContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(...searchConditions)
      ))
      .orderBy(desc(contacts.createdAt));

    if (companyContacts.length === 0) return null;

    // Score each contact based on how much company info they have
    const scoredContacts = companyContacts.map(contact => {
      let score = 0;
      const companyFields = [
        'company', 'employees', 'employeeSizeBracket', 'industry', 'website', 
        'companyLinkedIn', 'technologies', 'annualRevenue', 'companyAddress', 
        'companyCity', 'companyState', 'companyCountry', 'companyAge', 
        'technologyCategory', 'businessType'
      ];

      companyFields.forEach(field => {
        const value = contact[field as keyof Contact];
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value) && value.length > 0) score++;
          else if (!Array.isArray(value)) score++;
        }
      });

      return { contact, score };
    });

    // Get the contact with the highest score (most complete company info)
    const bestContact = scoredContacts.reduce((best, current) => 
      current.score > best.score ? current : best
    ).contact;

    // Extract only company-related fields for the template
    const companyTemplate: Partial<Contact> = {};
    const companyFields = [
      'company', 'employees', 'employeeSizeBracket', 'industry', 'website', 
      'companyLinkedIn', 'technologies', 'annualRevenue', 'companyAddress', 
      'companyCity', 'companyState', 'companyCountry', 'companyAge', 
      'technologyCategory', 'businessType'
    ] as const;

    companyFields.forEach(field => {
      const value = bestContact[field];
      if (value !== null && value !== undefined && value !== '') {
        (companyTemplate as any)[field] = value;
      }
    });

    return Object.keys(companyTemplate).length > 1 ? companyTemplate : null; // At least company name + 1 more field
  }

  async createContactWithAutoFill(insertContact: InsertContact): Promise<Contact> {
    let contactData = { ...insertContact };
    let autoFilledFields: string[] = [];

    // If any company identifier is provided, try to auto-fill company details
    if (contactData.company?.trim() || contactData.website?.trim() || contactData.companyLinkedIn?.trim()) {
      const companyTemplate = await this.getCompanyTemplate(
        contactData.company || undefined, 
        contactData.website || undefined, 
        contactData.companyLinkedIn || undefined
      );
      
      if (companyTemplate) {
        // Only auto-fill fields that are empty/null in the new contact
        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        
        fieldsToFill.forEach(field => {
          const existingValue = contactData[field as keyof InsertContact];
          const templateValue = companyTemplate[field];
          
          // Only fill if the field is empty and we have template data
          if ((!existingValue || existingValue === '') && templateValue !== null && templateValue !== undefined) {
            (contactData as any)[field] = templateValue;
            autoFilledFields.push(field as string);
          }
        });
      }
    }

    // Auto-generate fullName if not provided
    const finalContactData = {
      ...contactData,
      fullName: generateFullName(contactData.firstName, contactData.lastName, contactData.fullName),
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(finalContactData)
      .returning();
    
    // Log activity with auto-fill information
    let activityDescription = 'Contact added to database';
    if (autoFilledFields.length > 0) {
      activityDescription += ` with auto-filled company details: ${autoFilledFields.join(', ')}`;
    }
    
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: activityDescription,
      changes: autoFilledFields.length > 0 ? { autoFilledFields } : undefined,
    });
    
    return contact;
  }

  async updateContactWithAutoFill(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    // Get existing contact to check current company
    const existingContact = await this.getContact(id);
    if (!existingContact) return undefined;

    let contactData = { ...updates };
    let autoFilledFields: string[] = [];
    let activityDescription = 'Contact information updated';

    // Check if company name is being changed or added, or if company exists but fields are missing
    const newCompany = contactData.company;
    const oldCompany = existingContact.company;
    const companyToCheck = newCompany || oldCompany;
    
    if (companyToCheck?.trim() || existingContact.website?.trim() || existingContact.companyLinkedIn?.trim()) {
      // Company identifiers exist - try to auto-fill missing company details
      const companyTemplate = await this.getCompanyTemplate(
        companyToCheck || undefined, 
        (contactData.website || existingContact.website) || undefined, 
        (contactData.companyLinkedIn || existingContact.companyLinkedIn) || undefined
      );
      
      if (companyTemplate) {
        // Merge current contact data with updates to see what fields are empty
        const mergedData = { ...existingContact, ...contactData };
        
        // Only auto-fill fields that are empty/null in the merged contact
        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        
        fieldsToFill.forEach(field => {
          const currentValue = (mergedData as any)[field];
          const templateValue = companyTemplate[field];
          
          // Only fill if the field is empty and we have template data
          if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
            (contactData as any)[field] = templateValue;
            autoFilledFields.push(field as string);
          }
        });

        // Log completion for debugging if needed
        
        if (autoFilledFields.length > 0) {
          activityDescription += ` with auto-filled company details: ${autoFilledFields.join(', ')}`;
        }
      }
    }

    // Auto-generate fullName if firstName or lastName is being updated
    if ('firstName' in updates || 'lastName' in updates || ('fullName' in updates && !updates.fullName)) {
      contactData.fullName = generateFullName(
        updates.firstName ?? existingContact.firstName,
        updates.lastName ?? existingContact.lastName,
        updates.fullName ?? existingContact.fullName
      );
    }
    
    const [contact] = await db
      .update(contacts)
      .set({
        ...contactData,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
      .returning();
    
    if (contact) {
      await this.createContactActivity({
        contactId: contact.id,
        activityType: 'updated',
        description: activityDescription,
        changes: { ...updates, autoFilledFields: autoFilledFields.length > 0 ? autoFilledFields : undefined },
      });
    }
    
    return contact || undefined;
  }

  async bulkAutoFillCompanyDetails(): Promise<{ processed: number; updated: number; companiesProcessed: string[] }> {
    console.log('🔧 Starting bulk company auto-fill process...');
    
    // Get all contacts that have any company identifier (name, website, or LinkedIn)
    const contactsToProcess = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          and(isNotNull(contacts.company), ne(contacts.company, '')),
          and(isNotNull(contacts.website), ne(contacts.website, '')),
          and(isNotNull(contacts.companyLinkedIn), ne(contacts.companyLinkedIn, ''))
        )
      ));

    console.log(`📊 Found ${contactsToProcess.length} contacts with company names`);

    let processed = 0;
    let updated = 0;
    const companiesProcessed: string[] = [];
    const companyTemplateCache = new Map<string, Partial<Contact> | null>();

    for (const contact of contactsToProcess) {
      // Skip if no identifiers are available
      if (!contact.company?.trim() && !contact.website?.trim() && !contact.companyLinkedIn?.trim()) continue;
      
      processed++;
      
      // Create cache key from available identifiers
      const cacheKey = `${contact.company || ''}|${contact.website || ''}|${contact.companyLinkedIn || ''}`;
      
      // Get or cache company template using any available identifiers
      let companyTemplate = companyTemplateCache.get(cacheKey);
      if (companyTemplate === undefined) {
        companyTemplate = await this.getCompanyTemplate(
          contact.company || undefined, 
          contact.website || undefined, 
          contact.companyLinkedIn || undefined
        );
        companyTemplateCache.set(cacheKey, companyTemplate);
      }

      if (!companyTemplate) continue;

      // Check which fields can be auto-filled
      const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
      const autoFilledFields: string[] = [];
      const updateData: any = {};

      fieldsToFill.forEach(field => {
        const currentValue = (contact as any)[field];
        const templateValue = companyTemplate![field];
        
        // Only fill if the field is empty and we have template data
        if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
          updateData[field] = templateValue;
          autoFilledFields.push(field as string);
        }
      });

      // Update contact if there are fields to fill
      if (autoFilledFields.length > 0) {
        await db
          .update(contacts)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id));

        // Log activity
        await this.createContactActivity({
          contactId: contact.id,
          activityType: 'updated',
          description: `Bulk auto-fill applied company details: ${autoFilledFields.join(', ')}`,
          changes: { autoFilledFields },
        });

        updated++;
        
        const companyIdentifier = contact.company || contact.website || contact.companyLinkedIn || 'Unknown Company';
        if (!companiesProcessed.includes(companyIdentifier)) {
          companiesProcessed.push(companyIdentifier);
        }

        console.log(`✅ Auto-filled ${autoFilledFields.length} fields for ${contact.fullName} at ${companyIdentifier}`);
      }
    }

    console.log(`🎉 Bulk auto-fill completed: ${updated}/${processed} contacts updated across ${companiesProcessed.length} companies`);
    
    return {
      processed,
      updated,
      companiesProcessed
    };
  }

  // LinkedIn Enrichment Job Methods
  async createEnrichmentJob(job: InsertEnrichmentJob): Promise<EnrichmentJob> {
    const [enrichmentJob] = await db
      .insert(enrichmentJobs)
      .values(job)
      .returning();
    return enrichmentJob;
  }

  async updateEnrichmentJob(id: string, updates: Partial<EnrichmentJob>): Promise<EnrichmentJob | undefined> {
    const [enrichmentJob] = await db
      .update(enrichmentJobs)
      .set(updates)
      .where(eq(enrichmentJobs.id, id))
      .returning();
    return enrichmentJob || undefined;
  }

  async getEnrichmentJob(id: string): Promise<EnrichmentJob | undefined> {
    const [enrichmentJob] = await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.id, id));
    return enrichmentJob || undefined;
  }

  async getEnrichmentJobsByContact(contactId: string): Promise<EnrichmentJob[]> {
    return await db
      .select()
      .from(enrichmentJobs)
      .where(eq(enrichmentJobs.contactId, contactId))
      .orderBy(desc(enrichmentJobs.createdAt));
  }

  async getRecentEnrichmentJobs(limit: number = 20): Promise<EnrichmentJob[]> {
    return await db
      .select()
      .from(enrichmentJobs)
      .orderBy(desc(enrichmentJobs.createdAt))
      .limit(limit);
  }

  async findContactsByLinkedInUrl(linkedinUrl: string): Promise<Contact[]> {
    // Normalize the LinkedIn URL for flexible matching
    // Handles variations like linkedin.com/in/username, www.linkedin.com/in/username, etc.
    const normalizedUrl = linkedinUrl
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    // Extract the username part if possible
    const usernameMatch = normalizedUrl.match(/linkedin\.com\/in\/([^/?]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;
    
    // Search for contacts with matching LinkedIn URL
    // Use case-insensitive matching and handle URL variations
    const matchingContacts = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.isDeleted, false),
          username 
            ? sql`LOWER(${contacts.personLinkedIn}) LIKE ${`%linkedin.com/in/${username}%`}`
            : ilike(contacts.personLinkedIn, `%${normalizedUrl}%`)
        )
      )
      .orderBy(desc(contacts.createdAt));
    
    return matchingContacts;
  }

  // API Key operations
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [newApiKey] = await db
      .insert(apiKeys)
      .values(apiKey)
      .returning();
    return newApiKey;
  }

  async getApiKeyByHash(hashedKey: string): Promise<ApiKey | undefined> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.hashedKey, hashedKey),
          isNull(apiKeys.revokedAt)
        )
      );
    return apiKey || undefined;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.ownerUserId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async updateApiKeyUsage(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ 
        lastUsedAt: new Date(),
        requestCount: sql`${apiKeys.requestCount} + 1`
      })
      .where(eq(apiKeys.id, id));
  }

  async revokeApiKey(id: string): Promise<boolean> {
    const [revoked] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return !!revoked;
  }

  // Tag operations
  async getTags(): Promise<Tag[]> {
    return await db
      .select()
      .from(tags)
      .orderBy(asc(tags.name));
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db
      .select()
      .from(tags)
      .where(eq(tags.id, id));
    return tag || undefined;
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const [newTag] = await db
      .insert(tags)
      .values(tag)
      .returning();
    return newTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    await db
      .delete(contactTags)
      .where(eq(contactTags.tagId, id));
    
    const [deleted] = await db
      .delete(tags)
      .where(eq(tags.id, id))
      .returning();
    return !!deleted;
  }

  async getContactTags(contactId: string): Promise<Tag[]> {
    const result = await db
      .select({ tag: tags })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contactTags.contactId, contactId));
    return result.map(r => r.tag);
  }

  async addTagToContact(contactId: string, tagId: string): Promise<ContactTag> {
    const existing = await db
      .select()
      .from(contactTags)
      .where(and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [contactTag] = await db
      .insert(contactTags)
      .values({ contactId, tagId })
      .returning();
    return contactTag;
  }

  async removeTagFromContact(contactId: string, tagId: string): Promise<boolean> {
    const [deleted] = await db
      .delete(contactTags)
      .where(and(
        eq(contactTags.contactId, contactId),
        eq(contactTags.tagId, tagId)
      ))
      .returning();
    return !!deleted;
  }

  // Activity operations
  async getRecentActivities(limit: number = 100): Promise<ContactActivity[]> {
    return await db
      .select()
      .from(contactActivities)
      .orderBy(desc(contactActivities.createdAt))
      .limit(limit);
  }

  // API Request Logging
  async logApiRequest(log: InsertApiRequestLog): Promise<ApiRequestLog> {
    const [requestLog] = await db
      .insert(apiRequestLogs)
      .values(log)
      .returning();
    return requestLog;
  }
}

export const storage = new DatabaseStorage();
