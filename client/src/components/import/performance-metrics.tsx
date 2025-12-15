/**
 * Performance Metrics Dashboard for Ultra-Fast Import System
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, Clock, Database, Users, TrendingUp, CheckCircle } from "lucide-react";

interface PerformanceMetricsProps {
  importJob?: {
    totalRows: number | null;
    processedRows: number | null;
    successfulRows: number | null;
    errorRows: number | null;
    duplicateRows: number | null;
    status: string;
    createdAt?: Date | null;
    completedAt?: Date | null;
  };
  estimatedTime?: number;
  actualTime?: number;
}

export function PerformanceMetrics({ importJob, estimatedTime, actualTime }: PerformanceMetricsProps) {
  const progressPercentage = importJob?.totalRows && importJob?.processedRows !== null ? 
    Math.round((importJob.processedRows / importJob.totalRows) * 100) : 0;

  const processingSpeed = importJob && actualTime && importJob.processedRows !== null ? 
    Math.round(importJob.processedRows / actualTime) : 0;

  const successRate = importJob?.processedRows && importJob?.successfulRows !== null ? 
    Math.round((importJob.successfulRows / importJob.processedRows) * 100) : 0;

  const isComplete = importJob?.status === 'completed';
  const isProcessing = importJob?.status === 'processing';

  return (
    <div className="space-y-4">
      {/* Main Progress Card */}
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Zap className="h-5 w-5 text-blue-500" />
              <span>Ultra-Fast Import Engine</span>
            </CardTitle>
            <Badge variant={
              isComplete ? "default" : 
              isProcessing ? "secondary" : 
              "outline"
            } className="text-xs">
              {isComplete ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </>
              ) : isProcessing ? (
                <>
                  <Clock className="h-3 w-3 mr-1 animate-spin" />
                  Processing
                </>
              ) : "Ready"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {importJob && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Progress: {(importJob.processedRows ?? 0).toLocaleString()} / {(importJob.totalRows ?? 0).toLocaleString()}</span>
                  <span>{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
              </div>
              
              {actualTime && (
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  ⚡ Processing at {processingSpeed.toLocaleString()} rows/second
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Processing Speed */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Speed</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {processingSpeed.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">rows/sec</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {successRate}%
                </p>
                <p className="text-xs text-gray-500">
                  {(importJob?.successfulRows ?? 0).toLocaleString()} created
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        {/* Database Operations */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {(importJob?.duplicateRows ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">detected</p>
              </div>
              <Database className="h-8 w-8 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        {/* Time Performance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Time</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {actualTime ? `${actualTime}s` : estimatedTime ? `~${estimatedTime}s` : '--'}
                </p>
                <p className="text-xs text-gray-500">
                  {actualTime ? 'actual' : 'estimated'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technology Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced Technologies Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Badge variant="outline" className="justify-center py-2">
              🚀 Streaming Parser
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              ⚡ Bulk Operations  
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              🧠 NLP Field Mapping
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              🔄 Parallel Processing
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              📊 Real-time Progress
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              🎯 Smart Batching
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              💾 Memory Optimization
            </Badge>
            <Badge variant="outline" className="justify-center py-2">
              🔍 Duplicate Detection
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Performance Benefits */}
      {isComplete && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-base text-green-700 dark:text-green-300">
              ✅ Performance Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Advanced streaming processing</span>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Memory-efficient bulk operations</span>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Optimized
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Intelligent field auto-mapping</span>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  NLP Powered
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Real-time progress tracking</span>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Live Updates
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}