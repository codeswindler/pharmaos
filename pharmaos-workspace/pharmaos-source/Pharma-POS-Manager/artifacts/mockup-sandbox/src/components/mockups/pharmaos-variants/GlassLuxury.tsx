import React from "react";
import { LayoutDashboard, ShoppingCart, Package, AlertTriangle, Users, Settings, TrendingUp, Search, Bell, Activity } from "lucide-react";
import "./_group.css";

export function GlassLuxury() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        .glass-luxury-theme {
          font-family: 'Outfit', sans-serif;
        }
      `}</style>
      <div 
        className="glass-luxury-theme relative min-h-screen w-full overflow-hidden text-white flex"
        style={{
          background: "linear-gradient(135deg, #0a0612 0%, #12082a 100%)",
        }}
      >
        {/* Background Blobs */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full animate-blob-1 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)" }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full animate-blob-2 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(167, 139, 250, 0.1) 0%, transparent 70%)" }}
        />
        <div 
          className="absolute top-[30%] left-[30%] w-[30%] h-[30%] rounded-full animate-blob-3 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)" }}
        />

        {/* Sidebar */}
        <aside 
          className="w-[240px] flex flex-col z-10 border-r"
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "rgba(255, 255, 255, 0.08)"
          }}
        >
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
                <Activity size={18} color="white" />
              </div>
              <span className="text-xl font-bold tracking-wide">PharmaOS</span>
            </div>
          </div>
          
          <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
            <NavItem icon={<ShoppingCart size={18} />} label="Sales" />
            <NavItem icon={<Package size={18} />} label="Inventory" />
            <NavItem icon={<Users size={18} />} label="Customers" />
            <NavItem icon={<TrendingUp size={18} />} label="Reports" />
          </nav>
          
          <div className="p-4">
            <NavItem icon={<Settings size={18} />} label="Settings" />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col z-10 h-screen overflow-y-auto">
          {/* Header */}
          <header className="px-8 py-6 flex items-center justify-between sticky top-0 z-20"
            style={{
              background: "rgba(10, 6, 18, 0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
            }}
          >
            <h1 className="text-2xl font-semibold tracking-wide text-white/90">Overview</h1>
            
            <div className="flex items-center gap-6">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-white/5 border border-white/10 rounded-full py-2 pl-9 pr-4 text-sm outline-none focus:border-white/20 transition-colors w-64 text-white placeholder-white/40"
                  style={{ backdropFilter: "blur(10px)" }}
                />
              </div>
              <div className="relative cursor-pointer">
                <Bell size={20} className="text-white/70 hover:text-white transition-colors" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#7c3aed] rounded-full border border-[#0a0612]" />
              </div>
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                <span className="text-sm font-medium">AD</span>
              </div>
            </div>
          </header>

          <div className="p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard 
                title="Today's Revenue" 
                value="KES 84,320" 
                trend="+12.5%" 
                icon={<TrendingUp size={20} className="text-[#10b981]" />}
              />
              <StatCard 
                title="Transactions" 
                value="147" 
                trend="+5.2%" 
                icon={<ShoppingCart size={20} className="text-[#a78bfa]" />}
              />
              <StatCard 
                title="Total Products" 
                value="212" 
                trend="Stable" 
                icon={<Package size={20} className="text-white/60" />}
                trendColor="text-white/40"
              />
              <StatCard 
                title="Low Stock Alerts" 
                value="8" 
                trend="Action Needed" 
                icon={<AlertTriangle size={20} className="text-rose-400" />}
                trendColor="text-rose-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="lg:col-span-2 rounded-2xl p-6"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
                }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-medium text-white/80">Revenue Overview</h2>
                  <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none appearance-none text-white/80">
                    <option>Last 7 Days</option>
                  </select>
                </div>
                
                <div className="h-64 flex items-end justify-between gap-2 px-2">
                  <ChartBar day="Mon" height="40%" value="42k" />
                  <ChartBar day="Tue" height="55%" value="58k" />
                  <ChartBar day="Wed" height="45%" value="48k" />
                  <ChartBar day="Thu" height="70%" value="74k" />
                  <ChartBar day="Fri" height="85%" value="89k" />
                  <ChartBar day="Sat" height="60%" value="63k" active />
                  <ChartBar day="Sun" height="30%" value="32k" />
                </div>
              </div>

              {/* Top Products */}
              <div className="rounded-2xl p-6 flex flex-col"
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
                }}
              >
                <h2 className="text-lg font-medium text-white/80 mb-6">Top Products</h2>
                <div className="flex-1 flex flex-col gap-4">
                  <TopProductItem rank="1" name="Panadol Extra" sales="142" stock="84" />
                  <TopProductItem rank="2" name="Augmentin 625mg" sales="98" stock="12" />
                  <TopProductItem rank="3" name="Cetirizine 10mg" sales="85" stock="156" />
                  <TopProductItem rank="4" name="Vitamin C 1000mg" sales="64" stock="210" />
                  <TopProductItem rank="5" name="Amoxicillin 500mg" sales="52" stock="45" />
                </div>
              </div>
            </div>

            {/* Activity Feed Row */}
            <div className="rounded-2xl p-6 flex flex-col w-full"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
              }}
            >
              <h2 className="text-lg font-medium text-white/80 mb-6">Recent Sales</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <ActivityItem time="10:42 AM" desc="Panadol Extra x2" amount="KES 400" />
                <ActivityItem time="10:38 AM" desc="Augmentin 625mg" amount="KES 1,200" />
                <ActivityItem time="10:15 AM" desc="Cetirizine 10mg" amount="KES 150" />
                <ActivityItem time="09:55 AM" desc="Vitamin C x3" amount="KES 600" />
                <ActivityItem time="09:30 AM" desc="Amoxicillin" amount="KES 850" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function TopProductItem({ rank, name, sales, stock }: { rank: string, name: string, sales: string, stock: string }) {
  const isLowStock = parseInt(stock) < 20;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
      <div className="flex items-center gap-4">
        <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
          {rank}
        </div>
        <div>
          <div className="text-sm font-medium text-white/90">{name}</div>
          <div className="text-xs text-white/40">{sales} sold</div>
        </div>
      </div>
      <div className={`text-xs font-medium px-2 py-1 rounded-full ${isLowStock ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'}`}>
        {stock} in stock
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 ${active ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)] border border-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function StatCard({ title, value, trend, icon, trendColor = "text-[#10b981]" }: { title: string, value: string, trend: string, icon: React.ReactNode, trendColor?: string }) {
  return (
    <div 
      className="rounded-2xl p-6 relative overflow-hidden group transition-transform duration-300 hover:-translate-y-1"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
      }}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/60">{title}</h3>
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight mb-2">{value}</div>
      <div className={`text-xs font-medium ${trendColor}`}>{trend} from yesterday</div>
    </div>
  );
}

function ChartBar({ day, height, value, active = false }: { day: string, height: string, value: string, active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 flex-1 group">
      <div className="w-full relative flex items-end justify-center h-full rounded-t-sm overflow-hidden bg-white/5">
        <div 
          className="w-full rounded-t-sm transition-all duration-500 relative"
          style={{ 
            height,
            background: active ? "linear-gradient(to top, rgba(124, 58, 237, 0.4), rgba(167, 139, 250, 0.9))" : "linear-gradient(to top, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.3))",
            boxShadow: active ? "0 0 20px rgba(124, 58, 237, 0.4)" : "none"
          }}
        >
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-white/90">
            {value}
          </div>
        </div>
      </div>
      <span className={`text-xs font-medium ${active ? 'text-white' : 'text-white/50'}`}>{day}</span>
    </div>
  );
}

function ActivityItem({ time, desc, amount }: { time: string, desc: string, amount: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#7c3aed] shadow-[0_0_8px_#7c3aed]" />
        <div>
          <div className="text-sm font-medium text-white/90">{desc}</div>
          <div className="text-xs text-white/40">{time}</div>
        </div>
      </div>
      <div className="text-sm font-semibold tracking-wide text-[#10b981]">{amount}</div>
    </div>
  );
}
