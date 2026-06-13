import { useGetDashboardSummary, useGetRevenueTrend, useGetTopProducts, useGetLowStockAlerts, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight, Package, AlertTriangle, TrendingUp, DollarSign, ShoppingCart, Activity, CreditCard } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";

function formatKES(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CurrencyYAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number | string };
}) {
  const value = Number(payload?.value ?? 0);

  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="hsl(215 16% 47%)" fontSize={11}>
      {`KES ${value.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`}
    </text>
  );
}

function formatEAT(isoString: string) {
  const date = new Date(isoString);
  const eatOffset = 3 * 60 * 60 * 1000;
  const eat = new Date(date.getTime() + eatOffset);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = months[eat.getUTCMonth()];
  const day = eat.getUTCDate();
  let hours = eat.getUTCHours();
  const minutes = eat.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

interface StatCardProps {
  title: string;
  value: number;
  change?: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  formatAsCurrency?: boolean;
  accentColor?: string;
}

function StatCard({ title, value, change, icon: Icon, formatAsCurrency = false, accentColor = "#00c46a" }: StatCardProps) {
  const isPositive = (change ?? 0) > 0;
  const isNegative = (change ?? 0) < 0;

  return (
    <div className="stat-card bg-white p-5">
      <div className="stat-card-accent" style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}18` }}>
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </div>
      </div>
      <div className="text-2xl font-black text-foreground">
        {formatAsCurrency ? formatKES(value) : value.toLocaleString()}
      </div>
      {change !== undefined && (
        <p className={`text-xs flex items-center mt-1.5 font-medium ${isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"}`}>
          {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : isNegative ? <ArrowDownRight className="h-3 w-3 mr-1" /> : null}
          {Math.abs(change)}% from last period
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: revenueTrend, isLoading: loadingTrend } = useGetRevenueTrend({ period: "week" });
  const { data: topProducts, isLoading: loadingTop } = useGetTopProducts({ period: "week" });
  const { data: lowStockAlerts, isLoading: loadingAlerts } = useGetLowStockAlerts();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity();

  if (loadingSummary) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-16 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const chartData = revenueTrend?.map(d => ({ ...d, revenue: Number(d.revenue) }));

  return (
    <div className="flex flex-col h-full overflow-auto">

      <div className="p-6 space-y-6 flex-1">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today's Revenue"
            value={summary?.todayRevenue || 0}
            change={summary?.todayRevenueChange}
            icon={DollarSign}
            formatAsCurrency
            accentColor="#00c46a"
          />
          <StatCard
            title="Transactions"
            value={summary?.todayTransactions || 0}
            change={summary?.todayTransactionsChange}
            icon={ShoppingCart}
            accentColor="#3b82f6"
          />
          <StatCard
            title="Avg Transaction"
            value={summary?.avgTransactionValue || 0}
            icon={TrendingUp}
            formatAsCurrency
            accentColor="#8b5cf6"
          />
          <StatCard
            title="Low / Out of Stock"
            value={(summary?.lowStockCount || 0) + (summary?.outOfStockCount || 0)}
            icon={AlertTriangle}
            accentColor="#f59e0b"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 card-glow-green border-border/60 rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Revenue Trend · This Week
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-2 h-[280px] pt-4">
              {loadingTrend ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(215 16% 47%)" }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={<CurrencyYAxisTick />}
                      width={88}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [`KES ${value.toLocaleString()}`, "Revenue"]}
                      contentStyle={{
                        background: "white",
                        border: "1px solid hsl(214 25% 88%)",
                        borderRadius: "10px",
                        fontSize: "12px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3 rounded-2xl border-border/60">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingAlerts ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : lowStockAlerts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <Package className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">All stock levels are optimal.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockAlerts?.slice(0, 5).map((alert) => (
                    <div key={alert.productId} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <div>
                        <p className="text-sm font-semibold leading-none">{alert.productName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{alert.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${alert.status === "out" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                          {alert.stockQty} left
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingTop ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {topProducts?.map((product, i) => (
                    <div key={product.productId} className="flex items-center justify-between border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{product.productName}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{product.totalSold} sold</p>
                        <p className="text-sm font-bold text-primary">{formatKES(product.totalRevenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingActivity ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity?.map((activity) => {
                    const isNewPayment = activity.type === "new_customer";
                    const displayDesc = isNewPayment
                      ? activity.description.replace(/^New customer:/i, "New payment:")
                      : activity.description;

                    return (
                      <div key={activity.id} className="flex items-start gap-3 border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                        <div className={`mt-0.5 rounded-lg p-1.5 flex-shrink-0 ${
                          activity.type === "sale" ? "bg-green-50" :
                          activity.type === "stock_update" ? "bg-blue-50" :
                          isNewPayment ? "bg-purple-50" :
                          activity.type === "low_stock" ? "bg-red-50" :
                          "bg-gray-50"
                        }`}>
                          {activity.type === "sale" && <DollarSign className="h-3.5 w-3.5 text-green-600" />}
                          {activity.type === "stock_update" && <Package className="h-3.5 w-3.5 text-blue-600" />}
                          {isNewPayment && <CreditCard className="h-3.5 w-3.5 text-purple-600" />}
                          {activity.type === "low_stock" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          {activity.type === "message_sent" && <Activity className="h-3.5 w-3.5 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug truncate">{displayDesc}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{formatEAT(activity.timestamp)}</p>
                        </div>
                        {activity.amount && (
                          <div className="text-sm font-bold text-primary flex-shrink-0">
                            {formatKES(activity.amount)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
