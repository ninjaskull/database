import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FilterBarProps {
  filters: {
    search: string;
    industry: string;
    employeeSizeBracket: string;
    country: string;
  };
  onFiltersChange: (filters: any) => void;
  selectedCount: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
}

export function FilterBar({ filters, onFiltersChange, selectedCount, onBulkEdit, onBulkDelete }: FilterBarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateFilter = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const bulkAutoFillMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/contacts/bulk-autofill', {
        method: 'POST'
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Bulk auto-fill completed!",
        description: `Updated ${result.updated} contacts across ${result.companiesProcessed.length} companies: ${result.companiesProcessed.join(', ')}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Auto-fill failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  });

  return (
    <Card className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
      <CardContent className="px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Search Input */}
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Search contacts..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                data-testid="input-search"
              />
            </div>
            
            {/* Industry Filter */}
            <Select value={filters.industry} onValueChange={(value) => updateFilter('industry', value)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
              </SelectContent>
            </Select>

            {/* Company Size Filter */}
            <Select value={filters.employeeSizeBracket} onValueChange={(value) => updateFilter('employeeSizeBracket', value)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="1-10">1-10 employees</SelectItem>
                <SelectItem value="11-50">11-50 employees</SelectItem>
                <SelectItem value="51-200">51-200 employees</SelectItem>
                <SelectItem value="200+">200+ employees</SelectItem>
              </SelectContent>
            </Select>

            {/* Country Filter */}
            <Select value={filters.country} onValueChange={(value) => updateFilter('country', value)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
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

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {/* Bulk Auto-fill Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => bulkAutoFillMutation.mutate()}
              disabled={bulkAutoFillMutation.isPending}
              className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              data-testid="button-bulk-autofill"
            >
              <Building2 className="w-4 h-4 mr-1" />
              {bulkAutoFillMutation.isPending ? 'Auto-filling...' : 'Auto-fill Companies'}
            </Button>
            
            {/* Bulk Actions for selected contacts */}
            {selectedCount > 0 && (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-400">{selectedCount} selected</span>
                <Button variant="outline" size="sm" onClick={onBulkEdit}>
                  <i className="fas fa-edit mr-1"></i>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={onBulkDelete} className="text-red-600 border-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-400 dark:hover:bg-red-900/20">
                  <i className="fas fa-trash mr-1"></i>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
