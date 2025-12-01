import { Contact } from "@shared/schema";

const COMPANY_SUFFIXES = [
  'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
  'co', 'company', 'gmbh', 'ag', 'sa', 'plc', 'pvt', 'private',
  'holdings', 'group', 'intl', 'international', 'worldwide', 'global',
  'solutions', 'services', 'technologies', 'tech', 'systems', 'software'
];

const COMMON_EMAIL_PROVIDERS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com',
  'yandex.com', 'gmx.com', 'fastmail.com', 'tutanota.com', 'proton.me'
];

const COMPANY_FIELD_WEIGHTS: Record<string, number> = {
  company: 5,
  website: 8,
  companyLinkedIn: 7,
  industry: 6,
  employees: 4,
  employeeSizeBracket: 3,
  annualRevenue: 5,
  technologies: 4,
  companyAddress: 2,
  companyCity: 2,
  companyState: 2,
  companyCountry: 3,
  companyAge: 2,
  technologyCategory: 3,
  businessType: 4
};

export class CompanyMatcher {
  static extractEmailDomain(email: string | null | undefined): string | null {
    if (!email?.trim()) return null;
    const match = email.toLowerCase().trim().match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
    if (!match) return null;
    
    const domain = match[1];
    if (COMMON_EMAIL_PROVIDERS.includes(domain)) return null;
    
    return domain;
  }

  static extractCompanyFromDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return domain;
  }

  static normalizeCompanyName(name: string | null | undefined): string {
    if (!name?.trim()) return '';
    
    let normalized = name.toLowerCase().trim();
    normalized = normalized.replace(/[^\w\s]/g, ' ');
    
    const words = normalized.split(/\s+/).filter(word => 
      word.length > 0 && !COMPANY_SUFFIXES.includes(word)
    );
    
    return words.join(' ').trim();
  }

  static normalizeWebsite(url: string | null | undefined): string {
    if (!url?.trim()) return '';
    
    let normalized = url.toLowerCase().trim();
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    normalized = normalized.split('/')[0];
    normalized = normalized.split('?')[0];
    
    return normalized;
  }

  static extractDomainFromWebsite(website: string | null | undefined): string | null {
    const normalized = this.normalizeWebsite(website);
    if (!normalized) return null;
    return normalized;
  }

  static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;
    
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    
    return dp[m][n];
  }

  static calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    if (s1.includes(s2) || s2.includes(s1)) {
      const shorter = s1.length < s2.length ? s1 : s2;
      const longer = s1.length < s2.length ? s2 : s1;
      return shorter.length / longer.length * 0.95;
    }
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    
    return Math.max(0, 1 - distance / maxLen);
  }

  static fuzzyMatch(query: string, target: string, threshold: number = 0.7): boolean {
    const similarity = this.calculateSimilarity(query, target);
    return similarity >= threshold;
  }

  static calculateDataQualityScore(contact: Contact): number {
    let score = 0;
    let maxScore = 0;
    
    for (const [field, weight] of Object.entries(COMPANY_FIELD_WEIGHTS)) {
      maxScore += weight;
      const value = contact[field as keyof Contact];
      
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            score += weight * Math.min(1, value.length / 3);
          }
        } else if (typeof value === 'number') {
          score += weight;
        } else if (typeof value === 'string') {
          const strValue = value.trim();
          if (strValue.length > 0) {
            const lengthBonus = Math.min(1, strValue.length / 20);
            score += weight * (0.7 + 0.3 * lengthBonus);
          }
        }
      }
    }
    
    return maxScore > 0 ? score / maxScore : 0;
  }

  static calculateMatchScore(
    contact: Contact,
    companyName?: string,
    website?: string,
    companyLinkedIn?: string,
    emailDomain?: string
  ): { score: number; matchType: string; confidence: number } {
    let matchScore = 0;
    let matchType = 'none';
    let confidence = 0;
    
    const normalizedQuery = this.normalizeCompanyName(companyName);
    const normalizedContact = this.normalizeCompanyName(contact.company);
    
    if (normalizedQuery && normalizedContact) {
      if (normalizedQuery === normalizedContact) {
        matchScore += 100;
        matchType = 'exact_company';
        confidence = 1.0;
      } else {
        const similarity = this.calculateSimilarity(normalizedQuery, normalizedContact);
        if (similarity >= 0.85) {
          matchScore += 80 * similarity;
          matchType = 'fuzzy_company';
          confidence = similarity;
        } else if (similarity >= 0.7) {
          matchScore += 50 * similarity;
          matchType = 'partial_company';
          confidence = similarity * 0.8;
        }
      }
    }
    
    if (website && contact.website) {
      const queryDomain = this.normalizeWebsite(website);
      const contactDomain = this.normalizeWebsite(contact.website);
      
      if (queryDomain && contactDomain) {
        if (queryDomain === contactDomain) {
          matchScore += 120;
          matchType = matchType === 'none' ? 'exact_website' : matchType + '+website';
          confidence = Math.max(confidence, 1.0);
        } else {
          const domainSimilarity = this.calculateSimilarity(queryDomain, contactDomain);
          if (domainSimilarity >= 0.8) {
            matchScore += 60 * domainSimilarity;
            confidence = Math.max(confidence, domainSimilarity);
          }
        }
      }
    }
    
    if (companyLinkedIn && contact.companyLinkedIn) {
      const queryLinkedIn = companyLinkedIn.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      const contactLinkedIn = contact.companyLinkedIn.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      
      if (queryLinkedIn === contactLinkedIn) {
        matchScore += 110;
        matchType = matchType === 'none' ? 'exact_linkedin' : matchType + '+linkedin';
        confidence = Math.max(confidence, 1.0);
      }
    }
    
    if (emailDomain && contact.email) {
      const contactEmailDomain = this.extractEmailDomain(contact.email);
      if (contactEmailDomain && emailDomain === contactEmailDomain) {
        matchScore += 90;
        matchType = matchType === 'none' ? 'email_domain' : matchType + '+email';
        confidence = Math.max(confidence, 0.95);
      }
    }
    
    const qualityScore = this.calculateDataQualityScore(contact);
    matchScore *= (0.5 + 0.5 * qualityScore);
    
    return { score: matchScore, matchType, confidence };
  }

  static mergeCompanyData(contacts: Contact[]): Partial<Contact> {
    if (contacts.length === 0) return {};
    if (contacts.length === 1) {
      return this.extractCompanyFields(contacts[0]);
    }
    
    const mergedTemplate: Partial<Contact> = {};
    const companyFields = Object.keys(COMPANY_FIELD_WEIGHTS) as Array<keyof Contact>;
    
    for (const field of companyFields) {
      const fieldWeight = COMPANY_FIELD_WEIGHTS[field] || 1;
      let bestValue: any = null;
      let bestScore = 0;
      
      for (const contact of contacts) {
        const value = contact[field];
        if (value === null || value === undefined || value === '') continue;
        
        let valueScore = fieldWeight;
        
        if (Array.isArray(value)) {
          valueScore *= (1 + Math.min(value.length / 5, 1));
        } else if (typeof value === 'string') {
          valueScore *= (0.8 + Math.min(value.length / 50, 0.2));
        }
        
        const contactQuality = this.calculateDataQualityScore(contact);
        valueScore *= (0.7 + 0.3 * contactQuality);
        
        if (valueScore > bestScore) {
          bestScore = valueScore;
          bestValue = value;
        }
      }
      
      if (bestValue !== null && bestValue !== undefined && bestValue !== '') {
        (mergedTemplate as any)[field] = bestValue;
      }
    }
    
    return mergedTemplate;
  }

  static extractCompanyFields(contact: Contact): Partial<Contact> {
    const template: Partial<Contact> = {};
    const companyFields = Object.keys(COMPANY_FIELD_WEIGHTS) as Array<keyof Contact>;
    
    for (const field of companyFields) {
      const value = contact[field];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value) && value.length === 0) continue;
        (template as any)[field] = value;
      }
    }
    
    return template;
  }

  static groupContactsByCompany(contacts: Contact[]): Map<string, Contact[]> {
    const groups = new Map<string, Contact[]>();
    const processed = new Set<string>();
    
    for (const contact of contacts) {
      if (processed.has(contact.id)) continue;
      
      let groupKey = '';
      
      if (contact.website) {
        groupKey = this.normalizeWebsite(contact.website);
      } else if (contact.email) {
        const domain = this.extractEmailDomain(contact.email);
        if (domain) groupKey = domain;
      }
      
      if (!groupKey && contact.company) {
        groupKey = this.normalizeCompanyName(contact.company);
      }
      
      if (!groupKey) {
        groupKey = `unknown_${contact.id}`;
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(contact);
      processed.add(contact.id);
    }
    
    return groups;
  }

  static findBestMatches(
    contacts: Contact[],
    companyName?: string,
    website?: string,
    companyLinkedIn?: string,
    email?: string,
    limit: number = 10
  ): Array<{ contact: Contact; score: number; matchType: string; confidence: number }> {
    const emailDomain = this.extractEmailDomain(email);
    
    const scored = contacts.map(contact => {
      const { score, matchType, confidence } = this.calculateMatchScore(
        contact,
        companyName,
        website,
        companyLinkedIn,
        emailDomain || undefined
      );
      return { contact, score, matchType, confidence };
    });
    
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const companyMatcher = new CompanyMatcher();
