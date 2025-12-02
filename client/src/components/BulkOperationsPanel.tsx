import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  useBulkOperationProgress, 
  getOperationDisplayName,
  type BulkOperationType 
} from "@/lib/ws-bulk-operations";
import { 
  Link, 
  Wand2, 
  Trash2, 
  Upload, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  Building2,
  User,
  ArrowRight,
  AlertCircle,
  Activity
} from "lucide-react";
import { format } from "date-fns";

interface BulkOperationsPanelProps {
  onComplete?: () => void;
}

export function BulkOperationsPanel({ onComplete }: BulkOperationsPanelProps) {
  const { toast } = useToast();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<BulkOperationType | null>(null);

  const progress = useBulkOperationProgress({
    jobId: activeJobId,
    onProgress: (event) => {
      console.log("📊 Bulk operation progress:", event);
    },
    onComplete: (event) => {
      toast({
        title: "Operation Complete",
        description: event.message || "The bulk operation completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/database/health"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onComplete?.();
    },
    onError: (event) => {
      toast({
        title: "Operation Failed",
        description: event.message || "The bulk operation failed.",
        variant: "destructive",
      });
    },
  });

  const startBulkMatch = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/bulk/match", { method: "POST" });
      return response;
    },
    onSuccess: (data: any) => {
      setActiveJobId(data.jobId);
      setActiveOperation('bulk-match');
      toast({
        title: "Starting Match Operation",
        description: "Matching contacts to companies...",
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

  const startBulkAutofill = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/bulk/autofill", { method: "POST" });
      return response;
    },
    onSuccess: (data: any) => {
      setActiveJobId(data.jobId);
      setActiveOperation('bulk-autofill');
      toast({
        title: "Starting Auto-fill Operation",
        description: "Filling in company details...",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start bulk auto-fill operation",
        variant: "destructive",
      });
    },
  });

  const isRunning = progress.status === 'running' || progress.status === 'queued';
  const isComplete = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  const resetOperation = () => {
    setActiveJobId(null);
    setActiveOperation(null);
  };

  const getStatusIcon = () => {
    if (isRunning) return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    if (isComplete) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (isFailed) return <XCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-gray-400" />;
  };

  const getStatusBadge = () => {
    if (isRunning) return <Badge variant="default" className="bg-blue-500">Running</Badge>;
    if (isComplete) return <Badge variant="default" className="bg-green-500">Completed</Badge>;
    if (isFailed) return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">Idle</Badge>;
  };

  return (
    <Card className="w-full" data-testid="card-bulk-operations">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Bulk Operations
            </CardTitle>
            <CardDescription>
              Run batch operations on your contacts and companies
            </CardDescription>
          </div>
          {activeJobId && getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeJobId && (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => startBulkMatch.mutate()}
              disabled={startBulkMatch.isPending}
              data-testid="button-start-bulk-match"
            >
              <Link className="h-6 w-6" />
              <span className="font-medium">Match Companies</span>
              <span className="text-xs text-muted-foreground">Link contacts to companies</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => startBulkAutofill.mutate()}
              disabled={startBulkAutofill.isPending}
              data-testid="button-start-bulk-autofill"
            >
              <Wand2 className="h-6 w-6" />
              <span className="font-medium">Auto-fill Details</span>
              <span className="text-xs text-muted-foreground">Fill missing company data</span>
            </Button>
          </div>
        )}

        {activeJobId && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <p className="font-medium">
                    {getOperationDisplayName(activeOperation || progress.operationType)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {progress.message || 'Processing...'}
                  </p>
                </div>
              </div>
              {(isComplete || isFailed) && (
                <Button variant="outline" size="sm" onClick={resetOperation} data-testid="button-reset-operation">
                  New Operation
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{progress.percentComplete}%</span>
              </div>
              <Progress value={progress.percentComplete} className="h-2" data-testid="progress-bar" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.processed} of {progress.total} processed</span>
                <span>
                  {isRunning && progress.current?.name && (
                    <>Processing: {progress.current.name}</>
                  )}
                </span>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="space-y-1" data-testid="stat-success">
                <div className="text-2xl font-bold text-green-600">{progress.success}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
              <div className="space-y-1" data-testid="stat-matched">
                <div className="text-2xl font-bold text-blue-600">{progress.matched}</div>
                <div className="text-xs text-muted-foreground">Matched</div>
              </div>
              <div className="space-y-1" data-testid="stat-skipped">
                <div className="text-2xl font-bold text-yellow-600">{progress.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="space-y-1" data-testid="stat-failed">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {progress.current && isRunning && (
              <>
                <Separator />
                <div className="bg-muted/50 rounded-lg p-3 space-y-2" data-testid="current-item">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" />
                    <span>Currently Processing</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    <p className="font-medium">{progress.current.name}</p>
                    {progress.current.step && (
                      <p className="text-xs text-muted-foreground">{progress.current.step}</p>
                    )}
                    {progress.current.companyMatched && (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Building2 className="h-3 w-3" />
                        <ArrowRight className="h-3 w-3" />
                        <span>{progress.current.companyMatched}</span>
                      </div>
                    )}
                    {progress.current.fieldsFilled && progress.current.fieldsFilled.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {progress.current.fieldsFilled.map((field, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {progress.activity.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="h-4 w-4" />
                    <span>Activity Log</span>
                    <Badge variant="outline" className="ml-auto">
                      {progress.activity.length} entries
                    </Badge>
                  </div>
                  <ScrollArea className="h-[150px] rounded-lg border p-2" data-testid="activity-log">
                    <div className="space-y-2">
                      {[...progress.activity].reverse().slice(0, 50).map((entry, idx) => (
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

            {progress.errors.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Errors ({progress.errors.length})</span>
                  </div>
                  <ScrollArea className="h-[100px] rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 p-2" data-testid="error-log">
                    <div className="space-y-1">
                      {progress.errors.slice(0, 20).map((err, idx) => (
                        <div key={idx} className="text-xs text-red-600">
                          <span className="font-medium">{err.itemName}:</span> {err.error}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
