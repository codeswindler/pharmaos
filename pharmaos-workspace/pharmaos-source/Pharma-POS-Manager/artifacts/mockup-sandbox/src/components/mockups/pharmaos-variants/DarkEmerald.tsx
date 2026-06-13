import React from "react";
import { LayoutDashboard, ShoppingCart, Package, AlertTriangle, TrendingUp, Users, Settings, LogOut, Activity, ArrowUpRight, DollarSign } from "lucide-react";
import "./_group.css";

export function DarkEmerald() {
  const chartData = [
    { day: "Mon", value: 45 },
    { day: "Tue", value: 52 },
    { day: "Wed", value: 38 },
    { day: "Thu", value: 65 },
    { day: "Fri", value: 85 },
    { day: "Sat", value: 72 },
    { day: "Sun", value: 90 },
  ];

  const recentActivity = [
    { id: 1, item: "Amoxicillin 500mg", type: "Sale", time: "10 mins ago", amount: "KES 1,200", status: "completed" },
    { id: 2, item: "Panadol Extra", type: "Sale", time: "25 mins ago", amount: "KES 350", status: "completed" },
    { id: 3, item: "Vitamin C Zinc", type: "Sale", time: "1 hour ago", amount: "KES 850", status: "completed" },
    { id: 4, item: "Omeprazole 20mg", type: "Sale", time: "2 hours ago", amount: "KES 450", status: "completed" },
  ];

  const topProducts = [
    { id: 1, name: "Paracetamol 500mg", sales: 145, revenue: "KES 14,500" },
    { id: 2, name: "Cetirizine 10mg", sales: 98, revenue: "KES 9,800" },
    { id: 3, name: "Augmentin 625mg", sales: 76, revenue: "KES 76,000" },
  ];

  return (
    <>
      <link rel="stylesheet" media="print" onLoad={(e) => { (e.target as any).media='all' }} href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&display=swap" />
      <div className="emerald-theme flex">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0 border-r" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}>
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#00c46a]/20 border border-[#00c46a]/50 flex items-center justify-center">
              <Activity className="w-5 h-5 emerald-text" />
            </div>
            <span className="font-bold tracking-wider text-lg" style={{ fontFamily: 'Barlow Condensed' }}>PHARMA<span className="emerald-text">OS</span></span>
          </div>

          <nav className="mt-6 px-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#00c46a]/10 border border-[#00c46a]/30 emerald-text">
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm font-medium">Dashboard</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-sm font-medium">Point of Sale</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <Package className="w-4 h-4" />
              <span className="text-sm font-medium">Inventory</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Customers</span>
            </a>
          </nav>

          <div className="absolute bottom-0 w-[220px] p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors mt-1">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Log out</span>
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-semibold mb-1" style={{ fontFamily: 'Barlow Condensed' }}>SYSTEM <span className="text-white/40">OVERVIEW</span></h1>
              <p className="text-white/40 text-sm">Real-time pharmacy metrics & performance.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-white/40">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00c46a] animate-pulse"></span> SYSTEM ONLINE</span>
              <span>12:45:03 EAT</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="emerald-card pulse-card p-5">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Today's Revenue</span>
                <DollarSign className="w-4 h-4 gold-text" />
              </div>
              <div className="stat-value text-4xl gold-text mb-1">KES 84,320</div>
              <div className="flex items-center gap-1 text-xs text-[#00c46a]">
                <ArrowUpRight className="w-3 h-3" />
                <span>+12.5% vs yesterday</span>
              </div>
            </div>

            <div className="emerald-card p-5">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Transactions</span>
                <ShoppingCart className="w-4 h-4 text-white/40" />
              </div>
              <div className="stat-value text-4xl text-white mb-1">147</div>
              <div className="flex items-center gap-1 text-xs text-[#00c46a]">
                <ArrowUpRight className="w-3 h-3" />
                <span>+5.2%</span>
              </div>
            </div>

            <div className="emerald-card p-5">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Active Products</span>
                <Package className="w-4 h-4 text-white/40" />
              </div>
              <div className="stat-value text-4xl text-white mb-1">212</div>
              <div className="text-xs text-white/40">In catalog</div>
            </div>

            <div className="emerald-card p-5 border-t-2 border-t-red-500/50">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Low Stock Alerts</span>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div className="stat-value text-4xl text-red-400 mb-1">8</div>
              <div className="text-xs text-red-400/70">Requires immediate attention</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Chart */}
            <div className="col-span-2 emerald-card p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60">Revenue History (7 Days)</h3>
                <TrendingUp className="w-4 h-4 text-white/30" />
              </div>
              <div className="chart-bar-container border-b border-white/5 pb-2">
                {chartData.map((data, i) => (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-bar" style={{ height: `${data.value}%` }}></div>
                    <span className="chart-label">{data.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div className="emerald-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-6">Top Sellers</h3>
              <div className="space-y-4">
                {topProducts.map((product, i) => (
                  <div key={i} className="flex justify-between items-center pb-3 border-b border-white/5 last:border-0 last:pb-0">
                    <div>
                      <div className="text-sm font-medium text-white/90">{product.name}</div>
                      <div className="text-xs text-white/40">{product.sales} units</div>
                    </div>
                    <div className="font-mono text-sm gold-text">{product.revenue}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Recent Activity */}
            <div className="col-span-3 emerald-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-white/60 mb-6">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase text-white/40 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium text-white/90">{activity.item}</td>
                        <td className="px-4 py-3 text-white/50">{activity.type}</td>
                        <td className="px-4 py-3 font-mono gold-text">{activity.amount}</td>
                        <td className="px-4 py-3 text-white/50">{activity.time}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#00c46a]/10 text-[#00c46a] border border-[#00c46a]/30">
                            {activity.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}