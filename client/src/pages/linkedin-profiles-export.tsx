import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LinkedInProfilesExport() {
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["/api/contacts/linkedin-profiles"],
    queryFn: async () => {
      const response = await fetch("/api/contacts/linkedin-profiles", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch profiles");
      return response.json();
    },
  });

  const handleDownloadCSV = async () => {
    if (!profiles || profiles.length === 0) {
      alert("No LinkedIn profiles to download");
      return;
    }

    setIsDownloading(true);
    try {
      // Create CSV content
      const headers = [
        "Full Name",
        "Email",
        "Title",
        "Company",
        "LinkedIn URL",
        "City",
        "Country",
      ];

      const rows = profiles.map((contact: any) => [
        contact.fullName || "",
        contact.email || "",
        contact.title || "",
        contact.company || "",
        contact.personLinkedIn || "",
        contact.city || "",
        contact.country || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row: string[]) =>
          row
            .map((cell: string) => `"${cell.replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `linkedin-profiles-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download profiles");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  LinkedIn Profiles Export
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Download all contacts with LinkedIn profile links updated by Chrome extension
                </p>
              </div>

              {/* Info Card */}
              <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <AlertDescription className="text-blue-900 dark:text-blue-200">
                  This export includes all contacts that have LinkedIn profile URLs. These profiles were discovered and updated by the Chrome extension when browsing LinkedIn.
                </AlertDescription>
              </Alert>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isLoading ? "-" : profiles?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    LinkedIn Profiles Found
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isLoading ? "-" : (profiles?.length || 0) > 0 ? "Ready" : "No Data"}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Export Status
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    CSV
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Format Available
                  </div>
                </div>
              </div>

              {/* Download Section */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Export Options
                </h2>

                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600 dark:text-gray-400">
                        Loading profiles...
                      </span>
                    </div>
                  ) : profiles && profiles.length > 0 ? (
                    <>
                      <p className="text-gray-600 dark:text-gray-400">
                        Found {profiles.length} LinkedIn profiles. Download as CSV to use in your tools.
                      </p>
                      <Button
                        onClick={handleDownloadCSV}
                        disabled={isDownloading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                        data-testid="button-download-csv"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download CSV
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        No LinkedIn profiles found. Use the Chrome extension on LinkedIn to discover and save profiles.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Data Preview */}
                {profiles && profiles.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Preview ({Math.min(profiles.length, 5)} of {profiles.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-900 dark:text-white">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-gray-900 dark:text-white">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left text-gray-900 dark:text-white">
                              Title
                            </th>
                            <th className="px-4 py-2 text-left text-gray-900 dark:text-white">
                              LinkedIn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {profiles.slice(0, 5).map((contact: any) => (
                            <tr
                              key={contact.id}
                              className="border-b border-gray-200 dark:border-gray-700"
                            >
                              <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                                {contact.fullName}
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                {contact.email || "-"}
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                                {contact.title || "-"}
                              </td>
                              <td className="px-4 py-3">
                                {contact.personLinkedIn ? (
                                  <a
                                    href={contact.personLinkedIn}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 truncate"
                                    data-testid={`link-linkedin-${contact.id}`}
                                  >
                                    View Profile
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
