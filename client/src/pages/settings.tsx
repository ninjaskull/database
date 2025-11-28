import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  User, Settings, Bell, Shield, Database, Download, Upload, 
  Trash2, RefreshCw, Eye, EyeOff, Save, AlertTriangle,
  Mail, Phone, Globe, Clock, Palette, Monitor, Sun, Moon,
  Key, Copy, Plus, Check, XCircle
} from "lucide-react";

// Settings schemas
const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  timezone: z.string(),
  language: z.string(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  weeklyReports: z.boolean(),
  importAlerts: z.boolean(),
  systemUpdates: z.boolean(),
});

const systemSchema = z.object({
  autoBackup: z.boolean(),
  dataRetention: z.string(),
  exportFormat: z.string(),
  defaultView: z.string(),
  recordsPerPage: z.string(),
  autoSave: z.boolean(),
});

const appearanceSchema = z.object({
  theme: z.string(),
  compactMode: z.boolean(),
  showAvatars: z.boolean(),
  fontSize: z.string(),
  sidebar: z.string(),
});

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;
type NotificationData = z.infer<typeof notificationSchema>;
type SystemData = z.infer<typeof systemSchema>;
type AppearanceData = z.infer<typeof appearanceSchema>;

interface ApiKeyResponse {
  id: string;
  label: string;
  scopes: string[] | null;
  rateLimitPerMinute: number | null;
  requestCount: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [showPassword, setShowPassword] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Profile form
  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      timezone: "UTC",
      language: "en",
    },
  });

  // Update form values when user data changes
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        name: (user as any)?.name || "",
        email: (user as any)?.email || "",
        phone: "",
        timezone: "UTC", 
        language: "en",
      });
    }
  }, [user, profileForm]);

  // Password form
  const passwordForm = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Notification form
  const notificationForm = useForm<NotificationData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      weeklyReports: true,
      importAlerts: true,
      systemUpdates: false,
    },
  });

  // System form
  const systemForm = useForm<SystemData>({
    resolver: zodResolver(systemSchema),
    defaultValues: {
      autoBackup: true,
      dataRetention: "365",
      exportFormat: "csv",
      defaultView: "table",
      recordsPerPage: "20",
      autoSave: true,
    },
  });

  // Appearance form
  const appearanceForm = useForm<AppearanceData>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      theme: "system",
      compactMode: false,
      showAvatars: true,
      fontSize: "medium",
      sidebar: "expanded",
    },
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      return await apiRequest("/api/settings/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({ title: "Profile updated successfully" });
      // Update the form with the new data
      if (response.user) {
        profileForm.reset({
          name: response.user.name || "",
          email: response.user.email || "",
          phone: profileForm.getValues("phone"),
          timezone: profileForm.getValues("timezone"),
          language: profileForm.getValues("language"),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      console.error('Profile update error:', error);
      toast({
        title: "Failed to update profile",
        description: "Please try again later",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordData) => {
      return await apiRequest("/api/settings/password", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message.includes("Current password is incorrect") 
        ? "Current password is incorrect" 
        : "Failed to update password";
      toast({
        title: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: async (data: NotificationData) => {
      return await apiRequest("/api/settings/notifications", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Notification preferences updated" });
    },
  });

  const updateSystemMutation = useMutation({
    mutationFn: async (data: SystemData) => {
      return await apiRequest("/api/settings/system", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "System settings updated" });
    },
  });

  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: AppearanceData) => {
      return await apiRequest("/api/settings/appearance", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Appearance settings updated" });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await fetch("/api/export/all", {
        credentials: "include",
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crm-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Data exported successfully" });
    },
    onError: (error) => {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Please try again later",
        variant: "destructive",
      });
    },
  });

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      localStorage.clear();
      queryClient.clear();
    },
    onSuccess: () => {
      toast({ title: "Cache cleared successfully" });
    },
  });

  // API Keys query - only fetch when on API Keys tab
  const { data: apiKeysData, isLoading: apiKeysLoading, error: apiKeysError, refetch: refetchApiKeys } = useQuery<{ success: boolean; keys: ApiKeyResponse[] }>({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      return await apiRequest("/api/api-keys");
    },
    enabled: activeTab === "api-keys",
    staleTime: 0,
    retry: 1,
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (label: string) => {
      return await apiRequest("/api/api-keys", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
    },
    onSuccess: (response) => {
      setNewlyCreatedKey(response.key);
      setNewKeyLabel("");
      toast({ title: "API key created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
    onError: () => {
      toast({
        title: "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  // Revoke API key mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({ title: "API key revoked successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
    onError: () => {
      toast({
        title: "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const copyApiKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast({ title: "API key copied to clipboard" });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        await apiRequest("/api/settings/delete-account", {
          method: "DELETE",
        });
        toast({ title: "Account deletion initiated" });
        // Redirect to login
        window.location.href = "/";
      } catch (error) {
        toast({
          title: "Failed to delete account",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900" data-testid="settings-page">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <Settings className="mr-3 h-8 w-8" />
                Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your account, preferences, and system settings
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-6 lg:w-fit">
                <TabsTrigger value="profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center">
                  <Database className="mr-2 h-4 w-4" />
                  System
                </TabsTrigger>
                <TabsTrigger value="appearance" className="flex items-center">
                  <Palette className="mr-2 h-4 w-4" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="api-keys" className="flex items-center">
                  <Key className="mr-2 h-4 w-4" />
                  API Keys
                </TabsTrigger>
              </TabsList>

              {/* Profile Settings */}
              <TabsContent value="profile" className="space-y-6">
                <Card data-testid="profile-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="mr-2 h-5 w-5" />
                      Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...profileForm}>
                      <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={profileForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" data-testid="input-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" placeholder="+1 (555) 123-4567" data-testid="input-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={profileForm.control}
                            name="timezone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Timezone</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-timezone">
                                      <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="UTC">UTC</SelectItem>
                                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                                    <SelectItem value="Europe/London">London</SelectItem>
                                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                          <Save className="mr-2 h-4 w-4" />
                          {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security" className="space-y-6">
                <Card data-testid="security-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="mr-2 h-5 w-5" />
                      Change Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...passwordForm}>
                      <form onSubmit={passwordForm.handleSubmit((data) => updatePasswordMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={passwordForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" data-testid="input-current-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    {...field} 
                                    type={showPassword ? "text" : "password"} 
                                    data-testid="input-new-password" 
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                    data-testid="button-toggle-password"
                                  >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm New Password</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" data-testid="input-confirm-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={updatePasswordMutation.isPending} data-testid="button-change-password">
                          <Shield className="mr-2 h-4 w-4" />
                          {updatePasswordMutation.isPending ? "Changing..." : "Change Password"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-600">
                      <AlertTriangle className="mr-2 h-5 w-5" />
                      Danger Zone
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Once you delete your account, there is no going back. Please be certain.
                      </AlertDescription>
                    </Alert>
                    <Button variant="destructive" onClick={handleDeleteAccount} data-testid="button-delete-account">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Account
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notification Settings */}
              <TabsContent value="notifications" className="space-y-6">
                <Card data-testid="notification-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bell className="mr-2 h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...notificationForm}>
                      <form onSubmit={notificationForm.handleSubmit((data) => updateNotificationsMutation.mutate(data))} className="space-y-6">
                        <div className="space-y-4">
                          <FormField
                            control={notificationForm.control}
                            name="emailNotifications"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base flex items-center">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email Notifications
                                  </FormLabel>
                                  <FormDescription>
                                    Receive email notifications for important updates
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-email-notifications"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={notificationForm.control}
                            name="smsNotifications"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base flex items-center">
                                    <Phone className="mr-2 h-4 w-4" />
                                    SMS Notifications
                                  </FormLabel>
                                  <FormDescription>
                                    Receive SMS notifications for critical alerts
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-sms-notifications"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={notificationForm.control}
                            name="weeklyReports"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Weekly Reports</FormLabel>
                                  <FormDescription>
                                    Get weekly summary reports of your CRM activity
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-weekly-reports"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={notificationForm.control}
                            name="importAlerts"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Import Alerts</FormLabel>
                                  <FormDescription>
                                    Notifications when CSV imports complete or fail
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-import-alerts"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" disabled={updateNotificationsMutation.isPending} data-testid="button-save-notifications">
                          <Save className="mr-2 h-4 w-4" />
                          {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* System Settings */}
              <TabsContent value="system" className="space-y-6">
                <Card data-testid="system-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Database className="mr-2 h-5 w-5" />
                      System Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...systemForm}>
                      <form onSubmit={systemForm.handleSubmit((data) => updateSystemMutation.mutate(data))} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={systemForm.control}
                            name="dataRetention"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data Retention (days)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-data-retention">
                                      <SelectValue placeholder="Select retention period" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="90">90 days</SelectItem>
                                    <SelectItem value="180">180 days</SelectItem>
                                    <SelectItem value="365">1 year</SelectItem>
                                    <SelectItem value="never">Never delete</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={systemForm.control}
                            name="exportFormat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Default Export Format</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-export-format">
                                      <SelectValue placeholder="Select format" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="xlsx">Excel</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={systemForm.control}
                            name="recordsPerPage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Records Per Page</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-records-per-page">
                                      <SelectValue placeholder="Select page size" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="space-y-4">
                          <FormField
                            control={systemForm.control}
                            name="autoBackup"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Auto Backup</FormLabel>
                                  <FormDescription>
                                    Automatically backup your data daily
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-auto-backup"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={systemForm.control}
                            name="autoSave"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Auto Save</FormLabel>
                                  <FormDescription>
                                    Automatically save changes as you type
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-auto-save"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" disabled={updateSystemMutation.isPending} data-testid="button-save-system">
                          <Save className="mr-2 h-4 w-4" />
                          {updateSystemMutation.isPending ? "Saving..." : "Save Settings"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Download className="mr-2 h-5 w-5" />
                      Data Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button 
                        onClick={() => exportDataMutation.mutate()} 
                        disabled={exportDataMutation.isPending}
                        data-testid="button-export-data"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {exportDataMutation.isPending ? "Exporting..." : "Export All Data"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => clearCacheMutation.mutate()}
                        disabled={clearCacheMutation.isPending}
                        data-testid="button-clear-cache"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Clear Cache
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Appearance Settings */}
              <TabsContent value="appearance" className="space-y-6">
                <Card data-testid="appearance-settings-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Palette className="mr-2 h-5 w-5" />
                      Appearance & Display
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...appearanceForm}>
                      <form onSubmit={appearanceForm.handleSubmit((data) => updateAppearanceMutation.mutate(data))} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={appearanceForm.control}
                            name="theme"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Theme</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-theme">
                                      <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="light" className="flex items-center">
                                      <Sun className="mr-2 h-4 w-4" />
                                      Light
                                    </SelectItem>
                                    <SelectItem value="dark" className="flex items-center">
                                      <Moon className="mr-2 h-4 w-4" />
                                      Dark
                                    </SelectItem>
                                    <SelectItem value="system" className="flex items-center">
                                      <Monitor className="mr-2 h-4 w-4" />
                                      System
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={appearanceForm.control}
                            name="fontSize"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Font Size</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-font-size">
                                      <SelectValue placeholder="Select font size" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="small">Small</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="large">Large</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="space-y-4">
                          <FormField
                            control={appearanceForm.control}
                            name="compactMode"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Compact Mode</FormLabel>
                                  <FormDescription>
                                    Use a more compact layout to fit more information
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-compact-mode"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={appearanceForm.control}
                            name="showAvatars"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Show Avatars</FormLabel>
                                  <FormDescription>
                                    Display profile pictures in contact lists
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-show-avatars"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" disabled={updateAppearanceMutation.isPending} data-testid="button-save-appearance">
                          <Save className="mr-2 h-4 w-4" />
                          {updateAppearanceMutation.isPending ? "Saving..." : "Save Appearance"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Keys Settings */}
              <TabsContent value="api-keys" className="space-y-6">
                <Card data-testid="api-keys-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Key className="mr-2 h-5 w-5" />
                      API Keys
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Alert>
                      <Key className="h-4 w-4" />
                      <AlertDescription>
                        API keys allow external applications to access your prospect data via the public API.
                        Keep your keys secure and never share them publicly.
                      </AlertDescription>
                    </Alert>

                    {/* Create New Key */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Create New API Key</h3>
                      <div className="flex gap-4">
                        <Input
                          placeholder="Key label (e.g., Production, Development)"
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                          className="max-w-sm"
                          data-testid="input-api-key-label"
                        />
                        <Button
                          onClick={() => createApiKeyMutation.mutate(newKeyLabel)}
                          disabled={!newKeyLabel.trim() || createApiKeyMutation.isPending}
                          data-testid="button-create-api-key"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {createApiKeyMutation.isPending ? "Creating..." : "Create Key"}
                        </Button>
                      </div>
                    </div>

                    {/* Newly Created Key Display */}
                    {newlyCreatedKey && (
                      <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription className="space-y-2">
                          <p className="font-medium text-green-800 dark:text-green-200">
                            API Key created successfully! Copy it now - it won't be shown again.
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="bg-white dark:bg-gray-800 p-2 rounded text-sm font-mono flex-1 break-all">
                              {newlyCreatedKey}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyApiKey(newlyCreatedKey)}
                              data-testid="button-copy-new-key"
                            >
                              {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewlyCreatedKey(null)}
                            className="mt-2"
                          >
                            Dismiss
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator />

                    {/* Existing Keys List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Your API Keys</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchApiKeys()}
                          disabled={apiKeysLoading}
                          data-testid="button-refresh-api-keys"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${apiKeysLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      
                      {apiKeysLoading ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <p>Loading API keys...</p>
                        </div>
                      ) : apiKeysError ? (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Failed to load API keys. Please try refreshing or re-login if the issue persists.
                          </AlertDescription>
                        </Alert>
                      ) : apiKeysData?.keys?.length === 0 ? (
                        <p className="text-gray-500">No API keys yet. Create one above to get started.</p>
                      ) : (
                        <div className="space-y-3">
                          {apiKeysData?.keys?.map((apiKey) => (
                            <div
                              key={apiKey.id}
                              className={`flex items-center justify-between p-4 rounded-lg border ${
                                apiKey.isActive 
                                  ? "border-gray-200 dark:border-gray-700" 
                                  : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                              }`}
                              data-testid={`api-key-item-${apiKey.id}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{apiKey.label}</span>
                                  {apiKey.isActive ? (
                                    <Badge variant="default" className="bg-green-500">Active</Badge>
                                  ) : (
                                    <Badge variant="destructive">Revoked</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 space-x-4">
                                  <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                                  {apiKey.lastUsedAt && (
                                    <span>Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>
                                  )}
                                  <span>Requests: {apiKey.requestCount || 0}</span>
                                  <span>Rate limit: {apiKey.rateLimitPerMinute || 60}/min</span>
                                </div>
                              </div>
                              {apiKey.isActive && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (window.confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
                                      revokeApiKeyMutation.mutate(apiKey.id);
                                    }
                                  }}
                                  disabled={revokeApiKeyMutation.isPending}
                                  data-testid={`button-revoke-key-${apiKey.id}`}
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Revoke
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* API Documentation */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">API Usage</h3>
                      
                      {/* Search Prospects */}
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Search Prospects by LinkedIn URL:</p>
                          <code className="text-sm block text-blue-600 dark:text-blue-400">
                            GET /api/public/prospects?linkedinUrl=https://linkedin.com/in/username
                          </code>
                        </div>
                      </div>

                      {/* Create Contact */}
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Create a New Contact:</p>
                          <code className="text-sm block text-green-600 dark:text-green-400">
                            POST /api/public/contacts
                          </code>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Request Body (JSON):</p>
                          <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
{`{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "company": "Acme Inc",
  "title": "CEO",
  "industry": "Technology"
}`}
                          </pre>
                        </div>
                      </div>

                      {/* Bulk Create Contacts */}
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Create Multiple Contacts (max 100):</p>
                          <code className="text-sm block text-green-600 dark:text-green-400">
                            POST /api/public/contacts/bulk
                          </code>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Request Body (JSON):</p>
                          <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
{`{
  "contacts": [
    { "firstName": "John", "email": "john@example.com" },
    { "firstName": "Jane", "email": "jane@example.com" }
  ]
}`}
                          </pre>
                        </div>
                      </div>

                      {/* Headers */}
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">Required Headers:</p>
                        <code className="text-sm block">
                          x-api-key: your-api-key-here
                        </code>
                        <code className="text-sm block mt-1">
                          Content-Type: application/json
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}