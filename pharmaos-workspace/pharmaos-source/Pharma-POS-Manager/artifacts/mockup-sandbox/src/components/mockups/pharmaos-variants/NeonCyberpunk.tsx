import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  FileText, 
  Settings, 
  Bell, 
  Search, 
  TrendingUp,
  Activity,
  AlertTriangle,
  Pill,
  ChevronRight,
  Menu,
  Power
} from 'lucide-react';
import './_group.css';

export function NeonCyberpunk() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const chartData = [
    { label: 'Mon', value: 45 },
    { label: 'Tue', value: 65 },
    { label: 'Wed', value: 35 },
    { label: 'Thu', value: 80 },
    { label: 'Fri', value: 55 },
    { label: 'Sat', value: 90 },
    { label: 'Sun', value: 40 },
  ];

  const recentSales = [
    { id: 'TX-9902', items: 'Amoxicillin 500mg, Panadol', amount: 'KES 1,250', time: '2 mins ago', status: 'Completed' },
    { id: 'TX-9901', items: 'Vitamin C, Zinc Tabs', amount: 'KES 850', time: '14 mins ago', status: 'Completed' },
    { id: 'TX-9900', items: 'Ibuprofen 400mg', amount: 'KES 320', time: '35 mins ago', status: 'Completed' },
    { id: 'TX-9899', items: 'Malaria Test Kit, Coartem', amount: 'KES 2,100', time: '1 hour ago', status: 'Completed' },
  ];

  const topProducts = [
    { name: 'Panadol Extra', category: 'Painkiller', sold: 145, stock: 450, trend: '+12%' },
    { name: 'Amoxicillin 500mg', category: 'Antibiotic', sold: 98, stock: 120, trend: '+5%' },
    { name: 'Cetirizine', category: 'Antihistamine', sold: 76, stock: 85, trend: '-2%' },
    { name: 'Vitamin C 1000mg', category: 'Supplement', sold: 64, stock: 15, trend: '+18%' },
  ];

  return (
    <div className="cyberpunk-theme scanlines flex h-screen w-full overflow-hidden text-slate-300">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
      `}</style>
      
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 transition-all duration-300 border-r border-[#00ff9d]/30 flex flex-col z-10 relative`}
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#00ff9d]/20 relative overflow-hidden">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded border border-[#00ff9d] flex items-center justify-center bg-[#00ff9d]/10" style={{ boxShadow: '0 0 10px rgba(0,255,157,0.5)' }}>
                <Activity className="w-5 h-5 text-[#00ff9d]" />
              </div>
              <span className="neon-font font-bold text-lg text-white tracking-widest uppercase" style={{ textShadow: '0 0 5px #00ff9d' }}>PharmaOS</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-[#00ff9d]/20 text-[#00ff9d] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Subtle neon accent line */}
          <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-[#00ff9d] to-transparent opacity-50"></div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2 relative z-10">
          <NavItem icon={<LayoutDashboard />} label="Terminal" active collapsed={!sidebarOpen} />
          <NavItem icon={<ShoppingCart />} label="POS System" collapsed={!sidebarOpen} />
          <NavItem icon={<Package />} label="Inventory" collapsed={!sidebarOpen} badge="8" />
          <NavItem icon={<Users />} label="Customers" collapsed={!sidebarOpen} />
          <NavItem icon={<FileText />} label="Reports" collapsed={!sidebarOpen} />
          <div className="mt-8 mb-2 px-3 text-xs uppercase tracking-widest text-[#00e5ff]/50 font-bold">System</div>
          <NavItem icon={<Settings />} label="Configuration" collapsed={!sidebarOpen} />
        </div>

        <div className="p-4 border-t border-[#00ff9d]/20 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#08121a] border border-[#00e5ff] p-0.5 flex items-center justify-center overflow-hidden">
               <div className="w-full h-full bg-[#00e5ff]/20 rounded-full flex items-center justify-center">
                 <Power className="w-5 h-5 text-[#00e5ff]" />
               </div>
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-bold text-white neon-font">SYSADMIN_01</div>
                <div className="text-xs text-[#00e5ff]">Online <span className="inline-block w-2 h-2 bg-[#00ff9d] rounded-full ml-1 live-dot" style={{ boxShadow: '0 0 5px #00ff9d' }}></span></div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-[#00ff9d]/20 bg-[#030d1a]/80 backdrop-blur-sm">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-96 group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#00ff9d]/50 group-focus-within:text-[#00ff9d]" />
              <input 
                type="text" 
                placeholder="QUERY DATABASE..." 
                className="w-full bg-[#08121a] border border-[#00ff9d]/30 text-[#00ff9d] text-sm pl-10 pr-4 py-2 rounded focus:outline-none focus:border-[#00ff9d] focus:ring-1 focus:ring-[#00ff9d] transition-all placeholder:text-[#00ff9d]/30 neon-font uppercase tracking-wider"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded hover:bg-[#00ff9d]/10 text-slate-300 hover:text-[#00ff9d] transition-colors group">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ff00ff] rounded-full shadow-[0_0_5px_#ff00ff] live-dot"></span>
            </button>
            <div className="h-6 w-[1px] bg-[#00ff9d]/30"></div>
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-widest">Network Status</div>
              <div className="text-sm font-bold text-[#00ff9d] neon-font flex items-center gap-2 justify-end">
                SECURE <Activity className="w-3 h-3" />
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-white neon-font tracking-wider flex items-center gap-3 uppercase">
                <span className="w-2 h-6 bg-[#00ff9d] inline-block shadow-[0_0_8px_#00ff9d]"></span>
                Operations Terminal
              </h1>
              <p className="text-[#00e5ff] text-sm mt-1 neon-font opacity-80 uppercase tracking-widest">&gt; Analyzing sector metrics...</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-[#00ff9d]/10 border border-[#00ff9d] text-[#00ff9d] text-sm font-bold neon-font uppercase tracking-wider hover:bg-[#00ff9d] hover:text-black transition-all shadow-[0_0_10px_rgba(0,255,157,0.2)] hover:shadow-[0_0_15px_rgba(0,255,157,0.6)]">
                [ EXPORT DATA ]
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Today's Revenue" 
              value="KES 84,320" 
              trend="+12.5%" 
              icon={<TrendingUp className="w-6 h-6 text-[#00ff9d]" />}
              type="green"
            />
            <StatCard 
              title="Transactions" 
              value="147" 
              trend="+4.2%" 
              icon={<ShoppingCart className="w-6 h-6 text-[#00e5ff]" />}
              type="cyan"
            />
            <StatCard 
              title="Total Products" 
              value="212" 
              trend="0.0%" 
              icon={<Pill className="w-6 h-6 text-[#ff00ff]" />}
              type="magenta"
            />
            <StatCard 
              title="Low Stock Alerts" 
              value="8" 
              trend="Requires Action" 
              icon={<AlertTriangle className="w-6 h-6 text-[#ff0000]" />}
              type="red"
              alert
            />
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart Area */}
            <div className="lg:col-span-2 cyberpunk-card p-5 rounded-lg flex flex-col min-h-[350px]">
              <div className="flex justify-between items-center mb-6 border-b border-[#00ff9d]/20 pb-3">
                <h2 className="text-lg font-bold text-white neon-font uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00ff9d]" /> 
                  Revenue Trend
                </h2>
                <div className="flex gap-2">
                  <span className="text-xs bg-[#00ff9d]/20 text-[#00ff9d] px-2 py-1 rounded border border-[#00ff9d]/50 neon-font">7D</span>
                  <span className="text-xs text-slate-500 px-2 py-1 neon-font">30D</span>
                </div>
              </div>
              
              <div className="chart-bar-container flex-1 mt-auto">
                {chartData.map((d, i) => (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-bar cyberpunk-chart-bar w-full" style={{ height: `${d.value}%` }}></div>
                    <div className="chart-label neon-font text-[#00e5ff] tracking-wider uppercase mt-2">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="cyberpunk-card-cyan cyberpunk-card p-5 rounded-lg border-[#00e5ff]/30">
              <div className="flex justify-between items-center mb-6 border-b border-[#00e5ff]/20 pb-3">
                <h2 className="text-lg font-bold text-white neon-font uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#00e5ff] rounded-full live-dot"></span>
                  Live Feed
                </h2>
              </div>
              
              <div className="space-y-4">
                {recentSales.map((sale, i) => (
                  <div key={i} className="flex gap-3 relative pb-4 border-b border-slate-800/50 last:border-0 last:pb-0 group">
                    <div className="w-8 h-8 rounded bg-[#00e5ff]/10 border border-[#00e5ff]/50 flex items-center justify-center flex-shrink-0 group-hover:bg-[#00e5ff]/20 transition-colors">
                      <ShoppingCart className="w-4 h-4 text-[#00e5ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-white neon-font truncate">{sale.id}</p>
                        <p className="text-xs font-bold text-[#00ff9d] neon-font">{sale.amount}</p>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{sale.items}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-[#00e5ff]/70 neon-font">{sale.time}</p>
                        <span className="text-[10px] uppercase tracking-wider text-green-500 border border-green-500/30 px-1 rounded bg-green-500/10">{sale.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 border border-[#00e5ff]/30 text-[#00e5ff] text-xs font-bold uppercase tracking-widest neon-font hover:bg-[#00e5ff]/10 transition-colors">
                Load More Logs
              </button>
            </div>
          </div>

          {/* Top Products Table */}
          <div className="cyberpunk-card p-5 rounded-lg border-[#ff00ff]/30">
            <div className="flex justify-between items-center mb-4 border-b border-[#ff00ff]/20 pb-3">
              <h2 className="text-lg font-bold text-white neon-font uppercase tracking-widest">High-Volume Synthetics</h2>
              <button className="text-[#ff00ff] text-sm flex items-center gap-1 hover:text-white transition-colors neon-font">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-widest text-slate-500 neon-font">
                    <th className="pb-3 px-4 font-normal">Compound Name</th>
                    <th className="pb-3 px-4 font-normal">Classification</th>
                    <th className="pb-3 px-4 font-normal text-right">Units Dispensed</th>
                    <th className="pb-3 px-4 font-normal text-right">Inventory</th>
                    <th className="pb-3 px-4 font-normal text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {topProducts.map((product, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3 px-4 font-medium text-white group-hover:text-[#00ff9d] transition-colors">{product.name}</td>
                      <td className="py-3 px-4 text-slate-400">{product.category}</td>
                      <td className="py-3 px-4 text-right neon-font text-white">{product.sold}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded border neon-font text-xs ${product.stock < 20 ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-xs neon-font ${product.trend.startsWith('+') ? 'text-[#00ff9d]' : 'text-red-500'}`}>
                          {product.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, collapsed = false, badge }: any) {
  return (
    <a 
      href="#" 
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group relative overflow-hidden
        ${active 
          ? 'bg-[#00ff9d]/10 text-[#00ff9d]' 
          : 'text-slate-400 hover:text-[#00ff9d] hover:bg-[#00ff9d]/5'
        }
      `}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]"></div>
      )}
      <div className={`relative z-10 flex items-center justify-center ${active ? 'text-[#00ff9d]' : 'group-hover:text-[#00ff9d] glitch-hover'}`}>
        {icon}
      </div>
      {!collapsed && (
        <span className={`font-medium tracking-wide flex-1 whitespace-nowrap text-sm ${active ? 'text-white' : ''} group-hover:text-white transition-colors`}>
          {label}
        </span>
      )}
      {!collapsed && badge && (
        <span className="bg-[#ff00ff]/20 text-[#ff00ff] border border-[#ff00ff]/50 text-xs px-1.5 py-0.5 rounded neon-font font-bold shadow-[0_0_5px_rgba(255,0,255,0.3)]">
          {badge}
        </span>
      )}
    </a>
  );
}

function StatCard({ title, value, trend, icon, type, alert = false }: any) {
  
  let borderColor, shadowColor, bgGradient;
  
  if (type === 'green') {
    borderColor = '#00ff9d';
    shadowColor = 'rgba(0, 255, 157, 0.4)';
    bgGradient = 'from-[#00ff9d]/5 to-transparent';
  } else if (type === 'cyan') {
    borderColor = '#00e5ff';
    shadowColor = 'rgba(0, 229, 255, 0.4)';
    bgGradient = 'from-[#00e5ff]/5 to-transparent';
  } else if (type === 'magenta') {
    borderColor = '#ff00ff';
    shadowColor = 'rgba(255, 0, 255, 0.4)';
    bgGradient = 'from-[#ff00ff]/5 to-transparent';
  } else {
    borderColor = '#ff0000';
    shadowColor = 'rgba(255, 0, 0, 0.4)';
    bgGradient = 'from-[#ff0000]/10 to-transparent';
  }

  return (
    <div 
      className={`p-5 rounded-lg border bg-gradient-to-br ${bgGradient} relative overflow-hidden group transition-all duration-300 ${alert ? 'animate-pulse' : ''}`}
      style={{ 
        backgroundColor: 'var(--bg-card)',
        borderColor: `rgba(${borderColor === '#00ff9d' ? '0,255,157' : borderColor === '#00e5ff' ? '0,229,255' : borderColor === '#ff00ff' ? '255,0,255' : '255,0,0'}, 0.3)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 15px ${shadowColor}, inset 0 0 10px ${shadowColor}`;
        e.currentTarget.style.borderColor = borderColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = `rgba(${borderColor === '#00ff9d' ? '0,255,157' : borderColor === '#00e5ff' ? '0,229,255' : borderColor === '#ff00ff' ? '255,0,255' : '255,0,0'}, 0.3)`;
      }}
    >
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-slate-400 text-xs uppercase font-bold tracking-widest neon-font">{title}</h3>
        <div className="p-2 rounded bg-slate-900/50 border border-slate-700/50 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <div className="text-3xl font-bold text-white neon-font tracking-wider mb-1" style={{ textShadow: `0 0 10px ${shadowColor}` }}>{value}</div>
        <div className={`text-xs neon-font ${alert ? 'text-[#ff0000]' : 'text-[#00ff9d]'}`}>
          {trend}
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transform scale-150 grayscale">
        {icon}
      </div>
      <div className="absolute top-0 right-0 w-16 h-1 bg-gradient-to-r from-transparent to-current opacity-50" style={{ color: borderColor }}></div>
    </div>
  );
}
