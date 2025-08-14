import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Calendar, Users, Building2, Mail, Phone, Globe, MapPin, TrendingUp, Activity, Database, Upload, Shield } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

export default function Analytics() {
  // Fetch comprehensive analytics data
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics/comprehensive'],
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/analytics/trends'],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['/api/analytics/activities'],
  });

  const { data: imports, isLoading: importsLoading } = useQuery({
    queryKey: ['/api/analytics/imports'],
  });

  // Provide safe defaults
  const safeAnalytics = analytics || {};
  const safeTrends = trends || {};
  const safeActivities = activities || {};
  const safeImports = imports || {};

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          <Activity className="w-4 h-4 mr-1" />
          Real-time Data
        </Badge>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contacts</p>
                <p className="text-2xl font-bold">{safeAnalytics.totalContacts?.toLocaleString() || 0}</p>
                <p className="text-xs text-green-600">+{safeAnalytics.contactGrowth || 0}% this month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Companies</p>
                <p className="text-2xl font-bold">{safeAnalytics.totalCompanies?.toLocaleString() || 0}</p>
                <p className="text-xs text-blue-600">{safeAnalytics.uniqueIndustries || 0} industries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email Coverage</p>
                <p className="text-2xl font-bold">{Math.round(((safeAnalytics.validEmails || 0) / (safeAnalytics.totalContacts || 1)) * 100)}%</p>
                <p className="text-xs text-gray-600">{safeAnalytics.validEmails?.toLocaleString() || 0} valid emails</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Lead Score</p>
                <p className="text-2xl font-bold">{safeAnalytics.averageLeadScore?.toFixed(1) || '0.0'}</p>
                <p className="text-xs text-green-600">Quality: {safeAnalytics.leadQualityDistribution?.high || 0}% high</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="data-quality">Data Quality</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Growth Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Contact Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={safeTrends.contactGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="new" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Lead Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Lead Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={safeAnalytics.leadScoreDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Contact Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {safeAnalytics.contactSources?.map((source: any, index: number) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm">{source.source}</span>
                      </div>
                      <span className="font-medium">{source.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Communication Channels */}
            <Card>
              <CardHeader>
                <CardTitle>Communication Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Email</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{safeAnalytics.communicationChannels?.email || 0}</p>
                      <Progress value={((safeAnalytics.communicationChannels?.email || 0) / (safeAnalytics.totalContacts || 1)) * 100} className="w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Phone</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{safeAnalytics.communicationChannels?.phone || 0}</p>
                      <Progress value={((safeAnalytics.communicationChannels?.phone || 0) / (safeAnalytics.totalContacts || 1)) * 100} className="w-20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">LinkedIn</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{safeAnalytics.communicationChannels?.linkedin || 0}</p>
                      <Progress value={((safeAnalytics.communicationChannels?.linkedin || 0) / (safeAnalytics.totalContacts || 1)) * 100} className="w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Technologies */}
            <Card>
              <CardHeader>
                <CardTitle>Top Technologies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {safeAnalytics.topTechnologies?.slice(0, 8).map((tech: any) => (
                    <div key={tech.technology} className="flex items-center justify-between">
                      <span className="text-sm truncate">{tech.technology}</span>
                      <Badge variant="secondary">{tech.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Countries Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Geographic Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={safeAnalytics.geographicDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(safeAnalytics.geographicDistribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Regional Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Regional Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {safeAnalytics.regionalBreakdown?.map((region: any) => (
                    <div key={region.region} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{region.region}</span>
                        <span className="text-sm text-gray-600">{region.count} contacts</span>
                      </div>
                      <Progress value={(region.count / (safeAnalytics.totalContacts || 1)) * 100} />
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                        <span>Avg Score: {region.avgLeadScore?.toFixed(1) || 'N/A'}</span>
                        <span>Companies: {region.companies || 0}</span>
                        <span>Industries: {region.industries || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Industry Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  Industry Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={safeAnalytics.industryDistribution || []} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="industry" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Company Size Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Company Size Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={safeAnalytics.companySizeDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(safeAnalytics.companySizeDistribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Companies */}
          <Card>
            <CardHeader>
              <CardTitle>Top Companies by Contact Count</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {safeAnalytics.topCompanies?.map((company: any, index: number) => (
                  <div key={company.company} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium">{company.company || 'Unknown Company'}</p>
                      <p className="text-sm text-gray-600">{company.industry || 'Unknown Industry'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{company.count}</p>
                      <p className="text-xs text-gray-600">contacts</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-quality" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Data Completeness Metrics */}
            {Object.entries(safeAnalytics.dataCompleteness || {}).map(([field, percentage]) => (
              <Card key={field}>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-sm text-gray-600">{percentage}%</span>
                    </div>
                    <Progress value={percentage as number} />
                    <p className="text-xs text-gray-600">
                      {Math.round(((percentage as number) / 100) * (safeAnalytics.totalContacts || 0))} contacts
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Data Quality Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Overall Data Quality Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{safeAnalytics.dataQualityScore?.toFixed(1) || '0'}%</span>
                  <Badge variant={
                    (safeAnalytics.dataQualityScore || 0) >= 80 ? 'default' :
                    (safeAnalytics.dataQualityScore || 0) >= 60 ? 'secondary' : 'destructive'
                  }>
                    {(safeAnalytics.dataQualityScore || 0) >= 80 ? 'Excellent' :
                     (safeAnalytics.dataQualityScore || 0) >= 60 ? 'Good' : 'Needs Improvement'}
                  </Badge>
                </div>
                <Progress value={safeAnalytics.dataQualityScore || 0} />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Complete Profiles</p>
                    <p className="text-gray-600">{safeAnalytics.completeProfiles || 0}</p>
                  </div>
                  <div>
                    <p className="font-medium">Missing Critical Data</p>
                    <p className="text-gray-600">{safeAnalytics.missingCriticalData || 0}</p>
                  </div>
                  <div>
                    <p className="font-medium">Enriched Contacts</p>
                    <p className="text-gray-600">{safeAnalytics.enrichedContacts || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={safeActivities.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="created" stroke="#8884d8" />
                    <Line type="monotone" dataKey="updated" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="enriched" stroke="#ffc658" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {safeActivities.summary?.map((activity: any) => (
                    <div key={activity.type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="capitalize">{activity.type.replace('_', ' ')}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{activity.count}</p>
                        <p className="text-xs text-gray-600">last 30 days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activities List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeActivities.recent?.map((activity: any) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{activity.activityType}</Badge>
                      <div>
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-gray-600">{new Date(activity.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Imports</p>
                    <p className="text-2xl font-bold">{safeImports.summary?.totalImports || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Database className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                    <p className="text-2xl font-bold">{safeImports.summary?.successRate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Records Imported</p>
                    <p className="text-2xl font-bold">{safeImports.summary?.totalRecords?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Import History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {safeImports.history?.map((importJob: any) => (
                  <div key={importJob.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium">{importJob.filename}</p>
                      <p className="text-sm text-gray-600">{new Date(importJob.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={
                        importJob.status === 'completed' ? 'default' :
                        importJob.status === 'processing' ? 'secondary' : 'destructive'
                      }>
                        {importJob.status}
                      </Badge>
                      <div className="text-right text-sm">
                        <p>{importJob.successfulRows || 0} successful</p>
                        <p className="text-gray-600">{importJob.totalRows || 0} total</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}