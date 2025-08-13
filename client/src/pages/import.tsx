import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ImportModal } from "@/components/import/import-modal";

export default function ImportPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Import Contacts</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Upload CSV files to import contact data</p>
              </div>

              <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                <ImportModal />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
