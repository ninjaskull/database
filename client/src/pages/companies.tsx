import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Company } from "@shared/schema";
import { CompanyImportWizard } from "@/components/import/company-import-wizard";
import { Upload, Building2, Download, AlertTriangle, Globe } from "lucide-react";

interface MissingDomain {
  domain: string;
  contactCount: number;
}

export default function Companies() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('companies');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    website: '',
    domains: '',
    industry: '',
    employees: '',
    employeeSizeBracket: '',
    city: '',
    state: '',
    country: '',
    description: '',
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companiesData, isLoading } = useQuery<{ companies: Company[], total: number }>({
    queryKey: ['/api/companies', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const url = `/api/companies${params.toString() ? `?${params.toString()}` : ''}`;
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(url, { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
  });

  const { data: missingDomainsData, isLoading: isLoadingMissing } = useQuery<{ domains: MissingDomain[], total: number }>({
    queryKey: ['/api/companies/missing-domains'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch('/api/companies/missing-domains', { credentials: 'include', headers });
      if (!response.ok) throw new Error('Failed to fetch missing domains');
      return response.json();
    },
    enabled: activeTab === 'missing-domains',
  });

  const handleExportMissingDomains = () => {
    if (!missingDomainsData?.domains?.length) {
      toast({
        title: "No data to export",
        description: "There are no missing domains to export.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ['Domain', 'Contact Count'].join(','),
      ...missingDomainsData.domains.map(d => [d.domain, d.contactCount].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-company-domains-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `Exported ${missingDomainsData.domains.length} domains to CSV.`,
    });
  };

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/companies', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setShowAddDialog(false);
      setNewCompany({
        name: '',
        website: '',
        domains: '',
        industry: '',
        employees: '',
        employeeSizeBracket: '',
        city: '',
        state: '',
        country: '',
        description: '',
      });
      toast({
        title: "Company added",
        description: "The company has been added to your database.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add company.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCompany = () => {
    const companyData = {
      name: newCompany.name,
      website: newCompany.website || null,
      domains: newCompany.domains ? newCompany.domains.split(',').map(d => d.trim()) : [],
      industry: newCompany.industry || null,
      employees: newCompany.employees ? parseInt(newCompany.employees) : null,
      employeeSizeBracket: newCompany.employeeSizeBracket || null,
      city: newCompany.city || null,
      state: newCompany.state || null,
      country: newCompany.country || null,
      description: newCompany.description || null,
    };
    createCompanyMutation.mutate(companyData);
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
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Companies Database</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Manage your company data. Prospects will be automatically matched to these companies.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowImportWizard(true)}
                    data-testid="button-import-companies"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Smart Import
                  </Button>

                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-company">
                        <i className="fas fa-plus mr-2"></i>
                        Add Company
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Company</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <div>
                          <Label>Company Name *</Label>
                          <Input
                            value={newCompany.name}
                            onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                            placeholder="Acme Inc."
                            data-testid="input-company-name"
                          />
                        </div>
                        <div>
                          <Label>Website</Label>
                          <Input
                            value={newCompany.website}
                            onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                            placeholder="https://acme.com"
                            data-testid="input-company-website"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Email Domains (comma-separated)</Label>
                          <Input
                            value={newCompany.domains}
                            onChange={(e) => setNewCompany({ ...newCompany, domains: e.target.value })}
                            placeholder="acme.com, acme.io"
                            data-testid="input-company-domains"
                          />
                          <p className="text-xs text-gray-500 mt-1">Used to automatically match prospects by email domain</p>
                        </div>
                        <div>
                          <Label>Industry</Label>
                          <Input
                            value={newCompany.industry}
                            onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                            placeholder="Technology"
                            data-testid="input-company-industry"
                          />
                        </div>
                        <div>
                          <Label>Employee Count</Label>
                          <Input
                            type="number"
                            value={newCompany.employees}
                            onChange={(e) => setNewCompany({ ...newCompany, employees: e.target.value })}
                            placeholder="500"
                            data-testid="input-company-employees"
                          />
                        </div>
                        <div>
                          <Label>City</Label>
                          <Input
                            value={newCompany.city}
                            onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })}
                            placeholder="San Francisco"
                            data-testid="input-company-city"
                          />
                        </div>
                        <div>
                          <Label>Country</Label>
                          <Input
                            value={newCompany.country}
                            onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                            placeholder="USA"
                            data-testid="input-company-country"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={newCompany.description}
                            onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                            placeholder="Brief description of the company"
                            data-testid="input-company-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                        <Button 
                          onClick={handleCreateCompany} 
                          disabled={!newCompany.name || createCompanyMutation.isPending}
                          data-testid="button-save-company"
                        >
                          {createCompanyMutation.isPending ? 'Saving...' : 'Save Company'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList>
                  <TabsTrigger value="companies" className="flex items-center gap-2" data-testid="tab-companies">
                    <Building2 className="h-4 w-4" />
                    Companies
                    {companiesData?.total ? (
                      <Badge variant="secondary" className="ml-1">{companiesData.total}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="missing-domains" className="flex items-center gap-2" data-testid="tab-missing-domains">
                    <AlertTriangle className="h-4 w-4" />
                    Missing Domains
                    {missingDomainsData?.total ? (
                      <Badge variant="destructive" className="ml-1">{missingDomainsData.total}</Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="companies">
                  <Card className="mb-6">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <Input
                          placeholder="Search companies..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="max-w-sm"
                          data-testid="input-search-companies"
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="text-center py-8">Loading...</div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Company</TableHead>
                              <TableHead>Website</TableHead>
                              <TableHead>Domains</TableHead>
                              <TableHead>Industry</TableHead>
                              <TableHead>Employees</TableHead>
                              <TableHead>Location</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {companiesData?.companies?.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                  No companies found. Add your first company or import from CSV.
                                </TableCell>
                              </TableRow>
                            ) : (
                              companiesData?.companies?.map((company) => (
                                <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                                  <TableCell className="font-medium">{company.name}</TableCell>
                                  <TableCell>
                                    {company.website && (
                                      <a 
                                        href={company.website} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {company.website.replace(/^https?:\/\//, '')}
                                      </a>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {company.domains?.map((domain, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {domain}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell>{company.industry || '-'}</TableCell>
                                  <TableCell>{company.employees?.toLocaleString() || '-'}</TableCell>
                                  <TableCell>
                                    {[company.city, company.country].filter(Boolean).join(', ') || '-'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>How Company Matching Works</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <p><strong>1. Upload your company database</strong> - Add companies with their email domains (e.g., acme.com).</p>
                      <p><strong>2. Add prospects</strong> - When you add a prospect with an email like john@acme.com, the system automatically extracts the domain.</p>
                      <p><strong>3. Auto-matching</strong> - If the domain matches a company in your database, all company details are automatically filled in.</p>
                      <p><strong>4. Review unmatched</strong> - Prospects that couldn't be matched appear in the review queue for manual assignment.</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="missing-domains">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5" />
                            Missing Company Domains
                          </CardTitle>
                          <CardDescription className="mt-2">
                            These domains appear in your contacts but have no matching company data. 
                            Download this list to enrich your company database.
                          </CardDescription>
                        </div>
                        <Button 
                          onClick={handleExportMissingDomains}
                          disabled={!missingDomainsData?.domains?.length}
                          data-testid="button-export-missing-domains"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingMissing ? (
                        <div className="text-center py-8" data-testid="loading-missing-domains">Loading...</div>
                      ) : !missingDomainsData?.domains ? (
                        <div className="text-center py-12 text-red-500" data-testid="error-missing-domains">
                          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                          <p className="text-lg font-medium">Failed to load missing domains</p>
                          <p className="text-sm mt-2">Please try refreshing the page.</p>
                        </div>
                      ) : missingDomainsData.domains.length === 0 ? (
                        <div className="text-center py-12 text-gray-500" data-testid="empty-missing-domains">
                          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">All domains are matched!</p>
                          <p className="text-sm mt-2">All email domains in your contacts have corresponding company data.</p>
                        </div>
                      ) : (
                        <div className="max-h-[500px] overflow-auto" data-testid="table-missing-domains">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Domain</TableHead>
                                <TableHead className="text-right">Contacts</TableHead>
                                <TableHead>Priority</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {missingDomainsData.domains.map((item, idx) => (
                                <TableRow key={item.domain} data-testid={`row-missing-domain-${idx}`}>
                                  <TableCell className="font-mono" data-testid={`text-domain-${idx}`}>{item.domain}</TableCell>
                                  <TableCell className="text-right" data-testid={`text-contact-count-${idx}`}>{item.contactCount}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={item.contactCount >= 10 ? "destructive" : item.contactCount >= 5 ? "default" : "secondary"}
                                      data-testid={`badge-priority-${idx}`}
                                    >
                                      {item.contactCount >= 10 ? "High" : item.contactCount >= 5 ? "Medium" : "Low"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>How to Use Missing Domains</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <p><strong>1. Export the list</strong> - Download the CSV with all missing domains and their contact counts.</p>
                      <p><strong>2. Enrich the data</strong> - Use a data enrichment service or manually research company information for each domain.</p>
                      <p><strong>3. Import companies</strong> - Use the Smart Import feature to upload your enriched company data.</p>
                      <p><strong>4. Auto-match</strong> - Once companies are imported, your contacts will automatically link to the matching company records.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      <CompanyImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onImportComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
          queryClient.invalidateQueries({ queryKey: ['/api/companies/missing-domains'] });
          toast({
            title: "Import complete",
            description: "Companies have been imported successfully.",
          });
        }}
      />
    </div>
  );
}
