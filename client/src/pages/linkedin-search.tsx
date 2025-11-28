import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";
import { 
  Search, 
  Linkedin, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  User, 
  Briefcase, 
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
  Users
} from "lucide-react";

const searchFormSchema = z.object({
  linkedinUrl: z.string()
    .min(1, "Please enter a LinkedIn URL")
    .refine(url => url.includes('linkedin.com/in/'), "Must be a LinkedIn profile URL (e.g., linkedin.com/in/username)")
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

interface SearchResponse {
  success: boolean;
  contacts: Contact[];
  count: number;
  message: string;
}

export default function LinkedInSearch() {
  const { toast } = useToast();
  const [searchResults, setSearchResults] = useState<Contact[] | null>(null);
  const [searchedUrl, setSearchedUrl] = useState<string>("");

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      linkedinUrl: ""
    }
  });

  const searchMutation = useMutation({
    mutationFn: async (data: SearchFormValues) => {
      const response = await fetch(`/api/contacts/linkedin-search?url=${encodeURIComponent(data.linkedinUrl)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Search failed");
      }
      return response.json() as Promise<SearchResponse>;
    },
    onSuccess: (result) => {
      setSearchResults(result.contacts);
      if (result.contacts.length > 0) {
        toast({
          title: "Contacts Found",
          description: result.message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "No Results",
          description: "No contacts found with this LinkedIn URL in your database",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Search Error",
        description: error.message,
      });
    }
  });

  const onSubmit = (data: SearchFormValues) => {
    setSearchedUrl(data.linkedinUrl);
    setSearchResults(null);
    searchMutation.mutate(data);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Linkedin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  LinkedIn Contact Search
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Search your existing contacts by their LinkedIn profile URL
                </p>
              </div>
            </div>

            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <Users className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">Database Search</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                This searches your existing contacts database. Enter a LinkedIn profile URL to find matching contacts.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search by LinkedIn Profile
                </CardTitle>
                <CardDescription>
                  Enter a LinkedIn profile URL to find contacts in your database with matching profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn Profile URL</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input 
                                placeholder="https://linkedin.com/in/username" 
                                {...field}
                                disabled={searchMutation.isPending}
                                data-testid="input-linkedin-url"
                              />
                              <Button 
                                type="submit" 
                                disabled={searchMutation.isPending}
                                data-testid="button-search-linkedin"
                              >
                                {searchMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Searching...
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                  </>
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Paste the LinkedIn profile URL of the person you want to find in your contacts
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>

            {searchResults !== null && searchResults.length === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Contacts Found</AlertTitle>
                <AlertDescription>
                  No contacts in your database have this LinkedIn profile URL: <strong>{searchedUrl}</strong>
                </AlertDescription>
              </Alert>
            )}

            {searchResults && searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold">
                    Found {searchResults.length} Contact{searchResults.length > 1 ? 's' : ''}
                  </h2>
                </div>
                
                {searchResults.map((contact) => (
                  <Card key={contact.id} className="border-green-200 dark:border-green-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5 text-gray-500" />
                            {contact.fullName}
                          </CardTitle>
                          {contact.title && (
                            <CardDescription className="flex items-center gap-1 mt-1">
                              <Briefcase className="h-4 w-4" />
                              {contact.title}
                            </CardDescription>
                          )}
                        </div>
                        <a 
                          href={`/contacts/${contact.id}`}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          data-testid={`link-view-contact-${contact.id}`}
                        >
                          View Full Profile <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          {contact.company && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-gray-500" />
                              <span className="text-sm" data-testid={`text-company-${contact.id}`}>{contact.company}</span>
                              {contact.industry && (
                                <Badge variant="secondary" className="text-xs">{contact.industry}</Badge>
                              )}
                            </div>
                          )}
                          
                          {(contact.city || contact.state || contact.country) && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-500" />
                              <span className="text-sm" data-testid={`text-location-${contact.id}`}>
                                {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-500" />
                              <a 
                                href={`mailto:${contact.email}`} 
                                className="text-sm text-blue-600 hover:underline"
                                data-testid={`link-email-${contact.id}`}
                              >
                                {contact.email}
                              </a>
                            </div>
                          )}
                          
                          {(contact.mobilePhone || contact.corporatePhone) && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-500" />
                              <span className="text-sm" data-testid={`text-phone-${contact.id}`}>
                                {contact.mobilePhone || contact.corporatePhone}
                              </span>
                            </div>
                          )}

                          {contact.personLinkedIn && (
                            <div className="flex items-center gap-2">
                              <Linkedin className="h-4 w-4 text-blue-500" />
                              <a 
                                href={contact.personLinkedIn} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                data-testid={`link-linkedin-${contact.id}`}
                              >
                                LinkedIn Profile <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {contact.leadScore && (
                        <div className="mt-4 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Lead Score:</span>
                            <Badge 
                              variant={Number(contact.leadScore) >= 7 ? "default" : Number(contact.leadScore) >= 4 ? "secondary" : "outline"}
                            >
                              {contact.leadScore}/10
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This feature searches your existing contacts database by LinkedIn profile URL:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                  <li><strong>Paste URL:</strong> Enter any LinkedIn profile URL (e.g., linkedin.com/in/johndoe)</li>
                  <li><strong>Database Search:</strong> Finds all contacts with matching LinkedIn profiles</li>
                  <li><strong>View Details:</strong> See contact info like email, phone, company, and location</li>
                </ul>
                <p className="text-sm text-gray-500 mt-3">
                  This does not call any external APIs - it simply searches your stored contacts.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
