import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useBulkOperationProgress } from "@/lib/ws-bulk-operations";
import { useProspectMatchPreview } from "@/lib/use-prospect-match-preview";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle, Building2, User, ArrowRight, Activity, Globe, Users, MapPin, Briefcase, Search, Zap } from "lucide-react";
import { format } from "date-fns";
import type { Contact, Company } from "@shared/schema";

export default function Prospects() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Contact | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [activeMatchJobId, setActiveMatchJobId] = useState<string | null>(null);
  const [newProspect, setNewProspect] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobilePhone: '',
    personLinkedIn: '',
    company: '',
    title: '',
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const matchPreview = useProspectMatchPreview();
  
  const debounceRef = { current: null as NodeJS.Timeout | null };
  
  const triggerMatchPreview = useCallback((email: string, company: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!email && !company) {
      matchPreview.reset();
      return;
    }
    
    const emailValid = email.includes('@') && email.split('@')[1]?.includes('.');
    
    if (emailValid || company.length >= 2) {
      debounceRef.current = setTimeout(() => {
        matchPreview.startPreview(email, company);
      }, 500);
    }
  }, [matchPreview]);
  
  useEffect(() => {
    if (showAddDialog && (newProspect.email || newProspect.company)) {
      triggerMatchPreview(newProspect.email, newProspect.company);
    } else if (!showAddDialog) {
      matchPreview.reset();
    }
  }, [showAddDialog]);
  
  const handleEmailChange = (value: string) => {
    setNewProspect(prev => ({ ...prev, email: value }));
    triggerMatchPreview(value, newProspect.company);
  };
  
  const handleCompanyChange = (value: string) => {
    setNewProspect(prev => ({ ...prev, company: value }));
    triggerMatchPreview(newProspect.email, value);
  };

  const matchProgress = useBulkOperationProgress({
    jobId: activeMatchJobId,
    onProgress: (event) => {
      console.log("📊 Match progress:", event);
    },
    onComplete: (event) => {
      toast({
        title: "Matching Complete",
        description: `Matched ${event.totals?.matched || 0} prospects to companies.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/prospects/unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (event) => {
      toast({
        title: "Matching Failed",
        description: event.message || "The matching operation failed.",
        variant: "destructive",
      });
    },
  });

  const isMatchRunning = matchProgress.status === 'running' || matchProgress.status === 'queued';
  const isMatchComplete = matchProgress.status === 'completed';
  const isMatchFailed = matchProgress.status === 'failed';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const { data: unmatchedProspects, isLoading: loadingUnmatched } = useQuery<Contact[]>({
    queryKey: ['/api/prospects/unmatched'],
    queryFn: async () => {
      const response = await fetch('/api/prospects/unmatched', { 
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch unmatched prospects');
      return response.json();
    },
  });

  const { data: companiesData } = useQuery<{ companies: Company[], total: number }>({
    queryKey: ['/api/companies/list'],
    queryFn: async () => {
      const response = await fetch('/api/companies', { 
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
  });

  const createProspectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create prospect');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospects/unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setShowAddDialog(false);
      setNewProspect({
        firstName: '',
        lastName: '',
        email: '',
        mobilePhone: '',
        personLinkedIn: '',
        company: '',
        title: '',
      });
      
      const matchStatus = data.companyMatchStatus;
      if (matchStatus === 'matched') {
        toast({
          title: "Prospect added and matched!",
          description: `${data.fullName} was automatically matched to ${data.company}.`,
        });
      } else {
        toast({
          title: "Prospect added",
          description: matchStatus === 'pending_review' 
            ? "Company not found in database. Added to review queue."
            : "Prospect added successfully.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add prospect.",
        variant: "destructive",
      });
    },
  });

  const bulkMatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/bulk/match", { method: "POST" });
      return response;
    },
    onSuccess: (data: any) => {
      setActiveMatchJobId(data.jobId);
      toast({
        title: "Starting Match Operation",
        description: "Matching contacts to companies with real-time progress...",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start bulk match operation",
        variant: "destructive",
      });
    },
  });

  const resetMatchProgress = () => {
    setActiveMatchJobId(null);
  };

  const assignCompanyMutation = useMutation({
    mutationFn: async ({ prospectId, companyId }: { prospectId: string, companyId: string }) => {
      const response = await fetch(`/api/prospects/${prospectId}/assign-company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to assign company');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prospects/unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setShowAssignDialog(false);
      setSelectedProspect(null);
      setSelectedCompanyId('');
      toast({
        title: "Company assigned",
        description: "Prospect has been matched to the company.",
      });
    },
  });

  const handleCreateProspect = () => {
    createProspectMutation.mutate(newProspect);
  };

  const handleAssignCompany = () => {
    if (selectedProspect && selectedCompanyId) {
      assignCompanyMutation.mutate({
        prospectId: selectedProspect.id,
        companyId: selectedCompanyId,
      });
    }
  };

  const openAssignDialog = (prospect: Contact) => {
    setSelectedProspect(prospect);
    setShowAssignDialog(true);
  };

  const getMatchStatusBadge = (status: string | null) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-green-100 text-green-800">Matched</Badge>;
      case 'manual':
        return <Badge className="bg-blue-100 text-blue-800">Manual</Badge>;
      case 'pending_review':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unmatched</Badge>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Prospects</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Add prospects with just 5 fields. Company details are auto-filled from your database.
                  </p>
                </div>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-prospect">
                      <i className="fas fa-user-plus mr-2"></i>
                      Add Prospect
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add New Prospect</DialogTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Enter the 5 required fields. Company details will be auto-filled if matched.
                      </p>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                          <Input
                            value={newProspect.firstName}
                            onChange={(e) => setNewProspect({ ...newProspect, firstName: e.target.value })}
                            placeholder="John"
                            data-testid="input-prospect-firstname"
                          />
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                          <Input
                            value={newProspect.lastName}
                            onChange={(e) => setNewProspect({ ...newProspect, lastName: e.target.value })}
                            placeholder="Doe"
                            data-testid="input-prospect-lastname"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={newProspect.email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="john@acme.com"
                          data-testid="input-prospect-email"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email domain will be used to match company</p>
                      </div>
                      <div>
                        <Label>Phone *</Label>
                        <Input
                          value={newProspect.mobilePhone}
                          onChange={(e) => setNewProspect({ ...newProspect, mobilePhone: e.target.value })}
                          placeholder="+1 555 123 4567"
                          data-testid="input-prospect-phone"
                        />
                      </div>
                      <div>
                        <Label>LinkedIn Profile *</Label>
                        <Input
                          value={newProspect.personLinkedIn}
                          onChange={(e) => setNewProspect({ ...newProspect, personLinkedIn: e.target.value })}
                          placeholder="https://linkedin.com/in/johndoe"
                          data-testid="input-prospect-linkedin"
                        />
                      </div>
                      <hr className="my-4" />
                      <p className="text-sm text-gray-500">Optional fields (help with matching):</p>
                      <div>
                        <Label>Company Name</Label>
                        <Input
                          value={newProspect.company}
                          onChange={(e) => handleCompanyChange(e.target.value)}
                          placeholder="Acme Inc."
                          data-testid="input-prospect-company"
                        />
                      </div>
                      
                      {(matchPreview.isLoading || matchPreview.matched || matchPreview.steps.length > 0) && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg border" data-testid="match-preview-panel">
                          <div className="flex items-center gap-2 mb-3">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Real-time Company Matching</span>
                            {matchPreview.isLoading && (
                              <Loader2 className="h-4 w-4 animate-spin ml-auto text-blue-500" />
                            )}
                            {matchPreview.matched && !matchPreview.isLoading && (
                              <CheckCircle2 className="h-4 w-4 ml-auto text-green-500" />
                            )}
                            {!matchPreview.matched && !matchPreview.isLoading && matchPreview.progress === 100 && (
                              <XCircle className="h-4 w-4 ml-auto text-yellow-500" />
                            )}
                          </div>
                          
                          <div className="space-y-2 mb-3">
                            <Progress value={matchPreview.progress} className="h-1.5" data-testid="match-preview-progress" />
                            <p className="text-xs text-muted-foreground">{matchPreview.message}</p>
                          </div>
                          
                          {matchPreview.steps.length > 0 && (
                            <div className="space-y-1 text-xs mb-3">
                              {matchPreview.steps.slice(-4).map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  {step.step === 'complete' ? (
                                    step.matched ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <XCircle className="h-3 w-3 text-yellow-500" />
                                    )
                                  ) : step.step.includes('match_found') ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  ) : step.step.includes('no_match') || step.step.includes('invalid') ? (
                                    <XCircle className="h-3 w-3 text-yellow-500" />
                                  ) : (
                                    <Zap className="h-3 w-3 text-blue-500" />
                                  )}
                                  <span className={
                                    step.step.includes('match_found') ? 'text-green-600' :
                                    step.step.includes('no_match') ? 'text-yellow-600' :
                                    'text-muted-foreground'
                                  }>
                                    {step.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {matchPreview.matched && matchPreview.company && (
                            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-3" data-testid="matched-company-card">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-700 dark:text-green-400">Company Match Found!</span>
                                <Badge className="ml-auto bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  {matchPreview.confidence}% confidence
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <p className="font-semibold text-lg">{matchPreview.company.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Matched via {matchPreview.matchType === 'domain' ? 'email domain' : 'company name'}
                                </p>
                                <Separator className="my-2" />
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  The following details will be auto-filled:
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {matchPreview.company.industry && (
                                    <div className="flex items-center gap-1.5">
                                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                                      <span>{matchPreview.company.industry}</span>
                                    </div>
                                  )}
                                  {matchPreview.company.employeeSizeBracket && (
                                    <div className="flex items-center gap-1.5">
                                      <Users className="h-3 w-3 text-muted-foreground" />
                                      <span>{matchPreview.company.employeeSizeBracket}</span>
                                    </div>
                                  )}
                                  {matchPreview.company.website && (
                                    <div className="flex items-center gap-1.5">
                                      <Globe className="h-3 w-3 text-muted-foreground" />
                                      <span className="truncate">{matchPreview.company.website}</span>
                                    </div>
                                  )}
                                  {(matchPreview.company.city || matchPreview.company.country) && (
                                    <div className="flex items-center gap-1.5">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      <span>
                                        {[matchPreview.company.city, matchPreview.company.state, matchPreview.company.country]
                                          .filter(Boolean).join(', ')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {matchPreview.company.technologies && (
                                  <div className="mt-2">
                                    <span className="text-xs text-muted-foreground">Technologies: </span>
                                    <span className="text-xs">{matchPreview.company.technologies}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {!matchPreview.matched && !matchPreview.isLoading && matchPreview.progress === 100 && (
                            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-3" data-testid="no-match-notice">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                                  No matching company found. Prospect will be added to review queue.
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <Label>Job Title</Label>
                        <Input
                          value={newProspect.title}
                          onChange={(e) => setNewProspect({ ...newProspect, title: e.target.value })}
                          placeholder="Software Engineer"
                          data-testid="input-prospect-title"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                      <Button 
                        onClick={handleCreateProspect} 
                        disabled={
                          !newProspect.firstName || 
                          !newProspect.lastName || 
                          !newProspect.email || 
                          !newProspect.mobilePhone || 
                          !newProspect.personLinkedIn ||
                          createProspectMutation.isPending
                        }
                        data-testid="button-save-prospect"
                      >
                        {createProspectMutation.isPending ? 'Adding...' : 'Add Prospect'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Tabs defaultValue="unmatched" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="unmatched" data-testid="tab-unmatched">
                    Needs Review ({unmatchedProspects?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="guide" data-testid="tab-guide">
                    How It Works
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="unmatched">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle>Unmatched Prospects</CardTitle>
                          <CardDescription>
                            These prospects couldn't be automatically matched to a company. Assign them manually.
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeMatchJobId && (isMatchComplete || isMatchFailed) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={resetMatchProgress}
                              data-testid="button-dismiss-progress"
                            >
                              Dismiss
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            onClick={() => bulkMatchMutation.mutate()}
                            disabled={bulkMatchMutation.isPending || isMatchRunning}
                            data-testid="button-bulk-match"
                          >
                            {isMatchRunning ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Matching...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-sync-alt mr-2"></i>
                                Retry Matching
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {activeMatchJobId && (
                        <div className="mb-6 space-y-4 p-4 bg-muted/50 rounded-lg" data-testid="match-progress-panel">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isMatchRunning && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                              {isMatchComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                              {isMatchFailed && <XCircle className="h-5 w-5 text-red-500" />}
                              <div>
                                <p className="font-medium">
                                  {isMatchRunning ? 'Matching in Progress' : isMatchComplete ? 'Matching Complete' : 'Matching Failed'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {matchProgress.message || 'Processing...'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={isMatchRunning ? "default" : isMatchComplete ? "outline" : "destructive"}>
                              {matchProgress.status}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span className="font-medium">{matchProgress.percentComplete}%</span>
                            </div>
                            <Progress value={matchProgress.percentComplete} className="h-2" data-testid="match-progress-bar" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{matchProgress.processed} of {matchProgress.total} processed</span>
                              {isMatchRunning && matchProgress.current?.name && (
                                <span>Processing: {matchProgress.current.name}</span>
                              )}
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-4 gap-4 text-center">
                            <div className="space-y-1" data-testid="match-stat-success">
                              <div className="text-xl font-bold text-green-600">{matchProgress.success}</div>
                              <div className="text-xs text-muted-foreground">Success</div>
                            </div>
                            <div className="space-y-1" data-testid="match-stat-matched">
                              <div className="text-xl font-bold text-blue-600">{matchProgress.matched}</div>
                              <div className="text-xs text-muted-foreground">Matched</div>
                            </div>
                            <div className="space-y-1" data-testid="match-stat-skipped">
                              <div className="text-xl font-bold text-yellow-600">{matchProgress.skipped}</div>
                              <div className="text-xs text-muted-foreground">Skipped</div>
                            </div>
                            <div className="space-y-1" data-testid="match-stat-failed">
                              <div className="text-xl font-bold text-red-600">{matchProgress.failed}</div>
                              <div className="text-xs text-muted-foreground">Failed</div>
                            </div>
                          </div>

                          {matchProgress.current && isMatchRunning && (
                            <>
                              <Separator />
                              <div className="bg-background rounded-lg p-3 space-y-2" data-testid="current-match-item">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <User className="h-4 w-4" />
                                  <span>Currently Processing</span>
                                </div>
                                <div className="pl-6 space-y-1">
                                  <p className="font-medium">{matchProgress.current.name}</p>
                                  {matchProgress.current.step && (
                                    <p className="text-xs text-muted-foreground">{matchProgress.current.step}</p>
                                  )}
                                  {matchProgress.current.companyMatched && (
                                    <div className="flex items-center gap-2 text-xs text-green-600">
                                      <Building2 className="h-3 w-3" />
                                      <ArrowRight className="h-3 w-3" />
                                      <span>{matchProgress.current.companyMatched}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                          {matchProgress.activity.length > 0 && (
                            <>
                              <Separator />
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Activity className="h-4 w-4" />
                                  <span>Activity Log</span>
                                  <Badge variant="outline" className="ml-auto text-xs">
                                    {matchProgress.activity.length} entries
                                  </Badge>
                                </div>
                                <ScrollArea className="h-[120px] rounded-lg border p-2" data-testid="match-activity-log">
                                  <div className="space-y-1">
                                    {[...matchProgress.activity].reverse().slice(0, 30).map((entry, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-xs">
                                        <span className="text-muted-foreground whitespace-nowrap">
                                          {format(new Date(entry.timestamp), "HH:mm:ss")}
                                        </span>
                                        <span className={
                                          entry.type === 'Matched' ? 'text-green-600' :
                                          entry.type === 'Failed' ? 'text-red-600' :
                                          entry.type.includes('Skipped') ? 'text-yellow-600' :
                                          'text-foreground'
                                        }>
                                          {entry.message}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {loadingUnmatched ? (
                        <div className="text-center py-8">Loading...</div>
                      ) : unmatchedProspects?.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
                          <p>All prospects are matched! No review needed.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Email Domain</TableHead>
                              <TableHead>Company (if provided)</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unmatchedProspects?.map((prospect) => (
                              <TableRow key={prospect.id} data-testid={`row-prospect-${prospect.id}`}>
                                <TableCell className="font-medium">{prospect.fullName}</TableCell>
                                <TableCell>{prospect.email}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{prospect.emailDomain || '-'}</Badge>
                                </TableCell>
                                <TableCell>{prospect.company || '-'}</TableCell>
                                <TableCell>{getMatchStatusBadge(prospect.companyMatchStatus)}</TableCell>
                                <TableCell>
                                  <Button 
                                    size="sm" 
                                    onClick={() => openAssignDialog(prospect)}
                                    data-testid={`button-assign-${prospect.id}`}
                                  >
                                    Assign Company
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="guide">
                  <Card>
                    <CardHeader>
                      <CardTitle>Simplified Prospect Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-3xl text-blue-500 mb-2">
                            <i className="fas fa-user-plus"></i>
                          </div>
                          <h3 className="font-semibold mb-2">1. Add Prospect</h3>
                          <p className="text-sm text-gray-600">
                            Enter just 5 fields: First Name, Last Name, Email, Phone, LinkedIn
                          </p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-3xl text-green-500 mb-2">
                            <i className="fas fa-magic"></i>
                          </div>
                          <h3 className="font-semibold mb-2">2. Auto-Match</h3>
                          <p className="text-sm text-gray-600">
                            System extracts email domain and matches to your company database
                          </p>
                        </div>
                        <div className="text-center p-4 border rounded-lg">
                          <div className="text-3xl text-purple-500 mb-2">
                            <i className="fas fa-database"></i>
                          </div>
                          <h3 className="font-semibold mb-2">3. Auto-Fill</h3>
                          <p className="text-sm text-gray-600">
                            All company details (industry, size, location, etc.) are filled automatically
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          <i className="fas fa-lightbulb mr-2"></i>
                          Pro Tip
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          First, upload your company database with email domains. Then when you add prospects, 
                          their email domains will automatically match to companies. For example, if you have 
                          "acme.com" as a domain for "Acme Inc.", any prospect with an @acme.com email will 
                          automatically get all the company details.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Company to Prospect</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="font-medium">{selectedProspect?.fullName}</p>
                      <p className="text-sm text-gray-500">{selectedProspect?.email}</p>
                    </div>
                    <div>
                      <Label>Select Company</Label>
                      <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                        <SelectTrigger data-testid="select-company">
                          <SelectValue placeholder="Choose a company..." />
                        </SelectTrigger>
                        <SelectContent>
                          {companiesData?.companies?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name} {company.industry && `(${company.industry})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={handleAssignCompany}
                      disabled={!selectedCompanyId || assignCompanyMutation.isPending}
                      data-testid="button-confirm-assign"
                    >
                      {assignCompanyMutation.isPending ? 'Assigning...' : 'Assign Company'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
