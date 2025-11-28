import { storage } from "./storage";
import type { Contact, EnrichmentJob } from "@shared/schema";

interface ProxycurlProfileResponse {
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  headline?: string;
  occupation?: string;
  summary?: string;
  city?: string;
  state?: string;
  country?: string;
  country_full_name?: string;
  experiences?: Array<{
    company?: string;
    company_linkedin_profile_url?: string;
    title?: string;
    starts_at?: { year?: number; month?: number };
    ends_at?: { year?: number; month?: number } | null;
  }>;
  education?: Array<{
    school?: string;
    degree_name?: string;
    field_of_study?: string;
  }>;
  skills?: string[];
  profile_pic_url?: string;
}

interface ProxycurlContactResponse {
  emails?: string[];
  email?: string;
  phone_numbers?: string[];
  personal_emails?: string[];
  work_email?: string;
  personal_email?: string;
  twitter_profile_url?: string;
  facebook_profile_url?: string;
}

interface ProxycurlWorkEmailResponse {
  email?: string;
  email_status?: string;
}

interface ProxycurlPersonalEmailResponse {
  emails?: string[];
  email?: string;
  personal_email?: string;
}

interface ProxycurlPhoneResponse {
  phone_numbers?: string[];
  phone_number?: string;
}

export interface EnrichmentResult {
  success: boolean;
  data?: {
    email?: string;
    workEmail?: string;
    personalEmail?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    title?: string;
    company?: string;
    companyLinkedIn?: string;
    city?: string;
    state?: string;
    country?: string;
    headline?: string;
    skills?: string[];
    profilePicUrl?: string;
  };
  error?: string;
  creditsUsed?: number;
}

export class LinkedInEnrichmentService {
  private apiKey: string | undefined;
  private baseUrl = "https://nubela.co/proxycurl/api";

  constructor() {
    this.apiKey = process.env.PROXYCURL_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Proxycurl API key not configured. Please add PROXYCURL_API_KEY to your secrets.");
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error("Invalid Proxycurl API key");
      } else if (response.status === 403) {
        throw new Error("Insufficient credits or API access denied");
      } else if (response.status === 404) {
        throw new Error("LinkedIn profile not found");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async getProfileData(linkedinUrl: string): Promise<ProxycurlProfileResponse> {
    return this.makeRequest<ProxycurlProfileResponse>("/v2/linkedin", {
      linkedin_profile_url: linkedinUrl,
      skills: "include",
    });
  }

  async getWorkEmail(linkedinUrl: string): Promise<ProxycurlWorkEmailResponse> {
    return this.makeRequest<ProxycurlWorkEmailResponse>("/contact-api/work-email", {
      linkedin_profile_url: linkedinUrl,
    });
  }

  async getPersonalEmail(linkedinUrl: string): Promise<ProxycurlPersonalEmailResponse> {
    return this.makeRequest<ProxycurlPersonalEmailResponse>("/contact-api/personal-email", {
      linkedin_profile_url: linkedinUrl,
      email_validation: "include",
    });
  }

  async getPhoneNumber(linkedinUrl: string): Promise<ProxycurlPhoneResponse> {
    return this.makeRequest<ProxycurlPhoneResponse>("/contact-api/personal-contact", {
      linkedin_profile_url: linkedinUrl,
    });
  }

  async enrichFromLinkedIn(linkedinUrl: string, contactId?: string): Promise<EnrichmentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Proxycurl API key not configured. Please add PROXYCURL_API_KEY to your secrets.",
      };
    }

    let creditsUsed = 0;
    const enrichedData: EnrichmentResult["data"] = {};

    try {
      console.log(`🔍 Starting LinkedIn enrichment for: ${linkedinUrl}`);

      const enrichmentJob = await storage.createEnrichmentJob({
        linkedinUrl,
        contactId: contactId || null,
        status: "processing",
        provider: "proxycurl",
      });

      try {
        const profileData = await this.getProfileData(linkedinUrl);
        creditsUsed += 1;

        enrichedData.firstName = profileData.first_name;
        enrichedData.lastName = profileData.last_name;
        enrichedData.fullName = profileData.full_name || 
          [profileData.first_name, profileData.last_name].filter(Boolean).join(" ");
        enrichedData.headline = profileData.headline || profileData.occupation;
        enrichedData.city = profileData.city;
        enrichedData.state = profileData.state;
        enrichedData.country = profileData.country_full_name || profileData.country;
        enrichedData.skills = profileData.skills;
        enrichedData.profilePicUrl = profileData.profile_pic_url;

        if (profileData.experiences && profileData.experiences.length > 0) {
          const currentJob = profileData.experiences.find(exp => !exp.ends_at) || profileData.experiences[0];
          if (currentJob) {
            enrichedData.title = currentJob.title;
            enrichedData.company = currentJob.company;
            enrichedData.companyLinkedIn = currentJob.company_linkedin_profile_url;
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch profile data: ${error}`);
      }

      try {
        const workEmailData = await this.getWorkEmail(linkedinUrl);
        creditsUsed += 3;
        if (workEmailData.email) {
          enrichedData.workEmail = workEmailData.email;
          enrichedData.email = workEmailData.email;
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch work email: ${error}`);
      }

      if (!enrichedData.email) {
        try {
          const personalEmailData = await this.getPersonalEmail(linkedinUrl);
          creditsUsed += 2;
          const personalEmail = personalEmailData.email || 
            personalEmailData.personal_email || 
            (personalEmailData.emails && personalEmailData.emails[0]);
          if (personalEmail) {
            enrichedData.personalEmail = personalEmail;
            enrichedData.email = enrichedData.email || personalEmail;
          }
        } catch (error) {
          console.log(`⚠️ Could not fetch personal email: ${error}`);
        }
      }

      try {
        const phoneData = await this.getPhoneNumber(linkedinUrl);
        creditsUsed += 1;
        const phone = phoneData.phone_number || 
          (phoneData.phone_numbers && phoneData.phone_numbers[0]);
        if (phone) {
          enrichedData.phone = phone;
        }
      } catch (error) {
        console.log(`⚠️ Could not fetch phone number: ${error}`);
      }

      await storage.updateEnrichmentJob(enrichmentJob.id, {
        status: "completed",
        enrichedEmail: enrichedData.email || null,
        enrichedPhone: enrichedData.phone || null,
        enrichedData: enrichedData as any,
        creditsUsed,
        completedAt: new Date(),
      });

      if (contactId) {
        const updateData: Partial<Contact> = {};
        if (enrichedData.email && !await this.contactHasField(contactId, 'email')) {
          updateData.email = enrichedData.email;
        }
        if (enrichedData.phone && !await this.contactHasField(contactId, 'mobilePhone')) {
          updateData.mobilePhone = enrichedData.phone;
        }
        if (enrichedData.title && !await this.contactHasField(contactId, 'title')) {
          updateData.title = enrichedData.title;
        }
        if (enrichedData.company && !await this.contactHasField(contactId, 'company')) {
          updateData.company = enrichedData.company;
        }
        if (enrichedData.companyLinkedIn && !await this.contactHasField(contactId, 'companyLinkedIn')) {
          updateData.companyLinkedIn = enrichedData.companyLinkedIn;
        }
        if (enrichedData.city && !await this.contactHasField(contactId, 'city')) {
          updateData.city = enrichedData.city;
        }
        if (enrichedData.state && !await this.contactHasField(contactId, 'state')) {
          updateData.state = enrichedData.state;
        }
        if (enrichedData.country && !await this.contactHasField(contactId, 'country')) {
          updateData.country = enrichedData.country;
        }

        if (Object.keys(updateData).length > 0) {
          await storage.updateContact(contactId, updateData as any);
          await storage.createContactActivity({
            contactId,
            activityType: "enriched",
            description: `Contact enriched via LinkedIn (${Object.keys(updateData).join(', ')})`,
            changes: updateData as any,
          });
        }
      }

      console.log(`✅ LinkedIn enrichment completed. Credits used: ${creditsUsed}`);
      
      return {
        success: true,
        data: enrichedData,
        creditsUsed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`❌ LinkedIn enrichment failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        creditsUsed,
      };
    }
  }

  private async contactHasField(contactId: string, field: keyof Contact): Promise<boolean> {
    const contact = await storage.getContact(contactId);
    if (!contact) return false;
    const value = contact[field];
    return value !== null && value !== undefined && value !== '';
  }

  async searchByLinkedIn(linkedinUrl: string): Promise<EnrichmentResult> {
    return this.enrichFromLinkedIn(linkedinUrl);
  }
}

export const linkedinEnrichmentService = new LinkedInEnrichmentService();
