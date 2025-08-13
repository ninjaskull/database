import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { FilterBar } from "@/components/contacts/filter-bar";
import { useState } from "react";

export default function Contacts() {
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    industry: '',
    employeeSizeBracket: '',
    country: '',
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">All Contacts</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Complete list of your contacts</p>
              </div>

              <FilterBar 
                filters={filters}
                onFiltersChange={setFilters}
                selectedCount={selectedContactIds.length}
                onBulkEdit={() => {
                  console.log('Bulk edit clicked for:', selectedContactIds);
                }}
                onBulkDelete={async () => {
                  if (selectedContactIds.length > 0 && confirm(`Delete ${selectedContactIds.length} contacts?`)) {
                    try {
                      const response = await fetch('/api/contacts', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: selectedContactIds })
                      });
                      if (response.ok) {
                        setSelectedContactIds([]);
                        window.location.reload();
                      }
                    } catch (error) {
                      console.error('Bulk delete failed:', error);
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
    </div>
  );
}
