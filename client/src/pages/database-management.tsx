import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BulkOperationsPanel } from "@/components/BulkOperationsPanel";
import { 
  Database, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  TrendingUp,
  Users,
  Building2,
  Shield,
  Archive,
  FileSearch,
  Zap,
  XCircle,
  Eye,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";

interface DatabaseHealth {
  totalRecords: { contacts: number; companies: number };
  dataQuality: { score: number; issuesByType: Record<string, number> };
  matchingStatus: { matched: number; unmatched: number; pendingReview: number };
  growthMetrics: { contactsThisWeek: number; companiesThisWeek: number };
  recentActivity: { imports: number; enrichments: number; apiRequests: number };
}

interface DataQualityIssue {
  id: string;
  entityType: string;
  entityId: string;
  issueType: string;
  severity: string;
  description: string;
  fieldName: string | null;
  suggestedValue: string | null;
  status: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  userId: string | null;
  changeSource: string;
  changedFields: string[] | null;
  createdAt: string;
}

interface ArchivedRecord {
  id: string;
  entityType: string;
  originalId: string;
  deletedAt: string;
  expiresAt: string;
  data: any;
}

export default function DatabaseManagement() {
  const { toast } = useToast();
  const [issueStatusFilter, setIssueStatusFilter] = useState("open");
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("all");

  const { data: healthData, isLoading: healthLoading } = useQuery<{ success: boolean; data: DatabaseHealth }>({
    queryKey: ["/api/database/health"],
    refetchInterval: 30000,
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery<{ success: boolean; data: DataQualityIssue[]; total: number }>({
    queryKey: ["/api/database/quality/issues", issueStatusFilter, issueSeverityFilter],
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<{ success: boolean; data: AuditLog[] }>({
    queryKey: ["/api/database/audit"],
  });

  const { data: archiveData, isLoading: archiveLoading } = useQuery<{ success: boolean; data: ArchivedRecord[]; total: number }>({
    queryKey: ["/api/database/archive"],
  });

  const runQualityCheckMutation = useMutation({
    mutationFn: () => apiRequest("/api/database/quality/check", { method: "POST" }),
    onSuccess: (data: any) => {
      toast({
        title: "Quality Check Complete",
        description: `Found ${data.data.issuesFound} issues, created ${data.data.issuesCreated} new issues`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/database/quality/issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run quality checks", variant: "destructive" });
    },
  });

  const captureMetricsMutation = useMutation({
    mutationFn: () => apiRequest("/api/database/metrics/snapshot", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Success", description: "Metrics snapshot captured" });
      queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to capture metrics", variant: "destructive" });
    },
  });

  const resolveIssueMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/database/quality/issues/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Issue Resolved", description: "The data quality issue has been marked as resolved" });
      queryClient.invalidateQueries({ queryKey: ["/api/database/quality/issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve issue", variant: "destructive" });
    },
  });

  const ignoreIssueMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/database/quality/issues/${id}/ignore`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Issue Ignored", description: "The data quality issue has been ignored" });
      queryClient.invalidateQueries({ queryKey: ["/api/database/quality/issues"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to ignore issue", variant: "destructive" });
    },
  });

  const restoreRecordMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/database/archive/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Record Restored", description: "The archived record has been restored" });
      queryClient.invalidateQueries({ queryKey: ["/api/database/archive"] });
      queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to restore record", variant: "destructive" });
    },
  });

  const cleanupArchivesMutation = useMutation({
    mutationFn: () => apiRequest("/api/database/archive/cleanup", { method: "POST" }),
    onSuccess: (data: any) => {
      toast({ title: "Cleanup Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/database/archive"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cleanup archives", variant: "destructive" });
    },
  });

  const health = healthData?.data;
  const issues = issuesData?.data || [];
  const auditLogs = auditData?.data || [];
  const archives = archiveData?.data || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "create": return "default";
      case "update": return "secondary";
      case "delete": return "destructive";
      case "restore": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="h-6 w-6" />
                  Database Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Monitor data health, quality, and manage your database
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => captureMetricsMutation.mutate()}
                  disabled={captureMetricsMutation.isPending}
                  data-testid="button-capture-metrics"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${captureMetricsMutation.isPending ? "animate-spin" : ""}`} />
                  Capture Metrics
                </Button>
                <Button
                  onClick={() => runQualityCheckMutation.mutate()}
                  disabled={runQualityCheckMutation.isPending}
                  data-testid="button-run-quality-check"
                >
                  <Zap className={`h-4 w-4 mr-2 ${runQualityCheckMutation.isPending ? "animate-spin" : ""}`} />
                  Run Quality Check
                </Button>
              </div>
            </div>

            {healthLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-total-contacts">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health?.totalRecords.contacts.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      +{health?.growthMetrics.contactsThisWeek || 0} this week
                    </p>
                  </CardContent>
                </Card>
                <Card data-testid="card-total-companies">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health?.totalRecords.companies.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      +{health?.growthMetrics.companiesThisWeek || 0} this week
                    </p>
                  </CardContent>
                </Card>
                <Card data-testid="card-data-quality-score">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Data Quality Score</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{health?.dataQuality.score || 0}%</div>
                    <Progress value={health?.dataQuality.score || 0} className="mt-2" />
                  </CardContent>
                </Card>
                <Card data-testid="card-matching-rate">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Matching Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {health && (
                      <>
                        <div className="text-2xl font-bold">
                          {health.totalRecords.contacts > 0
                            ? Math.round((health.matchingStatus.matched / health.totalRecords.contacts) * 100)
                            : 0}%
                        </div>
                        <div className="flex gap-2 mt-2 text-xs">
                          <span className="text-green-600">{health.matchingStatus.matched} matched</span>
                          <span className="text-yellow-600">{health.matchingStatus.pendingReview} pending</span>
                          <span className="text-red-600">{health.matchingStatus.unmatched} unmatched</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Card data-testid="card-recent-imports">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Imports (7 days)</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{health?.recentActivity.imports || 0}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-recent-enrichments">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Enrichments (7 days)</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{health?.recentActivity.enrichments || 0}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-recent-api-requests">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Requests (7 days)</CardTitle>
                  <FileSearch className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{health?.recentActivity.apiRequests || 0}</div>
                </CardContent>
              </Card>
            </div>

            <BulkOperationsPanel
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
              }}
            />

            <Tabs defaultValue="issues" className="space-y-4">
              <TabsList>
                <TabsTrigger value="issues" data-testid="tab-issues">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Data Quality Issues
                  {issues.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{issues.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="audit" data-testid="tab-audit">
                  <Clock className="h-4 w-4 mr-2" />
                  Audit Log
                </TabsTrigger>
                <TabsTrigger value="archive" data-testid="tab-archive">
                  <Archive className="h-4 w-4 mr-2" />
                  Archived Records
                </TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Data Quality Issues</CardTitle>
                        <CardDescription>Issues found during quality checks that need attention</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Select value={issueStatusFilter} onValueChange={setIssueStatusFilter}>
                          <SelectTrigger className="w-32" data-testid="select-issue-status">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="ignored">Ignored</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={issueSeverityFilter} onValueChange={setIssueSeverityFilter}>
                          <SelectTrigger className="w-32" data-testid="select-issue-severity">
                            <SelectValue placeholder="Severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {issuesLoading ? (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : issues.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No data quality issues found</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Severity</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Entity</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {issues.map((issue) => (
                              <TableRow key={issue.id} data-testid={`row-issue-${issue.id}`}>
                                <TableCell>
                                  <Badge variant={getSeverityColor(issue.severity) as any}>
                                    {issue.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{issue.issueType}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{issue.entityType}</Badge>
                                </TableCell>
                                <TableCell className="max-w-xs truncate">{issue.description}</TableCell>
                                <TableCell>{format(new Date(issue.createdAt), "MMM d, yyyy")}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => resolveIssueMutation.mutate(issue.id)}
                                      disabled={issue.status !== "open"}
                                      data-testid={`button-resolve-${issue.id}`}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => ignoreIssueMutation.mutate(issue.id)}
                                      disabled={issue.status !== "open"}
                                      data-testid={`button-ignore-${issue.id}`}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>Recent changes to your data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditLoading ? (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4" />
                        <p>No audit logs yet</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Operation</TableHead>
                              <TableHead>Entity</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Changed Fields</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditLogs.map((log) => (
                              <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                                <TableCell>
                                  <Badge variant={getOperationColor(log.operation) as any}>
                                    {log.operation}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{log.entityType}</Badge>
                                  <span className="ml-2 text-xs text-muted-foreground">{log.entityId.slice(0, 8)}...</span>
                                </TableCell>
                                <TableCell>{log.changeSource}</TableCell>
                                <TableCell>
                                  {log.changedFields?.slice(0, 3).join(", ")}
                                  {log.changedFields && log.changedFields.length > 3 && "..."}
                                </TableCell>
                                <TableCell>{format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="archive" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Archived Records</CardTitle>
                        <CardDescription>Deleted records retained for recovery (90 days)</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => cleanupArchivesMutation.mutate()}
                        disabled={cleanupArchivesMutation.isPending}
                        data-testid="button-cleanup-archives"
                      >
                        <RotateCcw className={`h-4 w-4 mr-2 ${cleanupArchivesMutation.isPending ? "animate-spin" : ""}`} />
                        Cleanup Expired
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {archiveLoading ? (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : archives.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Archive className="h-12 w-12 mx-auto mb-4" />
                        <p>No archived records</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Original ID</TableHead>
                              <TableHead>Deleted At</TableHead>
                              <TableHead>Expires At</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {archives.map((record) => (
                              <TableRow key={record.id} data-testid={`row-archive-${record.id}`}>
                                <TableCell>
                                  <Badge variant="outline">{record.entityType}</Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{record.originalId.slice(0, 12)}...</TableCell>
                                <TableCell>{format(new Date(record.deletedAt), "MMM d, yyyy")}</TableCell>
                                <TableCell>{format(new Date(record.expiresAt), "MMM d, yyyy")}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => restoreRecordMutation.mutate(record.id)}
                                    data-testid={`button-restore-${record.id}`}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Restore
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {health?.dataQuality.issuesByType && Object.keys(health.dataQuality.issuesByType).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Issues by Type</CardTitle>
                  <CardDescription>Distribution of open data quality issues</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(health.dataQuality.issuesByType).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{type.replace(/_/g, " ")}</span>
                        <Badge>{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
