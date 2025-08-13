import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatsCards } from "@/components/contacts/stats-cards";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { FilterBar } from "@/components/contacts/filter-bar";
import { useState } from "react";

export default function Dashboard() {
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
              {/* Page header */}
              <div className="mb-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Contact Database</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage and organize your contact information</p>
                  </div>
                  <div className="flex space-x-3">
                    <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800">
                      <i className="fas fa-upload mr-2"></i>
                      Import CSV
                    </button>
                    <button className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
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
                onBulkEdit={() => {}}
                onBulkDelete={() => {}}
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
