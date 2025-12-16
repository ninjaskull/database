import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Companies from "@/pages/companies";
import Prospects from "@/pages/prospects";
import ImportPage from "@/pages/import";
import SettingsPage from "@/pages/settings";
import Analytics from "@/pages/analytics";
import LinkedInSearch from "@/pages/linkedin-search";
import DatabaseManagement from "@/pages/database-management";
import ExtensionAuth from "@/pages/extension-auth";
import AIInsights from "@/pages/ai-insights";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const handleLoginSuccess = (user: any, token: string) => {
    setAuthToken(token);
    localStorage.setItem('authToken', token);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/companies" component={Companies} />
      <Route path="/prospects" component={Prospects} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/import" component={ImportPage} />
      <Route path="/linkedin-search" component={LinkedInSearch} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/ai-insights" component={AIInsights} />
      <Route path="/database" component={DatabaseManagement} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/extension-auth" component={ExtensionAuth} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
