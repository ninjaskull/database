import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'fas fa-tachometer-alt' },
  { name: 'Contacts', href: '/contacts', icon: 'fas fa-users' },
  { name: 'Import Data', href: '/import', icon: 'fas fa-upload' },
  { name: 'LinkedIn Search', href: '/linkedin-search', icon: 'fab fa-linkedin' },
  { name: 'Analytics', href: '/analytics', icon: 'fas fa-chart-bar' },
  { name: 'Settings', href: '/settings', icon: 'fas fa-cog' },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col h-0 flex-1 bg-gray-800 dark:bg-gray-900">
          {/* Logo */}
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-800 dark:bg-gray-900">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className="fas fa-database text-blue-500 text-2xl"></i>
              </div>
              <div className="ml-3">
                <p className="text-lg font-semibold text-white">CRM Pro</p>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <div className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    )}>
                      <i className={cn(
                        item.icon,
                        "mr-3",
                        isActive ? "text-white" : "text-gray-300 group-hover:text-white"
                      )}></i>
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
