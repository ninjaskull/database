import { 
  contacts, 
  contactActivities, 
  importJobs,
  users,
  sessions,
  type Contact, 
  type InsertContact,
  type ContactActivity,
  type InsertContactActivity,
  type ImportJob,
  type InsertImportJob,
  type User,
  type InsertUser,
  type Session,
  type InsertSession
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, desc, asc, count, sql } from "drizzle-orm";

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
    const [contact] = await db
      .insert(contacts)
      .values({
        ...insertContact,
        updatedAt: new Date(),
      })
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
    const [contact] = await db
      .update(contacts)
      .set({
        ...updates,
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

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
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
}

export const storage = new DatabaseStorage();
