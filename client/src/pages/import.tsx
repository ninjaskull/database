import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SmartImportWizard } from "@/components/import/smart-import-wizard";

export default function ImportPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Smart Contact Import</h1>
                <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                  Intelligent CSV processing with automatic field mapping and data enrichment
                </p>
              </div>

              <SmartImportWizard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
