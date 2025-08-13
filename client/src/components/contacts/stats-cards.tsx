import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      name: 'Total Contacts',
      value: stats?.totalContacts?.toLocaleString() || '0',
      icon: 'fas fa-users',
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      name: 'Companies',
      value: stats?.totalCompanies?.toLocaleString() || '0',
      icon: 'fas fa-building',
      change: '+8%',
      changeType: 'positive' as const,
    },
    {
      name: 'Valid Emails',
      value: stats?.validEmails?.toLocaleString() || '0',
      icon: 'fas fa-envelope',
      change: `${Math.round((stats?.validEmails / stats?.totalContacts) * 100) || 0}%`,
      changeType: 'neutral' as const,
    },
    {
      name: 'Lead Score Avg',
      value: stats?.averageLeadScore?.toFixed(1) || '0.0',
      icon: 'fas fa-chart-line',
      change: '+0.3',
      changeType: 'positive' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {statsData.map((stat) => (
        <Card key={stat.name} className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <i className={`${stat.icon} text-blue-600 dark:text-blue-400 text-2xl`}></i>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{stat.name}</dt>
                  <dd className="text-lg font-medium text-gray-800 dark:text-gray-200">{stat.value}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
          <div className="bg-gray-50 dark:bg-gray-700 px-5 py-3">
            <div className="text-sm">
              <span className={`font-medium ${
                stat.changeType === 'positive' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {stat.change}
              </span>
              <span className="text-gray-600 dark:text-gray-400 ml-1">
                {stat.changeType === 'positive' ? 'vs last month' : 'validation rate'}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
