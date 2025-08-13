import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactDetailModal } from "./contact-detail-modal";
import { AdvancedContactDialog } from "./advanced-contact-dialog";
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
  const limit = 20;

  // Clean filters to exclude empty/"all" values
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => 
      value && value !== '' && value !== 'all'
    )
  );

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
        <CardHeader className="px-6 py-4 border-b border-gray-300 dark:border-gray-600">
          <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">Contact List</CardTitle>
        </CardHeader>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-700">
              <TableRow>
                <TableHead className="px-6 py-3 text-left">
                  <Checkbox
                    checked={selectedContactIds.length > 0 && data?.contacts && selectedContactIds.length === data.contacts.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="px-6 py-3 text-left">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('fullName')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Name
                    <i className={`fas fa-sort ml-1 ${sortBy === 'fullName' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-3 text-left">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('company')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Company
                    <i className={`fas fa-sort ml-1 ${sortBy === 'company' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-3 text-left">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('email')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Email
                    <i className={`fas fa-sort ml-1 ${sortBy === 'email' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-3 text-left">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('industry')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Industry
                    <i className={`fas fa-sort ml-1 ${sortBy === 'industry' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-3 text-left">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('leadScore')}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Lead Score
                    <i className={`fas fa-sort ml-1 ${sortBy === 'leadScore' ? 'text-blue-600' : ''}`}></i>
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-300 dark:divide-gray-600">
              {isLoading ? (
                [...Array(limit)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
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
                    <TableCell className="px-6 py-4">
                      <Checkbox
                        checked={selectedContactIds.includes(contact.id)}
                        onCheckedChange={(checked) => handleSelectContact(contact.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar className="flex-shrink-0 h-10 w-10">
                          <AvatarFallback className="bg-blue-600 text-white">
                            {getInitials(contact.fullName || 'N/A')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{contact.fullName || 'N/A'}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{contact.title || 'No title'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-800 dark:text-gray-200">{contact.company || 'N/A'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{contact.employeeSizeBracket || 'Unknown size'}</div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-800 dark:text-gray-200">{contact.email || 'No email'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{contact.country || contact.countryCode || 'Unknown'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{contact.mobilePhone || 'No phone'}</div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {contact.industry && (
                        <Badge className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIndustryColor(contact.industry)}`}>
                          {contact.industry}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      {contact.leadScore && (
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {contact.leadScore}
                          </div>
                          <div className="ml-2 w-16 bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`${getLeadScoreColor(Number(contact.leadScore))} h-2 rounded-full`}
                              style={{ width: `${(Number(contact.leadScore) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setAdvancedDialogContact(contact);
                            setAdvancedDialogMode('view');
                          }}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          data-testid={`button-view-${contact.id}`}
                          title="Advanced View"
                        >
                          <i className="fas fa-eye"></i>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setAdvancedDialogContact(contact);
                            setAdvancedDialogMode('edit');
                          }}
                          className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                          data-testid={`button-edit-${contact.id}`}
                          title="Advanced Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          onClick={async () => {
                            if (confirm(`Delete ${contact.fullName}?`)) {
                              await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
                              window.location.reload();
                            }
                          }}
                          data-testid={`button-delete-${contact.id}`}
                          title="Delete Contact"
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
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
