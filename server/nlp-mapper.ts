/**
 * Custom NLP Model for Automatic CSV Field Mapping
 * Uses pattern recognition, semantic similarity, and linguistic analysis
 * No third-party AI dependencies - fully custom implementation
 */

interface FieldPattern {
  dbField: string;
  patterns: string[];
  synonyms: string[];
  keywords: string[];
  weight: number;
}

interface MappingScore {
  field: string;
  score: number;
  confidence: number;
}

class CSVFieldMapper {
  private fieldPatterns: FieldPattern[] = [
    {
      dbField: 'fullName',
      patterns: ['full.*name', 'complete.*name', 'name', 'contact.*name'],
      synonyms: ['full name', 'complete name', 'name', 'contact name', 'person name'],
      keywords: ['full', 'complete', 'name', 'contact', 'person'],
      weight: 1.0
    },
    {
      dbField: 'firstName',
      patterns: ['first.*name', 'given.*name', 'fname'],
      synonyms: ['first name', 'given name', 'fname', 'forename'],
      keywords: ['first', 'given', 'fname', 'forename'],
      weight: 0.9
    },
    {
      dbField: 'lastName',
      patterns: ['last.*name', 'family.*name', 'surname', 'lname'],
      synonyms: ['last name', 'family name', 'surname', 'lname'],
      keywords: ['last', 'family', 'surname', 'lname'],
      weight: 0.9
    },
    {
      dbField: 'email',
      patterns: ['email.*address', 'email', 'e.mail', 'mail'],
      synonyms: ['email address', 'email', 'e-mail', 'mail', 'electronic mail'],
      keywords: ['email', 'mail', 'e-mail', '@'],
      weight: 1.0
    },
    {
      dbField: 'mobilePhone',
      patterns: ['mobile.*phone', 'mobile', 'cell.*phone', 'phone', 'tel', 'telephone'],
      synonyms: ['mobile phone', 'mobile', 'cell phone', 'phone', 'telephone', 'tel'],
      keywords: ['mobile', 'cell', 'phone', 'tel', 'telephone'],
      weight: 0.8
    },
    {
      dbField: 'homePhone',
      patterns: ['home.*phone', 'home.*tel', 'landline'],
      synonyms: ['home phone', 'home telephone', 'landline', 'home tel'],
      keywords: ['home', 'landline', 'house'],
      weight: 0.7
    },
    {
      dbField: 'company',
      patterns: ['company.*name', 'company', 'organization', 'org', 'employer'],
      synonyms: ['company name', 'company', 'organization', 'org', 'employer', 'business'],
      keywords: ['company', 'organization', 'org', 'employer', 'business'],
      weight: 0.9
    },
    {
      dbField: 'title',
      patterns: ['job.*title', 'title', 'position', 'role'],
      synonyms: ['job title', 'title', 'position', 'role', 'designation'],
      keywords: ['job', 'title', 'position', 'role', 'designation'],
      weight: 0.8
    },
    {
      dbField: 'industry',
      patterns: ['industry', 'sector', 'business.*type'],
      synonyms: ['industry', 'sector', 'business type', 'field'],
      keywords: ['industry', 'sector', 'business', 'field'],
      weight: 0.7
    },
    {
      dbField: 'city',
      patterns: ['city', 'town', 'locality'],
      synonyms: ['city', 'town', 'locality', 'municipality'],
      keywords: ['city', 'town', 'locality', 'place'],
      weight: 0.6
    },
    {
      dbField: 'country',
      patterns: ['country', 'nation'],
      synonyms: ['country', 'nation', 'state'],
      keywords: ['country', 'nation', 'state'],
      weight: 0.7
    },
    {
      dbField: 'website',
      patterns: ['website', 'web.*site', 'url', 'homepage'],
      synonyms: ['website', 'web site', 'url', 'homepage', 'web address'],
      keywords: ['website', 'web', 'url', 'http', 'www'],
      weight: 0.8
    }
  ];

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate semantic similarity score
   */
  private calculateSemanticSimilarity(header: string, target: string): number {
    const normalizedHeader = this.normalizeText(header);
    const normalizedTarget = this.normalizeText(target);

    // Exact match
    if (normalizedHeader === normalizedTarget) {
      return 1.0;
    }

    // Contains match
    if (normalizedHeader.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeader)) {
      return 0.8;
    }

    // Levenshtein distance similarity
    const distance = this.levenshteinDistance(normalizedHeader, normalizedTarget);
    const maxLength = Math.max(normalizedHeader.length, normalizedTarget.length);
    const similarity = 1 - (distance / maxLength);

    return similarity > 0.6 ? similarity : 0;
  }

  /**
   * Calculate pattern match score
   */
  private calculatePatternScore(header: string, pattern: FieldPattern): number {
    const normalizedHeader = this.normalizeText(header);
    let bestScore = 0;

    // Check regex patterns
    for (const regexPattern of pattern.patterns) {
      const regex = new RegExp(regexPattern, 'i');
      if (regex.test(normalizedHeader)) {
        bestScore = Math.max(bestScore, 0.9);
      }
    }

    // Check synonyms
    for (const synonym of pattern.synonyms) {
      const similarity = this.calculateSemanticSimilarity(normalizedHeader, synonym);
      bestScore = Math.max(bestScore, similarity * 0.8);
    }

    // Check keywords
    const headerWords = normalizedHeader.split(' ');
    for (const keyword of pattern.keywords) {
      for (const word of headerWords) {
        const similarity = this.calculateSemanticSimilarity(word, keyword);
        if (similarity > 0.7) {
          bestScore = Math.max(bestScore, similarity * 0.6);
        }
      }
    }

    return bestScore * pattern.weight;
  }

  /**
   * Calculate contextual score based on surrounding headers
   */
  private calculateContextualScore(header: string, allHeaders: string[], fieldPattern: FieldPattern): number {
    let contextScore = 0;

    // Check for related fields that often appear together
    const relatedFields = {
      'firstName': ['lastName', 'fullName'],
      'lastName': ['firstName', 'fullName'],
      'city': ['country', 'state'],
      'company': ['title', 'industry'],
      'email': ['firstName', 'lastName', 'company']
    };

    const related = relatedFields[fieldPattern.dbField as keyof typeof relatedFields];
    if (related) {
      for (const relatedField of related) {
        const relatedPattern = this.fieldPatterns.find(p => p.dbField === relatedField);
        if (relatedPattern) {
          for (const otherHeader of allHeaders) {
            if (otherHeader !== header && this.calculatePatternScore(otherHeader, relatedPattern) > 0.5) {
              contextScore += 0.1;
            }
          }
        }
      }
    }

    return Math.min(contextScore, 0.3); // Cap at 0.3
  }

  /**
   * Map CSV headers to database fields automatically
   */
  public mapHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const usedFields = new Set<string>();

    // Calculate scores for each header-field combination
    const scores: Array<{ header: string; field: string; score: number; confidence: number }> = [];

    for (const header of headers) {
      for (const pattern of this.fieldPatterns) {
        const patternScore = this.calculatePatternScore(header, pattern);
        const contextScore = this.calculateContextualScore(header, headers, pattern);
        const totalScore = patternScore + contextScore;
        
        if (totalScore > 0.3) { // Minimum threshold
          const confidence = Math.min(totalScore, 1.0);
          scores.push({
            header,
            field: pattern.dbField,
            score: totalScore,
            confidence
          });
        }
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Assign mappings, ensuring no field is used twice
    for (const score of scores) {
      if (!mapping[score.header] && !usedFields.has(score.field) && score.confidence > 0.5) {
        mapping[score.header] = score.field;
        usedFields.add(score.field);
      }
    }

    return mapping;
  }

  /**
   * Get confidence scores for a mapping
   */
  public getMappingConfidence(headers: string[], mapping: Record<string, string>): Record<string, number> {
    const confidence: Record<string, number> = {};

    for (const [header, field] of Object.entries(mapping)) {
      const pattern = this.fieldPatterns.find(p => p.dbField === field);
      if (pattern) {
        const patternScore = this.calculatePatternScore(header, pattern);
        const contextScore = this.calculateContextualScore(header, headers, pattern);
        confidence[header] = Math.min(patternScore + contextScore, 1.0);
      }
    }

    return confidence;
  }

  /**
   * Suggest alternative mappings for low-confidence fields
   */
  public suggestAlternatives(header: string, currentMapping?: string): Array<{ field: string; confidence: number }> {
    const alternatives: Array<{ field: string; confidence: number }> = [];

    for (const pattern of this.fieldPatterns) {
      if (pattern.dbField !== currentMapping) {
        const score = this.calculatePatternScore(header, pattern);
        if (score > 0.2) {
          alternatives.push({
            field: pattern.dbField,
            confidence: Math.min(score, 1.0)
          });
        }
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }
}

export const csvFieldMapper = new CSVFieldMapper();