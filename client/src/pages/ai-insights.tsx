import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Brain, Search, Users, Zap, BarChart3, AlertCircle, CheckCircle, Loader2, 
  Sparkles, RefreshCw, TrendingUp, Mail, Target, Activity, Building2, ArrowRight,
  Lightbulb, Clock, AlertTriangle
} from "lucide-react";
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

interface PredictiveScore {
  score: number;
  confidence: string;
  factors: Array<{ factor: string; impact: string; weight: number }>;
  recommendation: string;
  nextBestAction: string;
  conversionProbability: number;
  timeToConvert: string;
}

interface SalesInsights {
  summary: string;
  topOpportunities: Array<{ contactId: string; reason: string; priority: string }>;
  industryBreakdown: Array<{ industry: string; count: number; avgScore: number; insight: string }>;
  actionItems: Array<{ action: string; priority: string; expectedImpact: string }>;
  trends: Array<{ trend: string; direction: string; recommendation: string }>;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  callToAction: string;
  followUpSuggestion: string;
}

interface NextActions {
  immediateActions: Array<{ action: string; reason: string; expectedOutcome: string }>;
  shortTermActions: Array<{ action: string; timeframe: string; goal: string }>;
  longTermStrategy: string;
  warningFlags: Array<{ flag: string; action: string }>;
}

export default function AIInsights() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [predictiveResult, setPredictiveResult] = useState<{ contactName: string; prediction: PredictiveScore } | null>(null);
  const [salesInsightsResult, setSalesInsightsResult] = useState<{ contactsAnalyzed: number; insights: SalesInsights } | null>(null);
  const [emailPurpose, setEmailPurpose] = useState("");
  const [emailTone, setEmailTone] = useState<"formal" | "friendly" | "professional" | "casual">("professional");
  const [senderName, setSenderName] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [nextActionsResult, setNextActionsResult] = useState<{ contactName: string; actions: NextActions } | null>(null);

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

  const predictiveScoreMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest("/api/ai/predictive-score", {
        method: "POST",
        body: JSON.stringify({ contactId }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setPredictiveResult(data.data);
        toast({
          title: "Predictive Analysis Complete",
          description: `Score: ${data.data.prediction.score}/100 with ${data.data.prediction.confidence} confidence`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const salesInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/ai/sales-insights", {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setSalesInsightsResult(data.data);
        toast({
          title: "Sales Insights Generated",
          description: `Analyzed ${data.data.contactsAnalyzed} contacts`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Insights Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const generateEmailMutation = useMutation({
    mutationFn: async (params: { contactId: string; purpose: string; tone: string; senderName: string }) => {
      return await apiRequest("/api/ai/generate-email", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedEmail(data.data.email);
        toast({
          title: "Email Generated",
          description: "Your personalized email is ready",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Email Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const nextActionsMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest("/api/ai/next-actions", {
        method: "POST",
        body: JSON.stringify({ contactId }),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setNextActionsResult(data.data);
        toast({
          title: "Actions Generated",
          description: "Next best actions ready",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Action Generation Failed",
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

  const handleGenerateEmail = () => {
    if (selectedContactId && emailPurpose && senderName) {
      generateEmailMutation.mutate({
        contactId: selectedContactId,
        purpose: emailPurpose,
        tone: emailTone,
        senderName,
      });
    }
  };

  const aiStatus = statusData?.data;
  const usage = usageData?.data;
  const isConfigured = aiStatus?.configured ?? false;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive": return "text-green-600 dark:text-green-400";
      case "negative": return "text-red-600 dark:text-red-400";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

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
                  AI Command Center
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Enterprise AI-powered CRM intelligence
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
              <Tabs defaultValue="insights" className="space-y-4">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="insights" className="flex items-center gap-1 text-xs" data-testid="tab-insights">
                    <TrendingUp className="w-3 h-3" />
                    Insights
                  </TabsTrigger>
                  <TabsTrigger value="predictive" className="flex items-center gap-1 text-xs" data-testid="tab-predictive">
                    <Target className="w-3 h-3" />
                    Predictive
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex items-center gap-1 text-xs" data-testid="tab-email">
                    <Mail className="w-3 h-3" />
                    Email AI
                  </TabsTrigger>
                  <TabsTrigger value="search" className="flex items-center gap-1 text-xs" data-testid="tab-search">
                    <Search className="w-3 h-3" />
                    Search
                  </TabsTrigger>
                  <TabsTrigger value="enrich" className="flex items-center gap-1 text-xs" data-testid="tab-enrich">
                    <Sparkles className="w-3 h-3" />
                    Enrich
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" className="flex items-center gap-1 text-xs" data-testid="tab-duplicates">
                    <Users className="w-3 h-3" />
                    Duplicates
                  </TabsTrigger>
                  <TabsTrigger value="usage" className="flex items-center gap-1 text-xs" data-testid="tab-usage">
                    <BarChart3 className="w-3 h-3" />
                    Usage
                  </TabsTrigger>
                </TabsList>

                {/* Sales Insights Tab */}
                <TabsContent value="insights" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        AI Sales Intelligence
                      </CardTitle>
                      <CardDescription>
                        Get AI-powered strategic insights about your contact portfolio
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        onClick={() => salesInsightsMutation.mutate()}
                        disabled={salesInsightsMutation.isPending}
                        className="w-full"
                        data-testid="button-generate-insights"
                      >
                        {salesInsightsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Brain className="w-4 h-4 mr-2" />
                        )}
                        Generate Sales Insights
                      </Button>

                      {salesInsightsResult && (
                        <div className="space-y-6">
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                            <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Executive Summary</h4>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">{salesInsightsResult.insights.summary}</p>
                          </div>

                          {salesInsightsResult.insights.topOpportunities.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4 text-green-600" />
                                Top Opportunities
                              </h4>
                              <div className="space-y-2">
                                {salesInsightsResult.insights.topOpportunities.map((opp, idx) => (
                                  <div key={idx} className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="flex justify-between items-start">
                                      <p className="text-sm text-green-800 dark:text-green-200">{opp.reason}</p>
                                      <Badge className={getPriorityColor(opp.priority)}>{opp.priority}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {salesInsightsResult.insights.actionItems.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-yellow-600" />
                                Action Items
                              </h4>
                              <div className="space-y-2">
                                {salesInsightsResult.insights.actionItems.map((item, idx) => (
                                  <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex justify-between items-start mb-1">
                                      <p className="font-medium text-sm text-yellow-900 dark:text-yellow-100">{item.action}</p>
                                      <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                                    </div>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">Expected: {item.expectedImpact}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {salesInsightsResult.insights.trends.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-600" />
                                Trends
                              </h4>
                              <div className="space-y-2">
                                {salesInsightsResult.insights.trends.map((trend, idx) => (
                                  <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{trend.trend}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.direction}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">{trend.recommendation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Predictive Scoring Tab */}
                <TabsContent value="predictive" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        Predictive Lead Scoring
                      </CardTitle>
                      <CardDescription>
                        AI-powered lead scoring with conversion predictions and next best actions
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Select Contact
                          </label>
                          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                            <SelectTrigger data-testid="select-contact-predictive">
                              <SelectValue placeholder="Choose a contact..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contactsData?.contacts.slice(0, 50).map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.fullName} - {contact.company || "No company"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={() => selectedContactId && predictiveScoreMutation.mutate(selectedContactId)}
                            disabled={!selectedContactId || predictiveScoreMutation.isPending}
                            className="w-full"
                            data-testid="button-predictive-score"
                          >
                            {predictiveScoreMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Target className="w-4 h-4 mr-2" />
                            )}
                            Analyze Lead
                          </Button>
                        </div>
                      </div>

                      {predictiveResult && (
                        <div className="space-y-4 mt-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                              <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Lead Score</p>
                              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{predictiveResult.prediction.score}</p>
                              <Badge className="mt-1" variant="outline">{predictiveResult.prediction.confidence} confidence</Badge>
                            </div>
                            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Conversion Probability</p>
                              <p className="text-3xl font-bold text-green-900 dark:text-green-100">{predictiveResult.prediction.conversionProbability}%</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Time to Convert</p>
                              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">{predictiveResult.prediction.timeToConvert}</p>
                            </div>
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Next Best Action</p>
                              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">{predictiveResult.prediction.nextBestAction}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Strategic Recommendation</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{predictiveResult.prediction.recommendation}</p>
                          </div>

                          {predictiveResult.prediction.factors.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Scoring Factors</h4>
                              <div className="space-y-2">
                                {predictiveResult.prediction.factors.map((factor, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                                    <span className={`text-sm ${getImpactColor(factor.impact)}`}>{factor.factor}</span>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline">{factor.impact}</Badge>
                                      <span className="text-xs text-gray-500">+{factor.weight}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={() => selectedContactId && nextActionsMutation.mutate(selectedContactId)}
                            disabled={nextActionsMutation.isPending}
                            variant="outline"
                            className="w-full"
                            data-testid="button-next-actions"
                          >
                            {nextActionsMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <ArrowRight className="w-4 h-4 mr-2" />
                            )}
                            Get Detailed Action Plan
                          </Button>

                          {nextActionsResult && (
                            <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                              <h4 className="font-semibold text-orange-900 dark:text-orange-100">Action Plan for {nextActionsResult.contactName}</h4>
                              
                              {nextActionsResult.actions.immediateActions.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">Immediate Actions</p>
                                  {nextActionsResult.actions.immediateActions.map((action, idx) => (
                                    <div key={idx} className="ml-4 mb-2 p-2 bg-white dark:bg-gray-800 rounded">
                                      <p className="text-sm font-medium">{action.action}</p>
                                      <p className="text-xs text-gray-500">{action.reason} → {action.expectedOutcome}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {nextActionsResult.actions.warningFlags.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" />
                                    Warning Flags
                                  </p>
                                  {nextActionsResult.actions.warningFlags.map((flag, idx) => (
                                    <div key={idx} className="ml-4 mb-2 p-2 bg-red-100 dark:bg-red-900 rounded">
                                      <p className="text-sm font-medium text-red-800 dark:text-red-200">{flag.flag}</p>
                                      <p className="text-xs text-red-600 dark:text-red-400">{flag.action}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
                                <p className="text-xs text-gray-500 mb-1">Long-term Strategy</p>
                                <p className="text-sm">{nextActionsResult.actions.longTermStrategy}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Email Generator Tab */}
                <TabsContent value="email" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        AI Email Generator
                      </CardTitle>
                      <CardDescription>
                        Generate personalized outreach emails for your contacts
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Select Contact
                          </label>
                          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                            <SelectTrigger data-testid="select-contact-email">
                              <SelectValue placeholder="Choose a contact..." />
                            </SelectTrigger>
                            <SelectContent>
                              {contactsData?.contacts.slice(0, 50).map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.fullName} - {contact.company || "No company"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Your Name
                          </label>
                          <Input 
                            value={senderName} 
                            onChange={(e) => setSenderName(e.target.value)}
                            placeholder="Your name..."
                            data-testid="input-sender-name"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Email Purpose
                        </label>
                        <Textarea 
                          value={emailPurpose} 
                          onChange={(e) => setEmailPurpose(e.target.value)}
                          placeholder="What's the purpose of this email? e.g., 'Schedule a product demo', 'Follow up on our previous conversation'..."
                          rows={3}
                          data-testid="input-email-purpose"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                          Tone
                        </label>
                        <Select value={emailTone} onValueChange={(v) => setEmailTone(v as typeof emailTone)}>
                          <SelectTrigger data-testid="select-email-tone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        onClick={handleGenerateEmail}
                        disabled={!selectedContactId || !emailPurpose || !senderName || generateEmailMutation.isPending}
                        className="w-full"
                        data-testid="button-generate-email"
                      >
                        {generateEmailMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        Generate Email
                      </Button>

                      {generatedEmail && (
                        <div className="space-y-4 mt-4">
                          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Subject Line</p>
                            <p className="text-lg text-blue-900 dark:text-blue-100">{generatedEmail.subject}</p>
                          </div>

                          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                            <p className="text-sm font-medium text-gray-500 mb-2">Email Body</p>
                            <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                              {generatedEmail.body}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Call to Action</p>
                              <p className="text-sm text-green-800 dark:text-green-200">{generatedEmail.callToAction}</p>
                            </div>
                            <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Follow-up
                              </p>
                              <p className="text-sm text-purple-800 dark:text-purple-200">{generatedEmail.followUpSuggestion}</p>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
                              toast({ title: "Copied to clipboard" });
                            }}
                            className="w-full"
                            data-testid="button-copy-email"
                          >
                            Copy to Clipboard
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Smart Search Tab */}
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

                {/* Enrichment Tab */}
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

                {/* Duplicates Tab */}
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

                {/* Usage Tab */}
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
