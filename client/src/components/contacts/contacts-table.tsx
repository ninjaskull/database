import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactDetailModal } from "./contact-detail-modal";
import { AdvancedContactDialog } from "./advanced-contact-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Save, X, Eye, Trash2 } from "lucide-react";
import type { Contact } from "@shared/schema";

interface ContactsTableProps {
  filters: {
    search: string;
    industry: string;
    employeeSizeBracket: string;
    country: string;
  };
  selectedContactIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ContactsTable({ filters, selectedContactIds, onSelectionChange }: ContactsTableProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [advancedDialogContact, setAdvancedDialogContact] = useState<Contact | null>(null);
  const [advancedDialogMode, setAdvancedDialogMode] = useState<'view' | 'edit'>('view');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Contact>>({});
  const limit = 25; // Increased to show more contacts per page
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Clean filters to exclude empty/"all" values
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => 
      value && value !== '' && value !== 'all'
    )
  );

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Contact> }) => {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update contact');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: "Contact updated",
        description: "Contact has been updated successfully.",
      });
      setEditingContactId(null);
      setEditedValues({});
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['contacts', page, limit, cleanFilters, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...cleanFilters
      });
      
      const response = await fetch(`/api/contacts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }
      return response.json();
    }
  }) as { data?: { contacts: Contact[], total: number }, isLoading: boolean, error: any };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.contacts) {
      onSelectionChange(data.contacts.map(c => c.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedContactIds, contactId]);
    } else {
      onSelectionChange(selectedContactIds.filter(id => id !== contactId));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLeadScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-300';
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getIndustryColor = (industry: string | null) => {
    const colors: Record<string, string> = {
      'Technology': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Healthcare': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Finance': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Manufacturing': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return colors[industry || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  // Inline editing functions
  const startEditing = (contact: Contact) => {
    setEditingContactId(contact.id);
    setEditedValues({
      fullName: contact.fullName,
      email: contact.email,
      company: contact.company,
      title: contact.title,
      mobilePhone: contact.mobilePhone,
      industry: contact.industry,
    });
  };

  const cancelEditing = () => {
    setEditingContactId(null);
    setEditedValues({});
  };

  const saveEditing = async () => {
    if (!editingContactId) return;
    
    // Filter out empty values and only send changed values
    const cleanedData = Object.fromEntries(
      Object.entries(editedValues).filter(([key, value]) => 
        value !== null && value !== undefined && value !== ""
      )
    );

    updateContactMutation.mutate({ 
      id: editingContactId, 
      data: cleanedData 
    });
  };

  const handleInputChange = (field: keyof Contact, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600 dark:text-red-400">
            Failed to load contacts. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <CardHeader className="px-4 py-3 border-b border-gray-300 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Contact List ({data?.total || 0})
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setAdvancedDialogContact(null);
                setAdvancedDialogMode('edit');
              }}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-quick-add-contact"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Quick Add
            </Button>
          </div>
        </CardHeader>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-700">
              <TableRow>
                <TableHead className="px-3 py-2 w-8">
                  <Checkbox
                    checked={selectedContactIds.length > 0 && data?.contacts && selectedContactIds.length === data.contacts.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('fullName')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200 h-6 px-2"
                  >
                    Name
                    <i className={`fas fa-sort ml-1 ${sortBy === 'fullName' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('company')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200 h-6 px-2"
                  >
                    Company
                    <i className={`fas fa-sort ml-1 ${sortBy === 'company' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('email')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200 h-6 px-2"
                  >
                    Contact Info
                    <i className={`fas fa-sort ml-1 ${sortBy === 'email' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('industry')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200 h-6 px-2"
                  >
                    Industry
                    <i className={`fas fa-sort ml-1 ${sortBy === 'industry' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-3 py-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('leadScore')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200 h-6 px-2"
                  >
                    Score
                    <i className={`fas fa-sort ml-1 ${sortBy === 'leadScore' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-3 py-2 w-24 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-600">
              {isLoading ? (
                [...Array(limit)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : data?.contacts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No contacts found. Try adjusting your filters.
                  </TableCell>
                </TableRow>
              ) : (
                data?.contacts?.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <TableCell className="px-3 py-2">
                      <Checkbox
                        checked={selectedContactIds.includes(contact.id)}
                        onCheckedChange={(checked) => handleSelectContact(contact.id, !!checked)}
                      />
                    </TableCell>
                    
                    {/* Name Column - Compact */}
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-600 text-white text-xs">
                            {getInitials(contact.fullName || 'N/A')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          {editingContactId === contact.id ? (
                            <div className="space-y-1">
                              <Input
                                value={editedValues.fullName || ''}
                                onChange={(e) => handleInputChange('fullName', e.target.value)}
                                className="text-sm h-6 py-1"
                                placeholder="Full name"
                              />
                              <Input
                                value={editedValues.title || ''}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                className="text-xs h-5 py-0 text-gray-600"
                                placeholder="Title"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {contact.fullName || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {contact.title || 'No title'}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Company Column */}
                    <TableCell className="px-3 py-2">
                      {editingContactId === contact.id ? (
                        <Input
                          value={editedValues.company || ''}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          className="text-sm h-7"
                          placeholder="Company"
                        />
                      ) : (
                        <>
                          <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                            {contact.company || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {contact.employeeSizeBracket || 'Unknown size'}
                          </div>
                        </>
                      )}
                    </TableCell>

                    {/* Contact Info Column */}
                    <TableCell className="px-3 py-2">
                      {editingContactId === contact.id ? (
                        <div className="space-y-1">
                          <Input
                            value={editedValues.email || ''}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="text-sm h-6 py-1"
                            placeholder="Email"
                            type="email"
                          />
                          <Input
                            value={editedValues.mobilePhone || ''}
                            onChange={(e) => handleInputChange('mobilePhone', e.target.value)}
                            className="text-xs h-5 py-0"
                            placeholder="Phone"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                            {contact.email || 'No email'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {contact.mobilePhone || 'No phone'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {contact.country || contact.countryCode || 'Unknown'}
                          </div>
                        </>
                      )}
                    </TableCell>

                    {/* Industry Column */}
                    <TableCell className="px-3 py-2">
                      {editingContactId === contact.id ? (
                        <Select
                          value={editedValues.industry || ''}
                          onValueChange={(value) => handleInputChange('industry', value)}
                        >
                          <SelectTrigger className="h-7 text-sm">
                            <SelectValue placeholder="Industry" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Technology">Technology</SelectItem>
                            <SelectItem value="Healthcare">Healthcare</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
                            <SelectItem value="Retail">Retail</SelectItem>
                            <SelectItem value="Real Estate">Real Estate</SelectItem>
                            <SelectItem value="Consulting">Consulting</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        contact.industry && (
                          <Badge className={`px-2 py-1 text-xs font-medium ${getIndustryColor(contact.industry)}`}>
                            {contact.industry}
                          </Badge>
                        )
                      )}
                    </TableCell>

                    {/* Lead Score Column */}
                    <TableCell className="px-3 py-2">
                      {contact.leadScore && (
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {contact.leadScore}
                          </div>
                          <div className="w-12 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div
                              className={`${getLeadScoreColor(Number(contact.leadScore))} h-1.5 rounded-full`}
                              style={{ width: `${(Number(contact.leadScore) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    {/* Actions Column - Compact */}
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center space-x-1">
                        {editingContactId === contact.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={saveEditing}
                              disabled={updateContactMutation.isPending}
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              title="Save changes"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                              title="Cancel editing"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(contact)}
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Quick edit"
                              data-testid={`button-quick-edit-${contact.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAdvancedDialogContact(contact);
                                setAdvancedDialogMode('view');
                              }}
                              className="h-7 w-7 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                              title="View details"
                              data-testid={`button-view-${contact.id}`}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm(`Delete ${contact.fullName}?`)) {
                                  await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
                                  queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                }
                              }}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete contact"
                              data-testid={`button-delete-${contact.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-300 dark:border-gray-600 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page * limit >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing <span className="font-medium">{((page - 1) * limit) + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, data.total)}</span> of{' '}
                  <span className="font-medium">{data.total.toLocaleString()}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded-l-md"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </Button>
                  {[...Array(Math.min(5, Math.ceil(data.total / limit)))].map((_, i) => (
                    <Button
                      key={i}
                      variant={page === i + 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(i + 1)}
                      className={page === i + 1 ? "bg-blue-600 border-blue-600 text-white" : ""}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * limit >= data.total}
                    onClick={() => setPage(page + 1)}
                    className="rounded-r-md"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </Button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </Card>

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
        />
      )}

      {advancedDialogContact && (
        <AdvancedContactDialog
          contact={advancedDialogContact}
          isOpen={!!advancedDialogContact}
          onClose={() => setAdvancedDialogContact(null)}
          mode={advancedDialogMode}
        />
      )}
    </>
  );
}
