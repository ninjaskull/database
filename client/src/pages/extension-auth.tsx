import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Database, CheckCircle, XCircle, Loader2 } from "lucide-react";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (extensionId: string, message: unknown, callback?: (response: unknown) => void) => void;
        lastError?: { message: string };
      };
    };
  }
}

export default function ExtensionAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const apiBaseUrl = window.location.origin;

    if (!token) {
      setStatus("error");
      setTimeout(() => {
        setLocation("/");
      }, 2000);
      return;
    }

    localStorage.setItem("extension_auth_token", token);
    localStorage.setItem("extension_api_base_url", apiBaseUrl);
    localStorage.setItem("extension_auth_timestamp", Date.now().toString());
    
    window.postMessage(
      {
        type: "CRM_EXTENSION_AUTH",
        token: token,
        apiBaseUrl: apiBaseUrl,
      },
      "*"
    );

    const sendMultipleTimes = () => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          window.postMessage(
            {
              type: "CRM_EXTENSION_AUTH",
              token: token,
              apiBaseUrl: apiBaseUrl,
            },
            "*"
          );
        }, i * 500);
      }
    };
    sendMultipleTimes();

    setStatus("success");
    
    setTimeout(() => {
      setLocation("/");
    }, 3000);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full mx-4">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Chrome Extension
          </h1>
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
            <p className="text-slate-600 dark:text-slate-400">
              Connecting to extension...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-medium text-green-600 dark:text-green-400">
                Successfully Connected!
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                You can now use the Chrome extension. Redirecting to dashboard...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <p className="text-lg font-medium text-red-600 dark:text-red-400">
                Authentication Required
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Please log in first, then try connecting the extension again.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
