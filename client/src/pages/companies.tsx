import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Company } from "@shared/schema";

export default function Companies() {
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
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
  const [importFile, setImportFile] = useState<File | null>(null);
  
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

  const importCompaniesMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/companies/bulk-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setShowImportDialog(false);
      setImportFile(null);
      toast({
        title: "Import complete",
        description: `Imported ${data.imported} companies. ${data.duplicates} duplicates skipped.`,
      });
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Failed to import companies. Check your file format.",
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

  const handleImport = () => {
    if (importFile) {
      importCompaniesMutation.mutate(importFile);
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
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Companies Database</h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Manage your company data. Prospects will be automatically matched to these companies.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" data-testid="button-import-companies">
                        <i className="fas fa-file-import mr-2"></i>
                        Import CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Companies</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-gray-500">
                          Upload a CSV file with company data. Required column: <strong>name</strong>. 
                          Optional columns: website, domain, industry, employees, city, state, country, description, technologies.
                        </p>
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          data-testid="input-company-file"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                        <Button 
                          onClick={handleImport} 
                          disabled={!importFile || importCompaniesMutation.isPending}
                          data-testid="button-confirm-import"
                        >
                          {importCompaniesMutation.isPending ? 'Importing...' : 'Import'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

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
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
