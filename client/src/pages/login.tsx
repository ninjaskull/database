import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, Mail, Eye, EyeOff, Shield, Database, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (response.success) {
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        onLoginSuccess(response.user, response.token);
      } else {
        setError(response.message || "Login failed");
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-indigo-600/20"></div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Enterprise CRM</span>
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-white leading-tight">
              Transform Your
              <span className="block text-blue-400">Customer Relationships</span>
            </h2>
            <p className="text-lg text-slate-300 max-w-md">
              Powerful contact management with AI-driven insights and enterprise-grade security.
            </p>
            
            <div className="flex gap-6 text-sm text-slate-400">
              <span>99.9% Uptime</span>
              <span>SOC 2 Type II</span>
              <span>GDPR Ready</span>
            </div>
          </div>

          <div className="text-slate-500 text-sm">
            Trusted by 10,000+ businesses worldwide
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Enterprise CRM</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome back
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6" data-testid="login-error-message">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 dark:text-slate-300">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="name@company.com"
                          className="pl-11 h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg"
                          disabled={isLoading}
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-700 dark:text-slate-300">
                        Password
                      </FormLabel>
                      <button 
                        type="button"
                        className="text-sm text-blue-600 hover:text-blue-700"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pl-11 pr-11 h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg"
                          disabled={isLoading}
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  data-testid="checkbox-remember"
                />
                <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                  Keep me signed in
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                <span>256-bit SSL</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
