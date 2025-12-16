import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Brain, Search, Users, Zap, BarChart3, AlertCircle, CheckCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import type { Contact } from "@shared/schema";

interface AIStatus {
  configured: boolean;
  model: string;
  provider: string;
  features: string[];
}

interface AIUsageStats {
  period: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedResponses: number;
  totalTokens: number;
  byOperationType: Record<string, number>;
}

interface DuplicateResult {
  contactId1: string;
  contactId2: string;
  confidence: number;
  reason: string;
}

interface SearchResult {
  query: string;
  interpretation: string;
  filters: Record<string, any>;
  contacts: Contact[];
  total: number;
}

export default function AIInsights() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  const { data: statusData, isLoading: statusLoading } = useQuery<{ success: boolean; data: AIStatus }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery<{ success: boolean; data: AIUsageStats }>({
    queryKey: ["/api/ai/usage"],
    enabled: statusData?.data?.configured,
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ contacts: Contact[]; total: number }>({
    queryKey: ["/api/contacts"],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      return await apiRequest("/api/ai/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setSearchResults(data.data);
        toast({
          title: "Search Complete",
          description: `Found ${data.data.total} contacts matching your query`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const duplicatesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/ai/detect-duplicates", {
        method: "POST",
        body: JSON.stringify({ limit: 50 }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Duplicate Detection Complete",
          description: `Found ${data.data.duplicates.length} potential duplicates`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Detection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest("/api/ai/enrich-contact", {
        method: "POST",
        body: JSON.stringify({ contactId }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        toast({
          title: "Enrichment Complete",
          description: `Updated ${data.data.fieldsUpdated.length} fields`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const bulkEnrichMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      return await apiRequest("/api/ai/bulk-enrich", {
        method: "POST",
        body: JSON.stringify({ contactIds }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        toast({
          title: "Bulk Enrichment Complete",
          description: `Successfully enriched ${data.data.summary.successful} contacts`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Bulk Enrichment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const aiStatus = statusData?.data;
  const usage = usageData?.data;
  const isConfigured = aiStatus?.configured ?? false;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-7 h-7 text-purple-600" />
                  AI Insights
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Powered by Gemini 2.0 Flash via OpenRouter
                </p>
              </div>
              {statusLoading ? (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </Badge>
              ) : isConfigured ? (
                <Badge variant="default" className="bg-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  AI Active
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not Configured
                </Badge>
              )}
            </div>

            {!isConfigured && !statusLoading && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    AI Service Not Configured
                  </CardTitle>
                  <CardDescription className="text-amber-700 dark:text-amber-300">
                    Add your OPENROUTER_API_KEY secret to enable AI features. You can get a free API key from openrouter.ai
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {isConfigured && (
              <Tabs defaultValue="search" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search">
                    <Search className="w-4 h-4" />
                    Smart Search
                  </TabsTrigger>
                  <TabsTrigger value="enrich" className="flex items-center gap-2" data-testid="tab-enrich">
                    <Sparkles className="w-4 h-4" />
                    Enrichment
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" className="flex items-center gap-2" data-testid="tab-duplicates">
                    <Users className="w-4 h-4" />
                    Duplicates
                  </TabsTrigger>
                  <TabsTrigger value="usage" className="flex items-center gap-2" data-testid="tab-usage">
                    <BarChart3 className="w-4 h-4" />
                    Usage
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-600" />
                        Natural Language Search
                      </CardTitle>
                      <CardDescription>
                        Search contacts using plain English. Try "Find tech executives in California" or "Show me leads from healthcare companies"
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Describe what you're looking for..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          className="flex-1"
                          data-testid="input-ai-search"
                        />
                        <Button 
                          onClick={handleSearch} 
                          disabled={searchMutation.isPending || !searchQuery.trim()}
                          data-testid="button-ai-search"
                        >
                          {searchMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                          Search
                        </Button>
                      </div>

                      {searchResults && (
                        <div className="space-y-3">
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              <strong>Interpretation:</strong> {searchResults.interpretation}
                            </p>
                            {Object.keys(searchResults.filters).length > 0 && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {Object.entries(searchResults.filters).map(([key, value]) => (
                                  <Badge key={key} variant="secondary">
                                    {key}: {String(value)}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Found {searchResults.total} contacts
                          </div>

                          <ScrollArea className="h-64 rounded-lg border">
                            <div className="p-4 space-y-2">
                              {searchResults.contacts.map((contact) => (
                                <div 
                                  key={contact.id} 
                                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border flex justify-between items-center"
                                  data-testid={`search-result-${contact.id}`}
                                >
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{contact.fullName}</p>
                                    <p className="text-sm text-gray-500">{contact.title} at {contact.company}</p>
                                    <p className="text-xs text-gray-400">{contact.email}</p>
                                  </div>
                                  {contact.leadScore && (
                                    <Badge variant="outline">Score: {contact.leadScore}</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="enrich" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Contact Enrichment
                      </CardTitle>
                      <CardDescription>
                        Use AI to automatically fill missing fields, suggest industries, and generate lead scores
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        onClick={() => {
                          const contactIds = contactsData?.contacts
                            .filter(c => !c.industry || !c.leadScore)
                            .slice(0, 10)
                            .map(c => c.id) || [];
                          if (contactIds.length > 0) {
                            bulkEnrichMutation.mutate(contactIds);
                          } else {
                            toast({
                              title: "No Contacts to Enrich",
                              description: "All contacts already have complete data",
                            });
                          }
                        }}
                        disabled={bulkEnrichMutation.isPending}
                        className="w-full"
                        data-testid="button-bulk-enrich"
                      >
                        {bulkEnrichMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        Enrich Up to 10 Contacts with Missing Data
                      </Button>

                      <div className="text-sm text-gray-500">
                        Select individual contacts to enrich:
                      </div>

                      <ScrollArea className="h-80 rounded-lg border">
                        <div className="p-4 space-y-2">
                          {contactsData?.contacts.slice(0, 20).map((contact) => (
                            <div 
                              key={contact.id} 
                              className="p-3 bg-white dark:bg-gray-800 rounded-lg border flex justify-between items-center"
                              data-testid={`enrich-contact-${contact.id}`}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{contact.fullName}</p>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                  {contact.industry ? (
                                    <Badge variant="outline" className="text-xs">
                                      {contact.industry}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                                      Missing Industry
                                    </Badge>
                                  )}
                                  {contact.leadScore ? (
                                    <Badge variant="outline" className="text-xs">
                                      Score: {contact.leadScore}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                                      No Score
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => enrichMutation.mutate(contact.id)}
                                disabled={enrichMutation.isPending}
                                data-testid={`button-enrich-${contact.id}`}
                              >
                                {enrichMutation.isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="duplicates" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-600" />
                        AI Duplicate Detection
                      </CardTitle>
                      <CardDescription>
                        Find potential duplicate contacts using fuzzy matching and AI analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        onClick={() => duplicatesMutation.mutate()}
                        disabled={duplicatesMutation.isPending}
                        className="w-full"
                        data-testid="button-detect-duplicates"
                      >
                        {duplicatesMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Search className="w-4 h-4 mr-2" />
                        )}
                        Scan for Duplicates
                      </Button>

                      {duplicatesMutation.data?.data?.duplicates && (
                        <div className="space-y-3">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Found {duplicatesMutation.data.data.duplicates.length} potential duplicates
                          </div>

                          <ScrollArea className="h-64 rounded-lg border">
                            <div className="p-4 space-y-2">
                              {duplicatesMutation.data.data.duplicates.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                                  No duplicates found!
                                </div>
                              ) : (
                                duplicatesMutation.data.data.duplicates.map((dup: DuplicateResult, idx: number) => (
                                  <div 
                                    key={idx}
                                    className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800"
                                    data-testid={`duplicate-${idx}`}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                          <strong>Pair:</strong> {dup.contactId1} ↔ {dup.contactId2}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                          {dup.reason}
                                        </p>
                                      </div>
                                      <Badge 
                                        variant={dup.confidence > 80 ? "destructive" : "secondary"}
                                      >
                                        {dup.confidence}% match
                                      </Badge>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="usage" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                        AI Usage Statistics
                      </CardTitle>
                      <CardDescription>
                        Monitor your AI usage over the last 30 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {usageLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : usage ? (
                        <div className="space-y-6">
                          <div className="flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => refetchUsage()}
                              data-testid="button-refresh-usage"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Refresh
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                              <p className="text-sm text-blue-600 dark:text-blue-400">Total Requests</p>
                              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{usage.totalRequests}</p>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                              <p className="text-sm text-green-600 dark:text-green-400">Successful</p>
                              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{usage.successfulRequests}</p>
                            </div>
                            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                              <p className="text-sm text-purple-600 dark:text-purple-400">Cached</p>
                              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{usage.cachedResponses}</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                              <p className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{usage.totalTokens.toLocaleString()}</p>
                            </div>
                          </div>

                          {Object.keys(usage.byOperationType).length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Requests by Operation Type
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(usage.byOperationType).map(([type, count]) => (
                                  <Badge key={type} variant="outline">
                                    {type}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No usage data available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
