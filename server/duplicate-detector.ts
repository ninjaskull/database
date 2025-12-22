import { Contact } from "@shared/schema";

export interface DuplicateMatch {
  contact: Contact;
  matchType: 'email_exact' | 'phone_exact' | 'email_domain' | 'fuzzy_name' | 'combined';
  confidenceScore: number; // 0 to 1
  matchingFields: string[];
  details: string;
}

export class DuplicateDetector {
  /**
   * Normalize email for comparison
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Normalize phone for comparison (remove spaces, dashes, parentheses)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private stringSimilarity(str1: string, str2: string): number {
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();
    
    if (a === b) return 1;
    if (a.length < 1 || b.length < 1) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }

  /**
   * Check for exact email match
   */
  checkEmailMatch(existingContact: Contact, newContact: Contact): DuplicateMatch | null {
    if (!existingContact.email || !newContact.email) return null;

    const normalized1 = this.normalizeEmail(existingContact.email);
    const normalized2 = this.normalizeEmail(newContact.email);

    if (normalized1 === normalized2) {
      return {
        contact: existingContact,
        matchType: 'email_exact',
        confidenceScore: 1.0,
        matchingFields: ['email'],
        details: `Exact email match: ${existingContact.email}`,
      };
    }

    return null;
  }

  /**
   * Check for phone number match
   */
  checkPhoneMatch(existingContact: Contact, newContact: Contact): DuplicateMatch | null {
    const existingPhones = [
      existingContact.mobilePhone,
      existingContact.otherPhone,
      existingContact.homePhone,
      existingContact.corporatePhone,
    ].filter((p): p is string => p !== null && p !== undefined);

    const newPhones = [
      newContact.mobilePhone,
      newContact.otherPhone,
      newContact.homePhone,
      newContact.corporatePhone,
    ].filter((p): p is string => p !== null && p !== undefined);

    if (existingPhones.length === 0 || newPhones.length === 0) return null;

    for (const existingPhone of existingPhones) {
      for (const newPhone of newPhones) {
        const norm1 = this.normalizePhone(existingPhone);
        const norm2 = this.normalizePhone(newPhone);

        if (norm1 === norm2 && norm1.length >= 10) {
          return {
            contact: existingContact,
            matchType: 'phone_exact',
            confidenceScore: 0.95,
            matchingFields: ['phone'],
            details: `Exact phone match: ${existingPhone}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check email domain match (same company indicator)
   */
  checkEmailDomainMatch(existingContact: Contact, newContact: Contact): DuplicateMatch | null {
    if (!existingContact.email || !newContact.email) return null;

    const domain1 = existingContact.email.split('@')[1]?.toLowerCase();
    const domain2 = newContact.email.split('@')[1]?.toLowerCase();

    if (!domain1 || !domain2 || domain1 !== domain2) return null;

    // Check if same company
    if (existingContact.company && newContact.company) {
      if (existingContact.company.toLowerCase() === newContact.company.toLowerCase()) {
        return {
          contact: existingContact,
          matchType: 'email_domain',
          confidenceScore: 0.75,
          matchingFields: ['email_domain', 'company'],
          details: `Same email domain (${domain1}) and company (${existingContact.company})`,
        };
      }
    }

    return null;
  }

  /**
   * Fuzzy name matching with scoring
   */
  checkFuzzyNameMatch(existingContact: Contact, newContact: Contact): DuplicateMatch | null {
    if (!existingContact.fullName || !newContact.fullName) return null;

    const similarity = this.stringSimilarity(
      existingContact.fullName,
      newContact.fullName
    );

    // Require at least 80% similarity for fuzzy name match
    if (similarity < 0.8) return null;

    // Boost confidence if company also matches
    let confidenceScore = similarity;
    const matchingFields = ['fullName'];

    if (
      existingContact.company &&
      newContact.company &&
      existingContact.company.toLowerCase() === newContact.company.toLowerCase()
    ) {
      confidenceScore = Math.min(1, similarity + 0.15);
      matchingFields.push('company');
    }

    return {
      contact: existingContact,
      matchType: 'fuzzy_name',
      confidenceScore,
      matchingFields,
      details: `Fuzzy name match (${(similarity * 100).toFixed(0)}% similar)`,
    };
  }

  /**
   * Find duplicates for a new contact from existing contacts
   */
  findDuplicates(
    newContact: Contact,
    existingContacts: Contact[],
    minConfidence: number = 0.75
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const existing of existingContacts) {
      // Skip self-comparison
      if (existing.id === newContact.id) continue;

      // Check all matching strategies in priority order
      let match: DuplicateMatch | null = null;

      // 1. Exact email match (highest priority)
      match = this.checkEmailMatch(existing, newContact);
      if (match && match.confidenceScore >= minConfidence) {
        matches.push(match);
        continue;
      }

      // 2. Exact phone match
      match = this.checkPhoneMatch(existing, newContact);
      if (match && match.confidenceScore >= minConfidence) {
        matches.push(match);
        continue;
      }

      // 3. Email domain match
      match = this.checkEmailDomainMatch(existing, newContact);
      if (match && match.confidenceScore >= minConfidence) {
        matches.push(match);
        continue;
      }

      // 4. Fuzzy name matching
      match = this.checkFuzzyNameMatch(existing, newContact);
      if (match && match.confidenceScore >= minConfidence) {
        matches.push(match);
      }
    }

    // Sort by confidence score (highest first)
    return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  /**
   * Detect duplicates among a list of contacts
   */
  detectDuplicatesInList(contacts: Contact[]): Map<string, DuplicateMatch[]> {
    const duplicates = new Map<string, DuplicateMatch[]>();

    for (let i = 0; i < contacts.length; i++) {
      const remaining = contacts.slice(i + 1);
      const matches = this.findDuplicates(contacts[i], remaining);

      if (matches.length > 0) {
        duplicates.set(contacts[i].id, matches);
      }
    }

    return duplicates;
  }
}

export const duplicateDetector = new DuplicateDetector();
