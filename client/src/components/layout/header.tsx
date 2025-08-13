import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-gray-800 shadow border-b border-gray-300 dark:border-gray-600">
      <button className="px-4 border-r border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden">
        <i className="fas fa-bars"></i>
      </button>
      
      <div className="flex-1 px-4 flex justify-between items-center">
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fas fa-search text-gray-600 dark:text-gray-400"></i>
              </div>
              <Input
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-600 dark:focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Search contacts..."
                type="search"
              />
            </div>
          </div>
        </div>
        
        <div className="ml-4 flex items-center md:ml-6">
          <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100">
            <i className="fas fa-bell"></i>
          </Button>
          
          {/* Profile dropdown */}
          <div className="ml-3 relative">
            <div className="flex items-center">
              <Button variant="ghost" className="max-w-xs bg-white dark:bg-gray-800 flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" />
                  <AvatarFallback>JS</AvatarFallback>
                </Avatar>
                <span className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">John Smith</span>
                <i className="ml-1 fas fa-chevron-down text-xs text-gray-600 dark:text-gray-400"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
