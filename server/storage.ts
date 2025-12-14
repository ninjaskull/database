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
  companies,
  dataChangeAudit,
  dataQualityIssues,
  databaseMetrics,
  archivedRecords,
  bulkOperationJobs,
  subscriptionPlans,
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
  type InsertApiRequestLog,
  type Company,
  type InsertCompany,
  type InsertProspect,
  type DataChangeAudit,
  type InsertDataChangeAudit,
  type DataQualityIssue,
  type InsertDataQualityIssue,
  type DatabaseMetrics,
  type InsertDatabaseMetrics,
  type ArchivedRecord,
  type InsertArchivedRecord,
  type BulkOperationJob,
  type InsertBulkOperationJob,
  type BulkProgressEvent,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc, asc, count, sql, or, isNull, isNotNull, ne } from "drizzle-orm";
import { CompanyMatcher } from "./company-matcher";

export interface IStorage {
  // Company operations
  getCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
  }): Promise<{ companies: Company[], total: number }>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByDomain(domain: string): Promise<Company | undefined>;
  getCompanyByName(name: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  bulkImportCompanies(companies: InsertCompany[]): Promise<{ imported: number; duplicates: number }>;
  bulkInsertCompaniesOptimized(companies: InsertCompany[]): Promise<{ inserted: number }>;
  getMissingCompanyDomains(): Promise<{ domain: string; contactCount: number }[]>;
  
  // Prospect operations with company matching
  createProspect(prospect: InsertProspect): Promise<Contact>;
  matchProspectToCompany(contactId: string): Promise<{ matched: boolean; companyId?: string; companyName?: string }>;
  bulkMatchProspectsToCompanies(): Promise<{ matched: number; unmatched: number }>;
  getUnmatchedProspects(): Promise<Contact[]>;
  manuallyAssignCompany(contactId: string, companyId: string): Promise<Contact | undefined>;
  
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
    companyMatchStatus?: string;
  }): Promise<{ contacts: Contact[], total: number }>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  bulkDeleteContacts(ids: string[]): Promise<number>;
  
  // Optimized bulk operations for fast imports
  bulkInsertContactsOptimized(contacts: InsertContact[]): Promise<Contact[]>;
  bulkUpdateContactsOptimized(updates: Map<string, Partial<InsertContact>>): Promise<number>;
  bulkFindDuplicatesByEmails(emails: string[]): Promise<Map<string, Contact>>;
  bulkCreateContactActivities(activities: InsertContactActivity[]): Promise<number>;
  
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
  
  // Company details auto-fill operations (enhanced with email domain matching)
  getCompanyTemplate(companyName?: string, website?: string, companyLinkedIn?: string, email?: string): Promise<Partial<Contact> | null>;
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
  
  // ============ DATA MANAGEMENT & AUDIT OPERATIONS ============
  
  // Audit logging
  logDataChange(audit: InsertDataChangeAudit): Promise<DataChangeAudit>;
  getAuditHistory(entityType: string, entityId: string, limit?: number): Promise<DataChangeAudit[]>;
  getRecentAuditLogs(limit?: number): Promise<DataChangeAudit[]>;
  
  // Data quality issues
  createDataQualityIssue(issue: InsertDataQualityIssue): Promise<DataQualityIssue>;
  getDataQualityIssues(params: {
    entityType?: string;
    severity?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ issues: DataQualityIssue[], total: number }>;
  updateDataQualityIssue(id: string, updates: Partial<DataQualityIssue>): Promise<DataQualityIssue | undefined>;
  resolveDataQualityIssue(id: string, userId: string): Promise<DataQualityIssue | undefined>;
  runDataQualityChecks(): Promise<{ issuesFound: number; issuesCreated: number }>;
  
  // Database metrics
  captureMetricsSnapshot(): Promise<DatabaseMetrics>;
  getLatestMetrics(): Promise<DatabaseMetrics | undefined>;
  getMetricsHistory(days?: number): Promise<DatabaseMetrics[]>;
  
  // Archive operations
  archiveRecord(entityType: string, originalId: string, data: any, userId?: string): Promise<ArchivedRecord>;
  getArchivedRecords(entityType?: string, page?: number, limit?: number): Promise<{ records: ArchivedRecord[], total: number }>;
  restoreArchivedRecord(id: string): Promise<any>;
  cleanupExpiredArchives(): Promise<number>;
  
  // Data health dashboard
  getDatabaseHealthSummary(): Promise<{
    totalRecords: { contacts: number; companies: number; };
    dataQuality: { score: number; issuesByType: Record<string, number>; };
    matchingStatus: { matched: number; unmatched: number; pendingReview: number; };
    growthMetrics: { contactsThisWeek: number; companiesThisWeek: number; };
    recentActivity: { imports: number; enrichments: number; apiRequests: number; };
  }>;

  // Subscription plan operations
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
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

// Helper function to extract domain from email
function extractDomainFromEmail(email: string): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

export class DatabaseStorage implements IStorage {
  // ============ COMPANY OPERATIONS ============
  
  async getCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
  } = {}): Promise<{ companies: Company[], total: number }> {
    const { page = 1, limit = 20, search = '', industry = '' } = params;
    const offset = (page - 1) * limit;
    
    const conditions = [eq(companies.isDeleted, false)];
    
    if (search) {
      conditions.push(
        sql`(${companies.name} ILIKE ${`%${search}%`} OR 
            ${companies.website} ILIKE ${`%${search}%`} OR
            ${search} = ANY(${companies.domains}))`
      );
    }
    
    if (industry) {
      conditions.push(eq(companies.industry, industry));
    }
    
    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(companies)
      .where(whereClause);
    
    const companiesList = await db
      .select()
      .from(companies)
      .where(whereClause)
      .orderBy(desc(companies.createdAt))
      .limit(limit)
      .offset(offset);
    
    return { companies: companiesList, total };
  }
  
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)));
    return company || undefined;
  }
  
  async getCompanyByDomain(domain: string): Promise<Company | undefined> {
    const normalizedDomain = domain.toLowerCase().trim();
    const [company] = await db
      .select()
      .from(companies)
      .where(and(
        sql`${normalizedDomain} = ANY(${companies.domains})`,
        eq(companies.isDeleted, false)
      ));
    return company || undefined;
  }
  
  async getCompanyByName(name: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(
        ilike(companies.name, name.trim()),
        eq(companies.isDeleted, false)
      ));
    return company || undefined;
  }
  
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    // Normalize domains if provided
    const companyData = {
      ...insertCompany,
      domains: insertCompany.domains?.map(d => d.toLowerCase().trim()) || [],
      updatedAt: new Date(),
    };
    
    const [company] = await db
      .insert(companies)
      .values(companyData)
      .returning();
    
    return company;
  }
  
  async updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company | undefined> {
    // Normalize domains if provided
    const updateData = { ...updates };
    if (updates.domains) {
      updateData.domains = updates.domains.map(d => d.toLowerCase().trim());
    }
    
    const [company] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)))
      .returning();
    
    return company || undefined;
  }
  
  async deleteCompany(id: string): Promise<boolean> {
    const [company] = await db
      .update(companies)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.isDeleted, false)))
      .returning();
    
    return !!company;
  }
  
  async bulkImportCompanies(companyList: InsertCompany[]): Promise<{ imported: number; duplicates: number }> {
    let imported = 0;
    let duplicates = 0;
    
    for (const company of companyList) {
      let existing: Company | undefined;
      
      if (company.domains && company.domains.length > 0) {
        for (const domain of company.domains) {
          existing = await this.getCompanyByDomain(domain);
          if (existing) break;
        }
      }
      
      if (!existing && company.name) {
        existing = await this.getCompanyByName(company.name);
      }
      
      if (existing) {
        duplicates++;
      } else {
        await this.createCompany(company);
        imported++;
      }
    }
    
    return { imported, duplicates };
  }

  async bulkInsertCompaniesOptimized(companyList: InsertCompany[]): Promise<{ inserted: number }> {
    if (companyList.length === 0) return { inserted: 0 };

    try {
      const preparedCompanies = companyList.map(company => ({
        ...company,
        domains: company.domains?.map(d => d.toLowerCase().trim()) || [],
        updatedAt: new Date(),
      }));

      const result = await db
        .insert(companies)
        .values(preparedCompanies)
        .onConflictDoNothing()
        .returning({ id: companies.id });

      return { inserted: result.length };
    } catch (error) {
      console.error('Bulk insert error:', error);
      throw error;
    }
  }

  async getMissingCompanyDomains(): Promise<{ domain: string; contactCount: number }[]> {
    const result = await db.execute(sql`
      WITH contact_domains AS (
        SELECT DISTINCT 
          LOWER(email_domain) as domain,
          COUNT(*) as contact_count
        FROM contacts
        WHERE email_domain IS NOT NULL 
          AND email_domain != ''
          AND is_deleted = false
        GROUP BY LOWER(email_domain)
      ),
      existing_company_domains AS (
        SELECT DISTINCT LOWER(unnest(domains)) as domain
        FROM companies
        WHERE is_deleted = false
          AND domains IS NOT NULL
          AND array_length(domains, 1) > 0
      )
      SELECT cd.domain, cd.contact_count::int as contact_count
      FROM contact_domains cd
      LEFT JOIN existing_company_domains ecd ON cd.domain = ecd.domain
      WHERE ecd.domain IS NULL
        AND cd.domain NOT LIKE '%@%'
        AND cd.domain NOT LIKE '%.%@%'
        AND LENGTH(cd.domain) > 3
        AND cd.domain ~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]\\.[a-z]{2,}$'
      ORDER BY cd.contact_count DESC
      LIMIT 1000
    `);

    return result.rows.map((row: any) => ({
      domain: row.domain,
      contactCount: Number(row.contact_count),
    }));
  }
  
  // ============ PROSPECT OPERATIONS WITH COMPANY MATCHING ============
  
  async createProspect(prospect: InsertProspect): Promise<Contact> {
    // Generate full name from first and last name
    const fullName = `${prospect.firstName} ${prospect.lastName}`.trim();
    
    // Extract domain from email for matching
    const emailDomain = extractDomainFromEmail(prospect.email);
    
    // Try to match to a company
    let companyId: string | null = null;
    let companyMatchStatus = 'unmatched';
    let companyDetails: Partial<Contact> = {};
    
    // First try domain matching
    if (emailDomain) {
      const matchedCompany = await this.getCompanyByDomain(emailDomain);
      if (matchedCompany) {
        companyId = matchedCompany.id;
        companyMatchStatus = 'matched';
        // Auto-fill company details from matched company
        companyDetails = {
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        };
      }
    }
    
    // If no domain match and company name provided, try name matching
    if (!companyId && prospect.company) {
      const matchedCompany = await this.getCompanyByName(prospect.company);
      if (matchedCompany) {
        companyId = matchedCompany.id;
        companyMatchStatus = 'matched';
        companyDetails = {
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        };
      } else {
        // Mark for review since company name was provided but not found
        companyMatchStatus = 'pending_review';
      }
    }
    
    // Create the contact with auto-filled company details
    const contactValues = {
      fullName,
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      email: prospect.email,
      mobilePhone: prospect.mobilePhone,
      personLinkedIn: prospect.personLinkedIn,
      title: prospect.title,
      company: prospect.company || companyDetails.company,
      companyId: companyId || undefined,
      companyMatchStatus,
      emailDomain,
      industry: companyDetails.industry,
      employees: companyDetails.employees,
      employeeSizeBracket: companyDetails.employeeSizeBracket,
      website: companyDetails.website,
      companyLinkedIn: companyDetails.companyLinkedIn,
      technologies: companyDetails.technologies,
      annualRevenue: companyDetails.annualRevenue,
      companyCity: companyDetails.companyCity,
      companyState: companyDetails.companyState,
      companyCountry: companyDetails.companyCountry,
      companyAddress: companyDetails.companyAddress,
      updatedAt: new Date(),
    };
    
    const [contact] = await db
      .insert(contacts)
      .values(contactValues)
      .returning();
    
    // Log activity
    await this.createContactActivity({
      contactId: contact.id,
      activityType: 'created',
      description: `Prospect added${companyId ? ' and matched to company' : ''}`,
    });
    
    return contact;
  }
  
  async matchProspectToCompany(contactId: string): Promise<{ matched: boolean; companyId?: string; companyName?: string }> {
    const contact = await this.getContact(contactId);
    if (!contact) return { matched: false };
    
    // Already matched
    if (contact.companyId && contact.companyMatchStatus === 'matched') {
      const company = await this.getCompany(contact.companyId);
      return { matched: true, companyId: contact.companyId, companyName: company?.name };
    }
    
    // Extract domain from email
    const emailDomain = contact.email ? extractDomainFromEmail(contact.email) : null;
    
    // Try domain matching first
    if (emailDomain) {
      const matchedCompany = await this.getCompanyByDomain(emailDomain);
      if (matchedCompany) {
        await this.updateContact(contactId, {
          companyId: matchedCompany.id,
          companyMatchStatus: 'matched',
          company: matchedCompany.name,
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        });
        return { matched: true, companyId: matchedCompany.id, companyName: matchedCompany.name };
      }
    }
    
    // Try company name matching
    if (contact.company) {
      const matchedCompany = await this.getCompanyByName(contact.company);
      if (matchedCompany) {
        await this.updateContact(contactId, {
          companyId: matchedCompany.id,
          companyMatchStatus: 'matched',
          industry: matchedCompany.industry,
          employees: matchedCompany.employees,
          employeeSizeBracket: matchedCompany.employeeSizeBracket,
          website: matchedCompany.website,
          companyLinkedIn: matchedCompany.linkedinUrl,
          technologies: matchedCompany.technologies ? matchedCompany.technologies.split(',').map(t => t.trim()) : null,
          annualRevenue: matchedCompany.annualRevenue,
          companyCity: matchedCompany.city,
          companyState: matchedCompany.state,
          companyCountry: matchedCompany.country,
          companyAddress: matchedCompany.address,
        });
        return { matched: true, companyId: matchedCompany.id, companyName: matchedCompany.name };
      }
    }
    
    return { matched: false };
  }
  
  async bulkMatchProspectsToCompanies(): Promise<{ matched: number; unmatched: number }> {
    let matched = 0;
    let unmatched = 0;
    
    // Get all unmatched contacts
    const unmatchedContacts = await this.getUnmatchedProspects();
    
    for (const contact of unmatchedContacts) {
      const result = await this.matchProspectToCompany(contact.id);
      if (result.matched) {
        matched++;
      } else {
        unmatched++;
      }
    }
    
    return { matched, unmatched };
  }
  
  async getUnmatchedProspects(): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          eq(contacts.companyMatchStatus, 'unmatched'),
          eq(contacts.companyMatchStatus, 'pending_review'),
          isNull(contacts.companyMatchStatus)
        )
      ))
      .orderBy(desc(contacts.createdAt));
  }
  
  async manuallyAssignCompany(contactId: string, companyId: string): Promise<Contact | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;
    
    const updated = await this.updateContact(contactId, {
      companyId: company.id,
      companyMatchStatus: 'manual',
      company: company.name,
      industry: company.industry,
      employees: company.employees,
      employeeSizeBracket: company.employeeSizeBracket,
      website: company.website,
      companyLinkedIn: company.linkedinUrl,
      technologies: company.technologies ? company.technologies.split(',').map(t => t.trim()) : null,
      annualRevenue: company.annualRevenue,
      companyCity: company.city,
      companyState: company.state,
      companyCountry: company.country,
      companyAddress: company.address,
    });
    
    if (updated) {
      await this.createContactActivity({
        contactId: contactId,
        activityType: 'updated',
        description: `Manually assigned to company: ${company.name}`,
      });
    }
    
    return updated;
  }

  // ============ CONTACT OPERATIONS ============
  
  async getContacts(params: {
    page?: number;
    limit?: number;
    search?: string;
    industry?: string;
    employeeSizeBracket?: string;
    country?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    companyMatchStatus?: string;
  } = {}): Promise<{ contacts: Contact[], total: number }> {
    const {
      page = 1,
      limit = 20,
      search = '',
      industry = '',
      employeeSizeBracket = '',
      country = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      companyMatchStatus = ''
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
    
    if (companyMatchStatus) {
      conditions.push(eq(contacts.companyMatchStatus, companyMatchStatus));
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

  /**
   * Optimized bulk insert contacts - uses batch database operations
   * Returns created contacts without individual activity logging for speed
   */
  async bulkInsertContactsOptimized(contactList: InsertContact[]): Promise<Contact[]> {
    if (contactList.length === 0) return [];

    try {
      // Prepare all contacts with generated full names
      const preparedContacts = contactList.map(contact => ({
        ...contact,
        fullName: generateFullName(contact.firstName, contact.lastName, contact.fullName),
        updatedAt: new Date(),
      }));

      // Single bulk insert operation
      const createdContacts = await db
        .insert(contacts)
        .values(preparedContacts)
        .returning();

      return createdContacts;
    } catch (error) {
      console.error('Bulk insert contacts error:', error);
      throw error;
    }
  }

  /**
   * Optimized bulk update contacts - uses parallel updates
   * Updates is a Map of contactId -> partial updates
   */
  async bulkUpdateContactsOptimized(updates: Map<string, Partial<InsertContact>>): Promise<number> {
    if (updates.size === 0) return 0;

    let updatedCount = 0;
    const updateEntries = Array.from(updates.entries());

    // Process updates in parallel chunks
    const chunkSize = 50;
    for (let i = 0; i < updateEntries.length; i += chunkSize) {
      const chunk = updateEntries.slice(i, i + chunkSize);
      
      const updatePromises = chunk.map(async ([id, updateData]) => {
        try {
          const [updated] = await db
            .update(contacts)
            .set({
              ...updateData,
              updatedAt: new Date(),
            })
            .where(and(eq(contacts.id, id), eq(contacts.isDeleted, false)))
            .returning({ id: contacts.id });
          
          return updated ? 1 : 0;
        } catch (error) {
          console.error(`Failed to update contact ${id}:`, error);
          return 0;
        }
      });

      const results = await Promise.all(updatePromises);
      updatedCount += results.reduce((sum: number, count: number) => sum + count, 0);
    }

    return updatedCount;
  }

  /**
   * Bulk find duplicates by email - optimized single query
   */
  async bulkFindDuplicatesByEmails(emails: string[]): Promise<Map<string, Contact>> {
    if (emails.length === 0) return new Map();

    const lowercaseEmails = emails.map(e => e.toLowerCase());
    
    const foundContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        sql`LOWER(${contacts.email}) = ANY(${lowercaseEmails})`
      ));

    const duplicateMap = new Map<string, Contact>();
    for (const contact of foundContacts) {
      if (contact.email) {
        duplicateMap.set(contact.email.toLowerCase(), contact);
      }
    }

    return duplicateMap;
  }

  /**
   * Bulk create contact activities - optimized batch insert
   */
  async bulkCreateContactActivities(activities: InsertContactActivity[]): Promise<number> {
    if (activities.length === 0) return 0;

    try {
      const result = await db
        .insert(contactActivities)
        .values(activities)
        .returning({ id: contactActivities.id });
      
      return result.length;
    } catch (error) {
      console.error('Bulk create activities error:', error);
      return 0;
    }
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

  // Enhanced company auto-fill functionality with smart matching
  // Uses email domain extraction, company name normalization, fuzzy matching, and multi-source data merging
  async getCompanyTemplate(
    companyName?: string, 
    website?: string, 
    companyLinkedIn?: string,
    email?: string
  ): Promise<Partial<Contact> | null> {
    // Extract email domain for additional matching
    const emailDomain = CompanyMatcher.extractEmailDomain(email);
    
    // Build comprehensive search conditions
    const searchConditions = [];
    
    // Normalized company name matching
    if (companyName?.trim()) {
      const normalizedName = CompanyMatcher.normalizeCompanyName(companyName);
      if (normalizedName) {
        searchConditions.push(ilike(contacts.company, `%${companyName.trim()}%`));
        // Also search for normalized version if different
        if (normalizedName !== companyName.toLowerCase().trim()) {
          searchConditions.push(ilike(contacts.company, `%${normalizedName}%`));
        }
      }
    }
    
    // Website domain matching
    if (website?.trim()) {
      const cleanWebsite = CompanyMatcher.normalizeWebsite(website);
      if (cleanWebsite) {
        searchConditions.push(ilike(contacts.website, `%${cleanWebsite}%`));
      }
    }
    
    // Company LinkedIn matching
    if (companyLinkedIn?.trim()) {
      const cleanLinkedIn = companyLinkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '');
      searchConditions.push(ilike(contacts.companyLinkedIn, `%${cleanLinkedIn}%`));
    }
    
    // Email domain matching - powerful for finding company contacts
    if (emailDomain) {
      searchConditions.push(ilike(contacts.email, `%@${emailDomain}`));
      searchConditions.push(ilike(contacts.website, `%${emailDomain}%`));
    }

    if (searchConditions.length === 0) return null;

    // Find contacts matching any of the identifiers (limit to 100 for performance)
    const companyContacts = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(...searchConditions)
      ))
      .orderBy(desc(contacts.createdAt))
      .limit(100);

    if (companyContacts.length === 0) return null;

    // Use advanced scoring to find best matches
    const bestMatches = CompanyMatcher.findBestMatches(
      companyContacts,
      companyName,
      website,
      companyLinkedIn,
      email,
      10  // Get top 10 matches
    );

    if (bestMatches.length === 0) return null;

    // Filter to only high-confidence matches (score > 30)
    const highConfidenceMatches = bestMatches.filter(m => m.score > 30);
    
    if (highConfidenceMatches.length === 0) {
      // Fall back to best single match if no high confidence matches
      return CompanyMatcher.extractCompanyFields(bestMatches[0].contact);
    }

    // Merge data from multiple high-quality sources for the most complete template
    const matchedContacts = highConfidenceMatches.map(m => m.contact);
    const mergedTemplate = CompanyMatcher.mergeCompanyData(matchedContacts);

    // Ensure we have meaningful data (at least company name + 1 more field)
    const fieldCount = Object.keys(mergedTemplate).length;
    if (fieldCount < 2) return null;

    return mergedTemplate;
  }

  async createContactWithAutoFill(insertContact: InsertContact): Promise<Contact> {
    let contactData = { ...insertContact };
    let autoFilledFields: string[] = [];

    // Smart company auto-fill: uses company name, website, LinkedIn, AND email domain
    const hasCompanyIdentifier = 
      contactData.company?.trim() || 
      contactData.website?.trim() || 
      contactData.companyLinkedIn?.trim() ||
      contactData.email?.trim();  // Email domain can identify company

    if (hasCompanyIdentifier) {
      const companyTemplate = await this.getCompanyTemplate(
        contactData.company || undefined, 
        contactData.website || undefined, 
        contactData.companyLinkedIn || undefined,
        contactData.email || undefined  // Use email for domain-based matching
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

    // Smart company auto-fill: uses company name, website, LinkedIn, AND email domain
    const newCompany = contactData.company;
    const oldCompany = existingContact.company;
    const companyToCheck = newCompany || oldCompany;
    const emailToUse = contactData.email || existingContact.email;
    
    const hasCompanyIdentifier = 
      companyToCheck?.trim() || 
      existingContact.website?.trim() || 
      contactData.website?.trim() ||
      existingContact.companyLinkedIn?.trim() || 
      contactData.companyLinkedIn?.trim() ||
      emailToUse?.trim();  // Email domain can identify company

    if (hasCompanyIdentifier) {
      // Company identifiers exist - try to auto-fill missing company details
      const companyTemplate = await this.getCompanyTemplate(
        companyToCheck || undefined, 
        (contactData.website || existingContact.website) || undefined, 
        (contactData.companyLinkedIn || existingContact.companyLinkedIn) || undefined,
        emailToUse || undefined  // Use email for domain-based matching
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
    console.log('🔧 Starting smart bulk company auto-fill process...');
    
    // Get all contacts that have any company identifier (name, website, LinkedIn, or email)
    const contactsToProcess = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          and(isNotNull(contacts.company), ne(contacts.company, '')),
          and(isNotNull(contacts.website), ne(contacts.website, '')),
          and(isNotNull(contacts.companyLinkedIn), ne(contacts.companyLinkedIn, '')),
          and(isNotNull(contacts.email), ne(contacts.email, ''))  // Include email-based matching
        )
      ));

    console.log(`📊 Found ${contactsToProcess.length} contacts with company identifiers`);

    let processed = 0;
    let updated = 0;
    const companiesProcessed: string[] = [];
    const companyTemplateCache = new Map<string, Partial<Contact> | null>();

    for (const contact of contactsToProcess) {
      // Extract email domain for smarter caching
      const emailDomain = CompanyMatcher.extractEmailDomain(contact.email);
      
      // Skip if no useful identifiers are available
      if (!contact.company?.trim() && !contact.website?.trim() && !contact.companyLinkedIn?.trim() && !emailDomain) continue;
      
      processed++;
      
      // Create cache key from available identifiers including email domain
      const normalizedCompany = CompanyMatcher.normalizeCompanyName(contact.company);
      const normalizedWebsite = CompanyMatcher.normalizeWebsite(contact.website);
      const cacheKey = `${normalizedCompany}|${normalizedWebsite}|${contact.companyLinkedIn || ''}|${emailDomain || ''}`;
      
      // Get or cache company template using any available identifiers
      let companyTemplate = companyTemplateCache.get(cacheKey);
      if (companyTemplate === undefined) {
        companyTemplate = await this.getCompanyTemplate(
          contact.company || undefined, 
          contact.website || undefined, 
          contact.companyLinkedIn || undefined,
          contact.email || undefined  // Use email for domain-based matching
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

  // ============ DATA MANAGEMENT & AUDIT OPERATIONS ============

  // Audit logging
  async logDataChange(audit: InsertDataChangeAudit): Promise<DataChangeAudit> {
    const [log] = await db
      .insert(dataChangeAudit)
      .values(audit)
      .returning();
    return log;
  }

  async getAuditHistory(entityType: string, entityId: string, limit: number = 50): Promise<DataChangeAudit[]> {
    return await db
      .select()
      .from(dataChangeAudit)
      .where(and(
        eq(dataChangeAudit.entityType, entityType),
        eq(dataChangeAudit.entityId, entityId)
      ))
      .orderBy(desc(dataChangeAudit.createdAt))
      .limit(limit);
  }

  async getRecentAuditLogs(limit: number = 100): Promise<DataChangeAudit[]> {
    return await db
      .select()
      .from(dataChangeAudit)
      .orderBy(desc(dataChangeAudit.createdAt))
      .limit(limit);
  }

  // Data quality issues
  async createDataQualityIssue(issue: InsertDataQualityIssue): Promise<DataQualityIssue> {
    const [newIssue] = await db
      .insert(dataQualityIssues)
      .values(issue)
      .returning();
    return newIssue;
  }

  async getDataQualityIssues(params: {
    entityType?: string;
    severity?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ issues: DataQualityIssue[], total: number }> {
    const { entityType, severity, status = 'open', page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (entityType) conditions.push(eq(dataQualityIssues.entityType, entityType));
    if (severity) conditions.push(eq(dataQualityIssues.severity, severity));
    if (status) conditions.push(eq(dataQualityIssues.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(dataQualityIssues)
      .where(whereClause);

    const issues = await db
      .select()
      .from(dataQualityIssues)
      .where(whereClause)
      .orderBy(desc(dataQualityIssues.createdAt))
      .limit(limit)
      .offset(offset);

    return { issues, total };
  }

  async updateDataQualityIssue(id: string, updates: Partial<DataQualityIssue>): Promise<DataQualityIssue | undefined> {
    const [issue] = await db
      .update(dataQualityIssues)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataQualityIssues.id, id))
      .returning();
    return issue || undefined;
  }

  async resolveDataQualityIssue(id: string, userId: string): Promise<DataQualityIssue | undefined> {
    const [issue] = await db
      .update(dataQualityIssues)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dataQualityIssues.id, id))
      .returning();
    return issue || undefined;
  }

  async runDataQualityChecks(): Promise<{ issuesFound: number; issuesCreated: number }> {
    let issuesFound = 0;
    let issuesCreated = 0;

    // Check for contacts missing email
    const contactsMissingEmail = await db
      .select({ id: contacts.id, fullName: contacts.fullName })
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(isNull(contacts.email), eq(contacts.email, ''))
      ))
      .limit(1000);

    for (const contact of contactsMissingEmail) {
      issuesFound++;
      const existing = await db
        .select()
        .from(dataQualityIssues)
        .where(and(
          eq(dataQualityIssues.entityType, 'contact'),
          eq(dataQualityIssues.entityId, contact.id),
          eq(dataQualityIssues.issueType, 'missing_email'),
          eq(dataQualityIssues.status, 'open')
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.createDataQualityIssue({
          entityType: 'contact',
          entityId: contact.id,
          issueType: 'missing_email',
          severity: 'high',
          description: `Contact "${contact.fullName}" is missing an email address`,
          fieldName: 'email'
        });
        issuesCreated++;
      }
    }

    // Check for contacts missing phone
    const contactsMissingPhone = await db
      .select({ id: contacts.id, fullName: contacts.fullName })
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(isNull(contacts.mobilePhone), eq(contacts.mobilePhone, '')),
        or(isNull(contacts.corporatePhone), eq(contacts.corporatePhone, ''))
      ))
      .limit(1000);

    for (const contact of contactsMissingPhone) {
      issuesFound++;
      const existing = await db
        .select()
        .from(dataQualityIssues)
        .where(and(
          eq(dataQualityIssues.entityType, 'contact'),
          eq(dataQualityIssues.entityId, contact.id),
          eq(dataQualityIssues.issueType, 'missing_phone'),
          eq(dataQualityIssues.status, 'open')
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.createDataQualityIssue({
          entityType: 'contact',
          entityId: contact.id,
          issueType: 'missing_phone',
          severity: 'medium',
          description: `Contact "${contact.fullName}" is missing phone numbers`,
          fieldName: 'mobilePhone'
        });
        issuesCreated++;
      }
    }

    // Check for unmatched contacts
    const unmatchedContacts = await db
      .select({ id: contacts.id, fullName: contacts.fullName, company: contacts.company })
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          eq(contacts.companyMatchStatus, 'unmatched'),
          isNull(contacts.companyMatchStatus)
        ),
        isNotNull(contacts.company)
      ))
      .limit(500);

    for (const contact of unmatchedContacts) {
      issuesFound++;
      const existing = await db
        .select()
        .from(dataQualityIssues)
        .where(and(
          eq(dataQualityIssues.entityType, 'contact'),
          eq(dataQualityIssues.entityId, contact.id),
          eq(dataQualityIssues.issueType, 'unmatched_company'),
          eq(dataQualityIssues.status, 'open')
        ))
        .limit(1);

      if (existing.length === 0) {
        await this.createDataQualityIssue({
          entityType: 'contact',
          entityId: contact.id,
          issueType: 'unmatched_company',
          severity: 'low',
          description: `Contact "${contact.fullName}" has company "${contact.company}" but is not matched to a company record`,
          fieldName: 'companyId'
        });
        issuesCreated++;
      }
    }

    return { issuesFound, issuesCreated };
  }

  // Database metrics
  async captureMetricsSnapshot(): Promise<DatabaseMetrics> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total contacts
    const [totalContactsResult] = await db.select({ count: count() }).from(contacts);
    const [activeContactsResult] = await db.select({ count: count() }).from(contacts).where(eq(contacts.isDeleted, false));
    const [deletedContactsResult] = await db.select({ count: count() }).from(contacts).where(eq(contacts.isDeleted, true));

    // Total companies
    const [totalCompaniesResult] = await db.select({ count: count() }).from(companies);
    const [activeCompaniesResult] = await db.select({ count: count() }).from(companies).where(eq(companies.isDeleted, false));

    // Match statistics
    const [matchedResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), eq(contacts.companyMatchStatus, 'matched')));
    const [unmatchedResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), or(eq(contacts.companyMatchStatus, 'unmatched'), isNull(contacts.companyMatchStatus))));
    const [pendingResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), eq(contacts.companyMatchStatus, 'pending_review')));

    // Data quality metrics
    const [withEmailResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), isNotNull(contacts.email), ne(contacts.email, '')));
    const [withPhoneResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), or(isNotNull(contacts.mobilePhone), isNotNull(contacts.corporatePhone))));
    const [withLinkedInResult] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), isNotNull(contacts.personLinkedIn)));
    const [withDomainResult] = await db.select({ count: count() }).from(companies).where(and(eq(companies.isDeleted, false), sql`array_length(${companies.domains}, 1) > 0`));

    // Activity metrics (today)
    const [importsTodayResult] = await db.select({ count: count() }).from(importJobs).where(sql`${importJobs.createdAt} >= ${today}`);
    const [enrichmentsTodayResult] = await db.select({ count: count() }).from(enrichmentJobs).where(sql`${enrichmentJobs.createdAt} >= ${today}`);
    const [apiRequestsTodayResult] = await db.select({ count: count() }).from(apiRequestLogs).where(sql`${apiRequestLogs.createdAt} >= ${today}`);

    // Open issues
    const [openIssuesResult] = await db.select({ count: count() }).from(dataQualityIssues).where(eq(dataQualityIssues.status, 'open'));
    const [criticalIssuesResult] = await db.select({ count: count() }).from(dataQualityIssues).where(and(eq(dataQualityIssues.status, 'open'), eq(dataQualityIssues.severity, 'critical')));

    // Calculate quality scores
    const activeCount = activeContactsResult.count;
    const withEmail = withEmailResult.count;
    const withPhone = withPhoneResult.count;
    const withLinkedIn = withLinkedInResult.count;
    
    const contactQualityScore = activeCount > 0 
      ? ((Number(withEmail) * 0.4 + Number(withPhone) * 0.3 + Number(withLinkedIn) * 0.3) / Number(activeCount)) * 100
      : 0;

    const activeCompanyCount = activeCompaniesResult.count;
    const companiesWithDomain = withDomainResult.count;
    const companyQualityScore = activeCompanyCount > 0
      ? (Number(companiesWithDomain) / Number(activeCompanyCount)) * 100
      : 0;

    const [metrics] = await db
      .insert(databaseMetrics)
      .values({
        snapshotDate: now,
        totalContacts: totalContactsResult.count,
        activeContacts: activeContactsResult.count,
        deletedContacts: deletedContactsResult.count,
        totalCompanies: totalCompaniesResult.count,
        activeCompanies: activeCompaniesResult.count,
        matchedContacts: matchedResult.count,
        unmatchedContacts: unmatchedResult.count,
        pendingReviewContacts: pendingResult.count,
        contactsWithEmail: withEmailResult.count,
        contactsWithPhone: withPhoneResult.count,
        contactsWithLinkedIn: withLinkedInResult.count,
        companiesWithDomain: withDomainResult.count,
        importsToday: importsTodayResult.count,
        enrichmentsToday: enrichmentsTodayResult.count,
        apiRequestsToday: apiRequestsTodayResult.count,
        avgContactQualityScore: contactQualityScore.toFixed(2),
        avgCompanyQualityScore: companyQualityScore.toFixed(2),
        openDataQualityIssues: openIssuesResult.count,
        criticalIssues: criticalIssuesResult.count
      })
      .returning();

    return metrics;
  }

  async getLatestMetrics(): Promise<DatabaseMetrics | undefined> {
    const [metrics] = await db
      .select()
      .from(databaseMetrics)
      .orderBy(desc(databaseMetrics.snapshotDate))
      .limit(1);
    return metrics || undefined;
  }

  async getMetricsHistory(days: number = 30): Promise<DatabaseMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await db
      .select()
      .from(databaseMetrics)
      .where(sql`${databaseMetrics.snapshotDate} >= ${startDate}`)
      .orderBy(desc(databaseMetrics.snapshotDate));
  }

  // Archive operations
  async archiveRecord(entityType: string, originalId: string, data: any, userId?: string): Promise<ArchivedRecord> {
    const now = new Date();
    const retentionDays = 90;
    const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const [archived] = await db
      .insert(archivedRecords)
      .values({
        entityType,
        originalId,
        data,
        deletedBy: userId,
        deletedAt: now,
        retentionDays,
        expiresAt
      })
      .returning();

    return archived;
  }

  async getArchivedRecords(entityType?: string, page: number = 1, limit: number = 20): Promise<{ records: ArchivedRecord[], total: number }> {
    const offset = (page - 1) * limit;
    const conditions = entityType ? eq(archivedRecords.entityType, entityType) : undefined;

    const [{ count: total }] = await db
      .select({ count: count() })
      .from(archivedRecords)
      .where(conditions);

    const records = await db
      .select()
      .from(archivedRecords)
      .where(conditions)
      .orderBy(desc(archivedRecords.deletedAt))
      .limit(limit)
      .offset(offset);

    return { records, total };
  }

  async restoreArchivedRecord(id: string): Promise<any> {
    const [archived] = await db
      .select()
      .from(archivedRecords)
      .where(eq(archivedRecords.id, id));

    if (!archived) return null;

    // Restore based on entity type
    if (archived.entityType === 'contact') {
      const [restored] = await db
        .insert(contacts)
        .values({ ...(archived.data as any), isDeleted: false })
        .returning();

      await db.delete(archivedRecords).where(eq(archivedRecords.id, id));
      return restored;
    }

    if (archived.entityType === 'company') {
      const [restored] = await db
        .insert(companies)
        .values({ ...(archived.data as any), isDeleted: false })
        .returning();

      await db.delete(archivedRecords).where(eq(archivedRecords.id, id));
      return restored;
    }

    return null;
  }

  async cleanupExpiredArchives(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(archivedRecords)
      .where(sql`${archivedRecords.expiresAt} <= ${now}`)
      .returning();

    return result.length;
  }

  // Data health dashboard
  async getDatabaseHealthSummary(): Promise<{
    totalRecords: { contacts: number; companies: number; };
    dataQuality: { score: number; issuesByType: Record<string, number>; };
    matchingStatus: { matched: number; unmatched: number; pendingReview: number; };
    growthMetrics: { contactsThisWeek: number; companiesThisWeek: number; };
    recentActivity: { imports: number; enrichments: number; apiRequests: number; };
  }> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total records
    const [contactsCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.isDeleted, false));
    const [companiesCount] = await db.select({ count: count() }).from(companies).where(eq(companies.isDeleted, false));

    // Matching status
    const [matched] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), eq(contacts.companyMatchStatus, 'matched')));
    const [unmatched] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), or(eq(contacts.companyMatchStatus, 'unmatched'), isNull(contacts.companyMatchStatus))));
    const [pendingReview] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), eq(contacts.companyMatchStatus, 'pending_review')));

    // Data quality metrics
    const [withEmail] = await db.select({ count: count() }).from(contacts).where(and(eq(contacts.isDeleted, false), isNotNull(contacts.email), ne(contacts.email, '')));
    const totalContacts = Number(contactsCount.count);
    const emailRate = totalContacts > 0 ? (Number(withEmail.count) / totalContacts) * 100 : 0;

    // Issues by type
    const issuesByTypeResult = await db
      .select({ 
        issueType: dataQualityIssues.issueType, 
        count: count() 
      })
      .from(dataQualityIssues)
      .where(eq(dataQualityIssues.status, 'open'))
      .groupBy(dataQualityIssues.issueType);

    const issuesByType: Record<string, number> = {};
    for (const row of issuesByTypeResult) {
      issuesByType[row.issueType] = Number(row.count);
    }

    // Growth metrics
    const [contactsThisWeek] = await db.select({ count: count() }).from(contacts).where(sql`${contacts.createdAt} >= ${oneWeekAgo}`);
    const [companiesThisWeek] = await db.select({ count: count() }).from(companies).where(sql`${companies.createdAt} >= ${oneWeekAgo}`);

    // Recent activity (last 7 days)
    const [imports] = await db.select({ count: count() }).from(importJobs).where(sql`${importJobs.createdAt} >= ${oneWeekAgo}`);
    const [enrichments] = await db.select({ count: count() }).from(enrichmentJobs).where(sql`${enrichmentJobs.createdAt} >= ${oneWeekAgo}`);
    const [apiRequests] = await db.select({ count: count() }).from(apiRequestLogs).where(sql`${apiRequestLogs.createdAt} >= ${oneWeekAgo}`);

    return {
      totalRecords: {
        contacts: Number(contactsCount.count),
        companies: Number(companiesCount.count)
      },
      dataQuality: {
        score: Math.round(emailRate),
        issuesByType
      },
      matchingStatus: {
        matched: Number(matched.count),
        unmatched: Number(unmatched.count),
        pendingReview: Number(pendingReview.count)
      },
      growthMetrics: {
        contactsThisWeek: Number(contactsThisWeek.count),
        companiesThisWeek: Number(companiesThisWeek.count)
      },
      recentActivity: {
        imports: Number(imports.count),
        enrichments: Number(enrichments.count),
        apiRequests: Number(apiRequests.count)
      }
    };
  }

  // ============ BULK OPERATION JOB METHODS ============

  async createBulkOperationJob(job: InsertBulkOperationJob): Promise<BulkOperationJob> {
    const [created] = await db.insert(bulkOperationJobs).values(job).returning();
    return created;
  }

  async getBulkOperationJob(id: string): Promise<BulkOperationJob | undefined> {
    const [job] = await db.select().from(bulkOperationJobs).where(eq(bulkOperationJobs.id, id));
    return job || undefined;
  }

  async updateBulkOperationJob(id: string, updates: Partial<BulkOperationJob>): Promise<BulkOperationJob | undefined> {
    const [updated] = await db
      .update(bulkOperationJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bulkOperationJobs.id, id))
      .returning();
    return updated || undefined;
  }

  async getRecentBulkOperationJobs(limit: number = 20): Promise<BulkOperationJob[]> {
    return await db
      .select()
      .from(bulkOperationJobs)
      .orderBy(desc(bulkOperationJobs.createdAt))
      .limit(limit);
  }

  async appendBulkJobActivity(jobId: string, activity: { type: string; message: string; details?: any }): Promise<void> {
    const job = await this.getBulkOperationJob(jobId);
    if (job) {
      const currentActivity = (job.activityLog as any[]) || [];
      currentActivity.push({
        timestamp: new Date().toISOString(),
        ...activity,
      });
      await this.updateBulkOperationJob(jobId, { activityLog: currentActivity });
    }
  }

  async appendBulkJobError(jobId: string, error: { itemId: string; itemName: string; error: string }): Promise<void> {
    const job = await this.getBulkOperationJob(jobId);
    if (job) {
      const currentErrors = (job.errors as any[]) || [];
      currentErrors.push(error);
      await this.updateBulkOperationJob(jobId, { errors: currentErrors });
    }
  }

  // ============ REAL-TIME BULK OPERATIONS ============

  async bulkMatchProspectsWithProgress(
    jobId: string, 
    onProgress: (progress: Partial<BulkProgressEvent>) => void
  ): Promise<{ matched: number; unmatched: number; skipped: number }> {
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    let processed = 0;
    const BATCH_SIZE = 50;
    
    const unmatchedContacts = await this.getUnmatchedProspects();
    const total = unmatchedContacts.length;
    
    await this.updateBulkOperationJob(jobId, { 
      totalItems: total, 
      status: 'running',
      startedAt: new Date(),
    });

    onProgress({
      operationType: 'bulk-match',
      status: 'running',
      totals: { total, processed: 0, success: 0, failed: 0, skipped: 0, matched: 0 },
      message: `Starting to match ${total} unmatched contacts...`,
    });

    for (let i = 0; i < unmatchedContacts.length; i += BATCH_SIZE) {
      const batch = unmatchedContacts.slice(i, i + BATCH_SIZE);
      
      for (const contact of batch) {
        processed++;
        
        try {
          if (!contact.company && !contact.website && !contact.companyLinkedIn && !contact.email) {
            skipped++;
            onProgress({
              operationType: 'bulk-match',
              status: 'running',
              totals: { total, processed, success: matched, failed: 0, skipped, matched },
              current: {
                id: contact.id,
                name: contact.fullName || contact.email || 'Unknown',
                step: 'Skipped - no company identifiers',
              },
            });
            continue;
          }

          const result = await this.matchProspectToCompany(contact.id);
          
          if (result.matched) {
            matched++;
            onProgress({
              operationType: 'bulk-match',
              status: 'running',
              totals: { total, processed, success: matched, failed: 0, skipped, matched },
              current: {
                id: contact.id,
                name: contact.fullName || contact.email || 'Unknown',
                companyMatched: result.companyName,
                step: 'Matched',
              },
              message: `Matched ${contact.fullName || contact.email} to ${result.companyName}`,
            });
          } else {
            unmatched++;
            onProgress({
              operationType: 'bulk-match',
              status: 'running',
              totals: { total, processed, success: matched, failed: unmatched, skipped, matched },
              current: {
                id: contact.id,
                name: contact.fullName || contact.email || 'Unknown',
                step: 'No match found',
              },
            });
          }
        } catch (error) {
          unmatched++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.appendBulkJobError(jobId, {
            itemId: contact.id,
            itemName: contact.fullName || contact.email || 'Unknown',
            error: errorMsg,
          });
        }
      }
      
      await this.updateBulkOperationJob(jobId, {
        processedItems: processed,
        successCount: matched,
        failedCount: unmatched,
        skippedCount: skipped,
        matchedCount: matched,
      });
    }
    
    return { matched, unmatched, skipped };
  }

  async bulkAutoFillWithProgress(
    jobId: string,
    onProgress: (progress: Partial<BulkProgressEvent>) => void
  ): Promise<{ processed: number; updated: number; skipped: number; companiesProcessed: string[] }> {
    const BATCH_SIZE = 100;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    const companiesProcessed: string[] = [];
    
    const contactsToProcess = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.isDeleted, false),
        or(
          and(isNotNull(contacts.company), ne(contacts.company, '')),
          and(isNotNull(contacts.website), ne(contacts.website, '')),
          and(isNotNull(contacts.companyLinkedIn), ne(contacts.companyLinkedIn, '')),
          and(isNotNull(contacts.email), ne(contacts.email, ''))
        )
      ));

    const total = contactsToProcess.length;
    const companyTemplateCache = new Map<string, Partial<Contact> | null>();

    await this.updateBulkOperationJob(jobId, { 
      totalItems: total, 
      status: 'running',
      startedAt: new Date(),
    });

    onProgress({
      operationType: 'bulk-autofill',
      status: 'running',
      totals: { total, processed: 0, success: 0, failed: 0, skipped: 0, matched: 0 },
      message: `Starting auto-fill for ${total} contacts...`,
    });

    for (let i = 0; i < contactsToProcess.length; i += BATCH_SIZE) {
      const batch = contactsToProcess.slice(i, i + BATCH_SIZE);
      
      for (const contact of batch) {
        processed++;
        
        const emailDomain = CompanyMatcher.extractEmailDomain(contact.email);
        
        if (!contact.company?.trim() && !contact.website?.trim() && !contact.companyLinkedIn?.trim() && !emailDomain) {
          skipped++;
          onProgress({
            operationType: 'bulk-autofill',
            status: 'running',
            totals: { total, processed, success: updated, failed: 0, skipped, matched: companiesProcessed.length },
            current: {
              id: contact.id,
              name: contact.fullName || contact.email || 'Unknown',
              step: 'Skipped - no company identifiers',
            },
          });
          continue;
        }
        
        const normalizedCompany = CompanyMatcher.normalizeCompanyName(contact.company);
        const normalizedWebsite = CompanyMatcher.normalizeWebsite(contact.website);
        const cacheKey = `${normalizedCompany}|${normalizedWebsite}|${contact.companyLinkedIn || ''}|${emailDomain || ''}`;
        
        let companyTemplate = companyTemplateCache.get(cacheKey);
        if (companyTemplate === undefined) {
          companyTemplate = await this.getCompanyTemplate(
            contact.company || undefined, 
            contact.website || undefined, 
            contact.companyLinkedIn || undefined,
            contact.email || undefined
          );
          companyTemplateCache.set(cacheKey, companyTemplate);
        }

        if (!companyTemplate) {
          skipped++;
          onProgress({
            operationType: 'bulk-autofill',
            status: 'running',
            totals: { total, processed, success: updated, failed: 0, skipped, matched: companiesProcessed.length },
            current: {
              id: contact.id,
              name: contact.fullName || contact.email || 'Unknown',
              step: 'No company template found',
            },
          });
          continue;
        }

        const fieldsToFill = Object.keys(companyTemplate) as Array<keyof Partial<Contact>>;
        const autoFilledFields: string[] = [];
        const updateData: any = {};

        fieldsToFill.forEach(field => {
          const currentValue = (contact as any)[field];
          const templateValue = companyTemplate![field];
          
          if ((!currentValue || currentValue === '') && templateValue !== null && templateValue !== undefined) {
            updateData[field] = templateValue;
            autoFilledFields.push(field as string);
          }
        });

        if (autoFilledFields.length > 0) {
          await db
            .update(contacts)
            .set({
              ...updateData,
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, contact.id));

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

          onProgress({
            operationType: 'bulk-autofill',
            status: 'running',
            totals: { total, processed, success: updated, failed: 0, skipped, matched: companiesProcessed.length },
            current: {
              id: contact.id,
              name: contact.fullName || contact.email || 'Unknown',
              fieldsFilled: autoFilledFields,
              step: `Filled ${autoFilledFields.length} fields`,
            },
            message: `Auto-filled ${autoFilledFields.length} fields for ${contact.fullName || contact.email}`,
          });
        } else {
          skipped++;
          onProgress({
            operationType: 'bulk-autofill',
            status: 'running',
            totals: { total, processed, success: updated, failed: 0, skipped, matched: companiesProcessed.length },
            current: {
              id: contact.id,
              name: contact.fullName || contact.email || 'Unknown',
              step: 'All fields already filled',
            },
          });
        }
      }
      
      await this.updateBulkOperationJob(jobId, {
        processedItems: processed,
        successCount: updated,
        skippedCount: skipped,
        matchedCount: companiesProcessed.length,
      });
    }
    
    return { processed, updated, skipped, companiesProcessed };
  }

  async bulkDeleteContactsWithProgress(
    jobId: string,
    contactIds: string[],
    onProgress: (progress: Partial<BulkProgressEvent>) => void
  ): Promise<{ deleted: number; failed: number }> {
    const BATCH_SIZE = 50;
    let deleted = 0;
    let failed = 0;
    let processed = 0;
    const total = contactIds.length;

    await this.updateBulkOperationJob(jobId, { 
      totalItems: total, 
      status: 'running',
      startedAt: new Date(),
    });

    onProgress({
      operationType: 'bulk-delete',
      status: 'running',
      totals: { total, processed: 0, success: 0, failed: 0, skipped: 0, matched: 0 },
      message: `Starting to delete ${total} contacts...`,
    });

    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);
      
      for (const contactId of batch) {
        processed++;
        
        try {
          const contact = await this.getContact(contactId);
          const success = await this.deleteContact(contactId);
          
          if (success) {
            deleted++;
            onProgress({
              operationType: 'bulk-delete',
              status: 'running',
              totals: { total, processed, success: deleted, failed, skipped: 0, matched: 0 },
              current: {
                id: contactId,
                name: contact?.fullName || contact?.email || contactId,
                step: 'Deleted',
              },
              message: `Deleted ${contact?.fullName || contact?.email || contactId}`,
            });
          } else {
            failed++;
            await this.appendBulkJobError(jobId, {
              itemId: contactId,
              itemName: contact?.fullName || contact?.email || contactId,
              error: 'Failed to delete',
            });
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.appendBulkJobError(jobId, {
            itemId: contactId,
            itemName: contactId,
            error: errorMsg,
          });
        }
      }
      
      await this.updateBulkOperationJob(jobId, {
        processedItems: processed,
        successCount: deleted,
        failedCount: failed,
      });
    }
    
    return { deleted, failed };
  }

  async bulkImportCompaniesWithProgress(
    jobId: string,
    companyList: InsertCompany[],
    onProgress: (progress: Partial<BulkProgressEvent>) => void
  ): Promise<{ imported: number; duplicates: number; failed: number }> {
    const BATCH_SIZE = 50;
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    let processed = 0;
    const total = companyList.length;

    await this.updateBulkOperationJob(jobId, { 
      totalItems: total, 
      status: 'running',
      startedAt: new Date(),
    });

    onProgress({
      operationType: 'bulk-import-companies',
      status: 'running',
      totals: { total, processed: 0, success: 0, failed: 0, skipped: 0, matched: 0 },
      message: `Starting to import ${total} companies...`,
    });

    for (let i = 0; i < companyList.length; i += BATCH_SIZE) {
      const batch = companyList.slice(i, i + BATCH_SIZE);
      
      for (const company of batch) {
        processed++;
        
        try {
          let existing: Company | undefined;
          
          if (company.domains && company.domains.length > 0) {
            for (const domain of company.domains) {
              existing = await this.getCompanyByDomain(domain);
              if (existing) break;
            }
          }
          
          if (!existing && company.name) {
            existing = await this.getCompanyByName(company.name);
          }
          
          if (existing) {
            duplicates++;
            onProgress({
              operationType: 'bulk-import-companies',
              status: 'running',
              totals: { total, processed, success: imported, failed, skipped: duplicates, matched: 0 },
              current: {
                id: existing.id,
                name: company.name || 'Unknown',
                step: 'Duplicate found',
              },
              message: `Skipped duplicate: ${company.name}`,
            });
          } else {
            const created = await this.createCompany(company);
            imported++;
            onProgress({
              operationType: 'bulk-import-companies',
              status: 'running',
              totals: { total, processed, success: imported, failed, skipped: duplicates, matched: 0 },
              current: {
                id: created.id,
                name: company.name || 'Unknown',
                step: 'Imported',
              },
              message: `Imported: ${company.name}`,
            });
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await this.appendBulkJobError(jobId, {
            itemId: `company-${processed}`,
            itemName: company.name || 'Unknown',
            error: errorMsg,
          });
          onProgress({
            operationType: 'bulk-import-companies',
            status: 'running',
            totals: { total, processed, success: imported, failed, skipped: duplicates, matched: 0 },
            current: {
              id: `company-${processed}`,
              name: company.name || 'Unknown',
              step: 'Failed',
            },
          });
        }
      }
      
      await this.updateBulkOperationJob(jobId, {
        processedItems: processed,
        successCount: imported,
        failedCount: failed,
        skippedCount: duplicates,
      });
    }
    
    return { imported, duplicates, failed };
  }

  // ============ SUBSCRIPTION PLAN OPERATIONS ============

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.sortOrder));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id));
    return plan || undefined;
  }

  async getSubscriptionPlanByName(name: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.name, name));
    return plan || undefined;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [created] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    return created;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db
      .update(subscriptionPlans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
