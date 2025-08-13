import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Building, Globe, Phone, Mail, MapPin, Star, Users, DollarSign, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getEmployeeSizeBracket, EMPLOYEE_SIZE_BRACKETS } from "@/lib/employee-size-utils";

// Advanced contact schema for editing all fields
const contactEditSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  
  // Phone Numbers
  mobilePhone: z.string().optional(),
  otherPhone: z.string().optional(),
  homePhone: z.string().optional(),
  corporatePhone: z.string().optional(),
  
  // Company Information
  company: z.string().optional(),
  employees: z.number().optional().or(z.string()),
  employeeSizeBracket: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  companyLinkedIn: z.string().url().optional().or(z.literal("")),
  technologies: z.array(z.string()).optional(),
  annualRevenue: z.string().optional(),
  
  // URLs
  personLinkedIn: z.string().url().optional().or(z.literal("")),
  
  // Location
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyState: z.string().optional(),
  companyCountry: z.string().optional(),
  
  // Auto-enriched Data
  emailDomain: z.string().optional(),
  countryCode: z.string().optional(),
  timezone: z.string().optional(),
  leadScore: z.string().optional(),
  companyAge: z.number().optional().or(z.string()),
  technologyCategory: z.string().optional(),
  region: z.string().optional(),
  businessType: z.string().optional(),
});

type ContactEditForm = z.infer<typeof contactEditSchema>;

interface AdvancedContactDialogProps {
  contact: any;
  isOpen: boolean;
  onClose: () => void;
  mode: 'view' | 'edit';
}

export function AdvancedContactDialog({ contact, isOpen, onClose, mode: initialMode }: AdvancedContactDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [technologyInput, setTechnologyInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ContactEditForm>({
    resolver: zodResolver(contactEditSchema),
    defaultValues: {
      fullName: contact?.fullName || "",
      firstName: contact?.firstName || "",
      lastName: contact?.lastName || "",
      title: contact?.title || "",
      email: contact?.email || "",
      mobilePhone: contact?.mobilePhone || "",
      otherPhone: contact?.otherPhone || "",
      homePhone: contact?.homePhone || "",
      corporatePhone: contact?.corporatePhone || "",
      company: contact?.company || "",
      employees: contact?.employees || "",
      employeeSizeBracket: contact?.employeeSizeBracket || "",
      industry: contact?.industry || "",
      website: contact?.website || "",
      companyLinkedIn: contact?.companyLinkedIn || "",
      technologies: contact?.technologies || [],
      annualRevenue: contact?.annualRevenue || "",
      personLinkedIn: contact?.personLinkedIn || "",
      city: contact?.city || "",
      state: contact?.state || "",
      country: contact?.country || "",
      companyAddress: contact?.companyAddress || "",
      companyCity: contact?.companyCity || "",
      companyState: contact?.companyState || "",
      companyCountry: contact?.companyCountry || "",
      emailDomain: contact?.emailDomain || "",
      countryCode: contact?.countryCode || "",
      timezone: contact?.timezone || "",
      leadScore: contact?.leadScore || "",
      companyAge: contact?.companyAge || "",
      technologyCategory: contact?.technologyCategory || "",
      region: contact?.region || "",
      businessType: contact?.businessType || "",
    },
  });

  // Watch for employee count changes and auto-update size bracket
  const watchedEmployees = form.watch('employees');
  const currentBracket = form.watch('employeeSizeBracket');

  useEffect(() => {
    if (mode === 'edit' && watchedEmployees) {
      const suggestedBracket = getEmployeeSizeBracket(watchedEmployees);
      if (suggestedBracket && suggestedBracket !== currentBracket) {
        form.setValue('employeeSizeBracket', suggestedBracket);
      }
    }
  }, [watchedEmployees, mode, form, currentBracket]);

  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactEditForm) => {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update contact');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact updated successfully" });
      setMode('view');
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const onSubmit = (data: ContactEditForm) => {
    // Convert employees to number if it's a string
    if (data.employees && typeof data.employees === 'string') {
      data.employees = parseInt(data.employees) || undefined;
    }
    if (data.companyAge && typeof data.companyAge === 'string') {
      data.companyAge = parseInt(data.companyAge) || undefined;
    }
    updateContactMutation.mutate(data);
  };

  const addTechnology = () => {
    if (technologyInput.trim()) {
      const currentTechs = form.getValues('technologies') || [];
      form.setValue('technologies', [...currentTechs, technologyInput.trim()]);
      setTechnologyInput("");
    }
  };

  const removeTechnology = (index: number) => {
    const currentTechs = form.getValues('technologies') || [];
    form.setValue('technologies', currentTechs.filter((_, i) => i !== index));
  };

  if (!contact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {contact.fullName?.charAt(0) || contact.firstName?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{contact.fullName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{contact.title} {contact.company && `at ${contact.company}`}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {mode === 'view' ? (
                <Button variant="outline" onClick={() => setMode('edit')} data-testid="button-edit-contact">
                  Edit Contact
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMode('view')} data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                  <Button 
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={updateContactMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-save-contact"
                  >
                    {updateContactMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[500px] pr-4">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="enriched">Enriched Data</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                  
                  {/* Personal Information Tab */}
                  <TabsContent value="personal" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="w-5 h-5" />
                          Personal Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name *</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-fullName" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" disabled={mode === 'view'} data-testid="input-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-firstName" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-lastName" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Job Title</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="personLinkedIn"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>LinkedIn Profile</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://linkedin.com/in/..." disabled={mode === 'view'} data-testid="input-personLinkedIn" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Phone className="w-5 h-5" />
                          Phone Numbers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="mobilePhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mobile Phone</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-mobilePhone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="corporatePhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Corporate Phone</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-corporatePhone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="homePhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Home Phone</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-homePhone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="otherPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Other Phone</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-otherPhone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Company Information Tab */}
                  <TabsContent value="company" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building className="w-5 h-5" />
                          Company Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-company" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-industry" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Website</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://..." disabled={mode === 'view'} data-testid="input-website" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="companyLinkedIn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company LinkedIn</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://linkedin.com/company/..." disabled={mode === 'view'} data-testid="input-companyLinkedIn" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employees"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Employees</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" disabled={mode === 'view'} data-testid="input-employees" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="employeeSizeBracket"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employee Size Bracket</FormLabel>
                              <FormControl>
                                <Select value={field.value || "none"} onValueChange={field.onChange} disabled={mode === 'view'}>
                                  <SelectTrigger data-testid="select-employeeSizeBracket">
                                    <SelectValue placeholder="Select or auto-filled from employee count" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Select bracket...</SelectItem>
                                    {EMPLOYEE_SIZE_BRACKETS.map((bracket) => (
                                      <SelectItem key={bracket} value={bracket}>
                                        {bracket} employees
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                              {mode === 'edit' && form.watch('employees') && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Auto-filled based on employee count
                                </p>
                              )}
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="annualRevenue"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Annual Revenue</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., 10000000" disabled={mode === 'view'} data-testid="input-annualRevenue" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Technologies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {(form.watch('technologies') || []).map((tech, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {tech}
                                {mode === 'edit' && (
                                  <button
                                    type="button"
                                    onClick={() => removeTechnology(index)}
                                    className="ml-1 text-red-500 hover:text-red-700"
                                  >
                                    ×
                                  </button>
                                )}
                              </Badge>
                            ))}
                          </div>
                          
                          {mode === 'edit' && (
                            <div className="flex gap-2">
                              <Input
                                value={technologyInput}
                                onChange={(e) => setTechnologyInput(e.target.value)}
                                placeholder="Add technology..."
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                                data-testid="input-technology"
                              />
                              <Button type="button" onClick={addTechnology} data-testid="button-add-technology">
                                Add
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Location Information Tab */}
                  <TabsContent value="location" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="w-5 h-5" />
                          Personal Location
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State/Province</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-country" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="countryCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country Code</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-countryCode" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building className="w-5 h-5" />
                          Company Location
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="companyAddress"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Company Address</FormLabel>
                              <FormControl>
                                <Textarea {...field} disabled={mode === 'view'} data-testid="input-companyAddress" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="companyCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company City</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-companyCity" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="companyState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company State</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-companyState" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="companyCountry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Country</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-companyCountry" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Enriched Data Tab */}
                  <TabsContent value="enriched" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="w-5 h-5" />
                          AI-Enriched Data
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="leadScore"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lead Score</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-leadScore" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="timezone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Timezone</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-timezone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="emailDomain"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Domain</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-emailDomain" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="region"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Region</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-region" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="companyAge"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Age (years)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" disabled={mode === 'view'} data-testid="input-companyAge" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="technologyCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Technology Category</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-technologyCategory" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="businessType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Type</FormLabel>
                              <FormControl>
                                <Input {...field} disabled={mode === 'view'} data-testid="input-businessType" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5" />
                          Contact Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <CalendarDays className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium">Created</p>
                              <p className="text-sm text-gray-500">
                                {contact.createdAt ? new Date(contact.createdAt).toLocaleString() : 'Unknown'}
                              </p>
                            </div>
                          </div>
                          
                          {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <CalendarDays className="w-5 h-5 text-gray-500" />
                              <div>
                                <p className="font-medium">Last Updated</p>
                                <p className="text-sm text-gray-500">
                                  {new Date(contact.updatedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>


                </form>
              </Form>
            </Tabs>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}