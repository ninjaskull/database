import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/contacts/stats-cards";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { FilterBar } from "@/components/contacts/filter-bar";
import { SmartImportWizard } from "@/components/import/smart-import-wizard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function Dashboard() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    industry: '',
    employeeSizeBracket: '',
    country: '',
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    industry: '',
    employeeSizeBracket: '',
    country: '',
    leadScore: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const handleExportContacts = () => {
    // Trigger download of the CSV export
    const link = document.createElement('a');
    link.href = '/api/export';
    link.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkEdit = () => {
    if (selectedContactIds.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select at least one contact to edit.",
        variant: "destructive",
      });
      return;
    }
    setShowBulkEditDialog(true);
  };

  const executeBulkUpdate = async () => {
    if (selectedContactIds.length === 0) return;
    
    setIsUpdating(true);
    try {
      // Filter out empty values and "keep-existing" selections
      const updateData = Object.fromEntries(
        Object.entries(bulkEditData).filter(([_, value]) => value && value !== '' && value !== 'keep-existing')
      );
      
      if (Object.keys(updateData).length === 0) {
        toast({
          title: "No changes to apply",
          description: "Please fill in at least one field to update.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/contacts/bulk-update', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          contactIds: selectedContactIds,
          updates: updateData
        })
      });

      if (response.ok) {
        toast({
          title: "Contacts updated successfully",
          description: `Updated ${selectedContactIds.length} contacts.`,
        });
        setShowBulkEditDialog(false);
        setSelectedContactIds([]);
        setBulkEditData({
          industry: '',
          employeeSizeBracket: '',
          country: '',
          leadScore: '',
        });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      } else {
        throw new Error('Failed to update contacts');
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
              {/* Page header */}
              <div className="mb-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Contact Database</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage and organize your contact information</p>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowImportDialog(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800"
                      data-testid="button-import-csv"
                    >
                      <i className="fas fa-upload mr-2"></i>
                      Import CSV
                    </button>
                    <button 
                      onClick={handleExportContacts}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      data-testid="button-export-csv"
                    >
                      <i className="fas fa-download mr-2"></i>
                      Export
                    </button>
                  </div>
                </div>
              </div>

              <StatsCards />
              
              <FilterBar 
                filters={filters}
                onFiltersChange={setFilters}
                selectedCount={selectedContactIds.length}
                onBulkEdit={handleBulkEdit}
                onBulkDelete={async () => {
                  if (selectedContactIds.length > 0 && confirm(`Delete ${selectedContactIds.length} contacts?`)) {
                    try {
                      const response = await fetch('/api/contacts', {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                        credentials: 'include',
                        body: JSON.stringify({ ids: selectedContactIds })
                      });
                      if (response.ok) {
                        setSelectedContactIds([]);
                        queryClient.invalidateQueries({ queryKey: ['contacts'] });
                        queryClient.invalidateQueries({ queryKey: ['stats'] });
                        toast({
                          title: "Contacts deleted",
                          description: `Successfully deleted ${selectedContactIds.length} contacts.`,
                        });
                      }
                    } catch (error) {
                      console.error('Bulk delete failed:', error);
                      toast({
                        title: "Delete failed",
                        description: "Failed to delete contacts. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }
                }}
              />
              
              <ContactsTable 
                filters={filters}
                selectedContactIds={selectedContactIds}
                onSelectionChange={setSelectedContactIds}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Import Contacts from CSV</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <SmartImportWizard />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Update {selectedContactIds.length} selected contacts. Leave fields empty to keep existing values.
            </p>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Update Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-industry" className="text-sm">Industry</Label>
                  <Select 
                    value={bulkEditData.industry} 
                    onValueChange={(value) => setBulkEditData(prev => ({ ...prev, industry: value }))}
                  >
                    <SelectTrigger id="bulk-industry">
                      <SelectValue placeholder="Select industry..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep-existing">Keep existing</SelectItem>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Consulting">Consulting</SelectItem>
                      <SelectItem value="Retail">Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-size" className="text-sm">Company Size</Label>
                  <Select 
                    value={bulkEditData.employeeSizeBracket} 
                    onValueChange={(value) => setBulkEditData(prev => ({ ...prev, employeeSizeBracket: value }))}
                  >
                    <SelectTrigger id="bulk-size">
                      <SelectValue placeholder="Select size bracket..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep-existing">Keep existing</SelectItem>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">201-1000 employees</SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-country" className="text-sm">Country</Label>
                  <Select 
                    value={bulkEditData.country} 
                    onValueChange={(value) => setBulkEditData(prev => ({ ...prev, country: value }))}
                  >
                    <SelectTrigger id="bulk-country">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep-existing">Keep existing</SelectItem>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Japan">Japan</SelectItem>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bulk-lead-score" className="text-sm">Lead Score</Label>
                  <Input
                    id="bulk-lead-score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Enter lead score (0-100)"
                    value={bulkEditData.leadScore}
                    onChange={(e) => setBulkEditData(prev => ({ ...prev, leadScore: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowBulkEditDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={executeBulkUpdate}
                disabled={isUpdating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  `Update ${selectedContactIds.length} Contacts`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
