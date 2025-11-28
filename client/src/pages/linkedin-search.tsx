import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Search, 
  Linkedin, 
  Mail, 
  Phone, 
  Building2, 
  MapPin, 
  User, 
  Briefcase, 
  UserPlus, 
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Settings,
  History,
  Coins
} from "lucide-react";

const searchFormSchema = z.object({
  linkedinUrl: z.string()
    .url("Please enter a valid URL")
    .refine(url => url.includes('linkedin.com/in/'), "Must be a LinkedIn profile URL (e.g., linkedin.com/in/username)")
});

type SearchFormValues = z.infer<typeof searchFormSchema>;

interface EnrichmentResult {
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
}

interface EnrichmentJob {
  id: string;
  linkedinUrl: string;
  status: string;
  provider: string;
  enrichedEmail: string | null;
  enrichedPhone: string | null;
  creditsUsed: number | null;
  createdAt: string;
  completedAt: string | null;
}

export default function LinkedInSearch() {
  const { toast } = useToast();
  const [searchResult, setSearchResult] = useState<EnrichmentResult | null>(null);
  const [searchedUrl, setSearchedUrl] = useState<string>("");

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      linkedinUrl: ""
    }
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<{
    configured: boolean;
    provider: string;
    message: string;
  }>({
    queryKey: ["/api/enrichment/status"]
  });

  const { data: jobsData } = useQuery<{ jobs: EnrichmentJob[] }>({
    queryKey: ["/api/enrichment/jobs"]
  });

  const searchMutation = useMutation({
    mutationFn: async (data: SearchFormValues) => {
      return apiRequest("/api/enrichment/search", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        setSearchResult(result.data);
        toast({
          title: "Contact Found",
          description: `Found contact details. Credits used: ${result.creditsUsed || 0}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Search Failed",
          description: result.error || "Could not find contact details",
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

  const createContactMutation = useMutation({
    mutationFn: async (linkedinUrl: string) => {
      return apiRequest("/api/enrichment/create-contact", {
        method: "POST",
        body: JSON.stringify({ linkedinUrl }),
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/enrichment/jobs"] });
        toast({
          title: "Contact Created",
          description: `${result.contact.fullName} has been added to your contacts.`,
        });
        setSearchResult(null);
        form.reset();
        setSearchedUrl("");
      } else {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: result.error || "Could not create contact",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Creation Error",
        description: error.message,
      });
    }
  });

  const onSubmit = (data: SearchFormValues) => {
    setSearchedUrl(data.linkedinUrl);
    setSearchResult(null);
    searchMutation.mutate(data);
  };

  const handleCreateContact = () => {
    if (searchedUrl) {
      createContactMutation.mutate(searchedUrl);
    }
  };

  const isConfigured = statusData?.configured;

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
                  Find email addresses and phone numbers from LinkedIn profiles
                </p>
              </div>
            </div>

            {statusLoading ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ) : !isConfigured ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>API Key Required</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>LinkedIn enrichment requires a Proxycurl API key to function.</p>
                  <p className="text-sm">
                    To enable this feature:
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Sign up at <a href="https://nubela.co/proxycurl" target="_blank" rel="noopener noreferrer" className="underline">Proxycurl</a></li>
                      <li>Get your API key from your dashboard</li>
                      <li>Add it to your secrets as <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">PROXYCURL_API_KEY</code></li>
                    </ol>
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">Ready to Search</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  LinkedIn enrichment is configured and ready to use.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search by LinkedIn Profile
                </CardTitle>
                <CardDescription>
                  Enter a LinkedIn profile URL to find contact details like email and phone number
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
                                disabled={!isConfigured || searchMutation.isPending}
                                data-testid="input-linkedin-url"
                              />
                              <Button 
                                type="submit" 
                                disabled={!isConfigured || searchMutation.isPending}
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
                            Paste the full LinkedIn profile URL of the person you want to find
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>

            {searchResult && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      Contact Details Found
                    </CardTitle>
                    <CardDescription>
                      Review the information and add to your contacts
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleCreateContact}
                    disabled={createContactMutation.isPending}
                    data-testid="button-create-contact"
                  >
                    {createContactMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add to Contacts
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Full Name</p>
                          <p className="font-medium" data-testid="text-result-name">
                            {searchResult.fullName || `${searchResult.firstName || ''} ${searchResult.lastName || ''}`.trim() || 'Not found'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Briefcase className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Title</p>
                          <p className="font-medium" data-testid="text-result-title">
                            {searchResult.title || searchResult.headline || 'Not found'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Company</p>
                          <p className="font-medium" data-testid="text-result-company">
                            {searchResult.company || 'Not found'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Location</p>
                          <p className="font-medium" data-testid="text-result-location">
                            {[searchResult.city, searchResult.state, searchResult.country].filter(Boolean).join(', ') || 'Not found'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <div className="space-y-1">
                            {searchResult.workEmail && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Work</Badge>
                                <p className="font-medium text-blue-600" data-testid="text-result-work-email">
                                  {searchResult.workEmail}
                                </p>
                              </div>
                            )}
                            {searchResult.personalEmail && (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Personal</Badge>
                                <p className="font-medium text-blue-600" data-testid="text-result-personal-email">
                                  {searchResult.personalEmail}
                                </p>
                              </div>
                            )}
                            {!searchResult.workEmail && !searchResult.personalEmail && searchResult.email && (
                              <p className="font-medium text-blue-600" data-testid="text-result-email">
                                {searchResult.email}
                              </p>
                            )}
                            {!searchResult.workEmail && !searchResult.personalEmail && !searchResult.email && (
                              <p className="text-gray-400">Not found</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-green-500 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className={`font-medium ${searchResult.phone ? 'text-green-600' : 'text-gray-400'}`} data-testid="text-result-phone">
                            {searchResult.phone || 'Not found'}
                          </p>
                        </div>
                      </div>

                      {searchResult.companyLinkedIn && (
                        <div className="flex items-start gap-3">
                          <Linkedin className="h-5 w-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Company LinkedIn</p>
                            <a 
                              href={searchResult.companyLinkedIn} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                            >
                              View Profile <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      )}

                      {searchResult.skills && searchResult.skills.length > 0 && (
                        <div className="flex items-start gap-3">
                          <Settings className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-500">Skills</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {searchResult.skills.slice(0, 5).map((skill, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {searchResult.skills.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{searchResult.skills.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {jobsData?.jobs && jobsData.jobs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Searches
                  </CardTitle>
                  <CardDescription>
                    Your recent LinkedIn enrichment requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {jobsData.jobs.slice(0, 5).map((job) => (
                      <div 
                        key={job.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Linkedin className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium truncate max-w-xs">
                              {job.linkedinUrl.replace('https://linkedin.com/in/', '').replace('https://www.linkedin.com/in/', '')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {job.enrichedEmail && (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          {job.enrichedPhone && (
                            <Badge variant="outline" className="text-xs">
                              <Phone className="h-3 w-3 mr-1" />
                              Phone
                            </Badge>
                          )}
                          <Badge 
                            variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}
                          >
                            {job.status}
                          </Badge>
                          {job.creditsUsed && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {job.creditsUsed}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>About LinkedIn Enrichment</CardTitle>
              </CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This feature uses the Proxycurl API to find contact information from LinkedIn profiles. 
                  Each search uses credits from your Proxycurl account:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                  <li><strong>Profile data:</strong> 1 credit</li>
                  <li><strong>Work email:</strong> 3 credits</li>
                  <li><strong>Personal email:</strong> 2 credits</li>
                  <li><strong>Phone number:</strong> 1 credit</li>
                </ul>
                <p className="text-sm text-gray-500 mt-3">
                  A typical search uses 5-7 credits depending on data availability.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
