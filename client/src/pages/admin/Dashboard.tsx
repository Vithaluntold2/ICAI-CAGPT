import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, CreditCard, Activity, TrendingUp, TrendingDown, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
  });

  const kpis = (dashboardData as any)?.kpis;

  const stats = [
    {
      title: "Total Users",
      value: kpis?.totalUsers || 0,
      icon: Users,
      change: "+12%",
      changeType: "increase" as const,
      testId: "stat-total-users"
    },
    {
      title: "Active Subscriptions",
      value: kpis?.activeSubscriptions || 0,
      icon: CreditCard,
      change: "+8%",
      changeType: "increase" as const,
      testId: "stat-active-subscriptions"
    },
    {
      title: "Monthly Revenue",
      value: `$${((kpis?.monthlyRevenue || 0) / 100).toLocaleString()}`,
      icon: DollarSign,
      change: "+15%",
      changeType: "increase" as const,
      testId: "stat-monthly-revenue"
    },
    {
      title: "Queries This Month",
      value: kpis?.queriesThisMonth || 0,
      icon: Activity,
      change: "+23%",
      changeType: "increase" as const,
      testId: "stat-queries-month"
    },
    {
      title: "Documents Analyzed",
      value: kpis?.documentsAnalyzed || 0,
      icon: Package,
      change: "+18%",
      changeType: "increase" as const,
      testId: "stat-documents-analyzed"
    },
    {
      title: "Churn Rate",
      value: `${kpis?.churnRate || 0}%`,
      icon: TrendingDown,
      change: "-2%",
      changeType: "decrease" as const,
      testId: "stat-churn-rate"
    },
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor key metrics and platform performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} data-testid={stat.testId} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`${stat.testId}-value`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stat.changeType === "increase" ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={stat.changeType === "increase" ? "text-green-500" : "text-red-500"}>
                  {stat.change}
                </span>
                <span>from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card data-testid="card-recent-activity">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity timeline coming soon...
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-top-plans">
          <CardHeader>
            <CardTitle>Popular Plans</CardTitle>
            <CardDescription>Subscription distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Professional</span>
                <span className="text-sm font-medium">{kpis?.professionalCount || 0} users</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Plus</span>
                <span className="text-sm font-medium">{kpis?.plusCount || 0} users</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Free</span>
                <span className="text-sm font-medium">{kpis?.freeCount || 0} users</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
