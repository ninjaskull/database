import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, LayoutDashboard, Users, Building2, UserPlus, Upload, Linkedin, BarChart3, Database, Settings, Sparkles, TrendingUp, Zap, AlertCircle, Brain, Download } from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  name: string;
  icon: ReactNode;
  items: NavItem[];
  defaultOpen?: boolean;
}

const workspaces: NavGroup[] = [
  {
    name: 'Insights',
    icon: <TrendingUp className="w-4 h-4" />,
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
      { name: 'Analytics', href: '/analytics', icon: <BarChart3 className="w-4 h-4" /> },
      { name: 'AI Insights', href: '/ai-insights', icon: <Brain className="w-4 h-4" /> },
    ]
  },
  {
    name: 'Data Hub',
    icon: <Database className="w-4 h-4" />,
    defaultOpen: true,
    items: [
      { name: 'Contacts', href: '/contacts', icon: <Users className="w-4 h-4" /> },
      { name: 'Prospects', href: '/prospects', icon: <UserPlus className="w-4 h-4" /> },
      { name: 'Companies', href: '/companies', icon: <Building2 className="w-4 h-4" /> },
      { name: 'LinkedIn Search', href: '/linkedin-search', icon: <Linkedin className="w-4 h-4" /> },
      { name: 'LinkedIn Export', href: '/linkedin-profiles-export', icon: <Download className="w-4 h-4" /> },
    ]
  },
  {
    name: 'Automation',
    icon: <Zap className="w-4 h-4" />,
    defaultOpen: true,
    items: [
      { name: 'Import Data', href: '/import', icon: <Upload className="w-4 h-4" /> },
      { name: 'Data Quality', href: '/database', icon: <AlertCircle className="w-4 h-4" /> },
    ]
  },
];

const standaloneItems: NavItem[] = [
  { name: 'Settings', href: '/settings', icon: <Settings className="w-4 h-4" /> },
];

export function Sidebar() {
  const [location] = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    workspaces.forEach(group => {
      initial[group.name] = group.defaultOpen ?? false;
    });
    return initial;
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some(item => location === item.href);
  };

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col h-0 flex-1 bg-gray-800 dark:bg-gray-900">
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-800 dark:bg-gray-900">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
              <div className="ml-3">
                <p className="text-lg font-semibold text-white">CRM Pro</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {workspaces.map((group) => {
                const isExpanded = expandedGroups[group.name];
                const groupActive = isGroupActive(group);
                
                return (
                  <div key={group.name} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className={cn(
                        "w-full group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors",
                        groupActive
                          ? "text-white bg-gray-700/50"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      )}
                      data-testid={`nav-group-${group.name.toLowerCase().replace(' ', '-')}`}
                    >
                      <div className="flex items-center">
                        <span className={cn(
                          "mr-3",
                          groupActive ? "text-blue-400" : "text-gray-400 group-hover:text-gray-300"
                        )}>
                          {group.icon}
                        </span>
                        {group.name}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-4 space-y-1 border-l border-gray-700 pl-2">
                        {group.items.map((item) => {
                          const isActive = location === item.href;
                          return (
                            <Link key={item.name} href={item.href}>
                              <div
                                className={cn(
                                  "group flex items-center px-2 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors",
                                  isActive
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                                )}
                                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                              >
                                <span className={cn(
                                  "mr-3",
                                  isActive ? "text-white" : "text-gray-400 group-hover:text-gray-300"
                                )}>
                                  {item.icon}
                                </span>
                                {item.name}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="pt-4 mt-4 border-t border-gray-700">
                {standaloneItems.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link key={item.name} href={item.href}>
                      <div
                        className={cn(
                          "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        )}
                        data-testid={`nav-${item.name.toLowerCase()}`}
                      >
                        <span className={cn(
                          "mr-3",
                          isActive ? "text-white" : "text-gray-400 group-hover:text-gray-300"
                        )}>
                          {item.icon}
                        </span>
                        {item.name}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
