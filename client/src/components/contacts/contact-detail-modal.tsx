import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contact, ContactActivity } from "@shared/schema";

interface ContactDetailModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactDetailModal({ contact, isOpen, onClose }: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: activities } = useQuery({
    queryKey: ['/api/contacts', contact.id, 'activities'],
    enabled: isOpen && activeTab === 'activity',
  });

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

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      'created': 'fas fa-plus text-green-500',
      'updated': 'fas fa-edit text-blue-500',
      'enriched': 'fas fa-magic text-yellow-500',
      'deleted': 'fas fa-trash text-red-500',
    };
    return icons[type] || 'fas fa-info text-gray-500';
  };

  const enrichmentData = {
    emailDomain: contact.emailDomain || contact.email?.split('@')[1] || 'N/A',
    countryCode: contact.countryCode || 'N/A',
    timezone: contact.timezone || 'N/A',
    region: contact.region || 'N/A',
    businessType: contact.businessType || 'N/A',
    techCategory: contact.technologyCategory || 'N/A',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center">
              <Avatar className="flex-shrink-0 h-16 w-16">
                <AvatarFallback className="bg-blue-600 text-white text-xl">
                  {getInitials(contact.fullName || 'N/A')}
                </AvatarFallback>
              </Avatar>
              <div className="ml-6">
                <DialogTitle className="text-xl font-bold text-gray-800 dark:text-gray-200">
                  {contact.fullName || 'N/A'}
                </DialogTitle>
                <p className="text-gray-600 dark:text-gray-400">{contact.title || 'No title'}</p>
                <p className="text-gray-600 dark:text-gray-400">{contact.company || 'No company'}</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="enrichment">Data Enrichment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{contact.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Mobile Phone</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{contact.mobilePhone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">LinkedIn</label>
                    {contact.personLinkedIn ? (
                      <a href={contact.personLinkedIn} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        {contact.personLinkedIn}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-gray-200">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Location</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {[contact.city, contact.state, contact.country].filter(Boolean).join(', ') || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Industry</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{contact.industry || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Company Size</label>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{contact.employeeSizeBracket || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Website</label>
                    {contact.website ? (
                      <a href={contact.website} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        {contact.website}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-gray-200">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Technologies</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.technologies && contact.technologies.length > 0 ? (
                        contact.technologies.map((tech, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tech}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-800 dark:text-gray-200">N/A</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Lead Score</label>
                    {contact.leadScore ? (
                      <div className="flex items-center mt-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{contact.leadScore}</span>
                        <div className="ml-2 w-24 bg-gray-300 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className={`${getLeadScoreColor(Number(contact.leadScore))} h-2 rounded-full`}
                            style={{ width: `${(Number(contact.leadScore) / 10) * 100}%` }}
                          />
                        </div>
                        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                          {Number(contact.leadScore) >= 8 ? 'High Quality' : Number(contact.leadScore) >= 6 ? 'Medium Quality' : 'Low Quality'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-gray-200">N/A</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                {activities && activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity: ContactActivity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                            <i className={`${getActivityIcon(activity.activityType)} text-xs`}></i>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 dark:text-gray-200">{activity.description}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(activity.createdAt!).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">No activity recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrichment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium text-gray-800 dark:text-gray-200">Auto-Enriched Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email Domain</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.emailDomain}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Country Code</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.countryCode}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Timezone</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.timezone}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Region</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.region}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Business Type</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.businessType}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tech Category</label>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{enrichmentData.techCategory}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            Edit Contact
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
