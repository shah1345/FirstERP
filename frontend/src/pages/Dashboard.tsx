import { useEffect, useState } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { salesAPI, stockAPI } from '../services/api';

const COLORS = ['#dc2626','#ef4444','#f87171','#fca5a5','#fb923c','#fbbf24'];

function pctChange(current: number, prev: number): { label: string; up: boolean } {
  if (!prev || prev === 0) return { label: 'N/A', up: true };
  const diff = ((current - prev) / prev) * 100;
  return { label: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`, up: diff >= 0 };
}

function StatCard({ title, value, sub, icon, red = false, compare }: any) {
  return (
    <div className={`rounded-xl p-5 relative overflow-hidden border ${red ? 'bg-red-600 border-red-500' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${red ? 'text-red-200' : 'text-gray-500'}`}>{title}</p>
          <p className={`text-3xl font-black leading-none ${red ? 'text-white' : 'text-gray-900'}`}
            style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>{value}</p>
          {sub && <p className={`text-xs mt-1.5 ${red ? 'text-red-200' : 'text-gray-500'}`}>{sub}</p>}
          {compare && (
            <p className={`text-xs font-semibold mt-1 ${compare.up ? 'text-green-400' : 'text-red-300'}`}>
              {compare.up ? '▲' : '▼'} {compare.label} vs last period
            </p>
          )}
        </div>
        <div className={`text-3xl ml-3 opacity-70 flex-shrink-0 ${red ? 'text-red-200' : ''}`}>{icon}</div>
      </div>
      {red && <div className="absolute -bottom-3 -right-3 text-9xl opacity-10 select-none pointer-events-none">⚡</div>}
    </div>
  );
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [profitMetrics, setProfitMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, stRes, profitRes] = await Promise.all([
        salesAPI.getAnalytics(),
        stockAPI.getSummary(),
        salesAPI.getProfitMetrics()
      ]);

 

      setAnalytics(sRes.data.data);
      setStockSummary(stRes.data.data);
      setProfitMetrics(profitRes.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: any) => `৳${Number(n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading dashboard...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="text-4xl">⚠️</div>
      <div className="text-center">
        <p className="text-red-600 font-semibold">{error}</p>
        <p className="text-gray-400 text-sm mt-1">Make sure the backend is running and database is connected</p>
      </div>
      <button onClick={load} className="btn-power mt-2">🔄 Retry</button>
    </div>
  );

  const s = analytics?.summary || {};
  const monthly = analytics?.monthly || [];
  const topProducts = analytics?.topProducts || [];

  const todayCompare    = pctChange(Number(s.today_sales), Number(s.yesterday_sales));
  const weekCompare     = pctChange(Number(s.week_sales),  Number(s.last_week_sales));
  const monthCompare    = pctChange(Number(s.month_sales), Number(s.last_month_sales));
  const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">PowerCell Battery Wholesale — Live Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="btn-ghost text-xs">🔄 Refresh</button>
          <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
            {new Date().toLocaleDateString('en-BD', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
          </div>
        </div>
      </div>

      {/* Sales Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={fmt(s.today_sales)}
          sub={`${s.today_invoices || 0} invoices today`}
          icon="⚡"
          red
          compare={todayCompare}
        />
        <StatCard
          title="This Week"
          value={fmt(s.week_sales)}
          sub="Current week total"
          icon="📅"
          compare={weekCompare}
        />
        <StatCard
          title="This Month"
          value={fmt(s.month_sales)}
          sub={`VAT: ${fmt(s.today_vat)}`}
          icon="📈"
          compare={monthCompare}
        />
        <StatCard
          title="This Year"
          value={fmt(s.year_sales)}
          sub={`Total: ${s.total_invoices || 0} invoices`}
          icon="🏆"
        />
      </div>

      {/* Stock Stats */}
      {stockSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Products"  value={stockSummary.total_products || 0}                                     sub="Active products"  icon="🔋" />
          <StatCard title="Units In Stock"   value={Number(stockSummary.total_units || 0).toLocaleString()}                sub="Total inventory"  icon="📦" />
          <StatCard title="Stock Value"      value={fmt(stockSummary.total_stock_value)}                                    sub="At purchase price" icon="💰" />
          <StatCard title="Out of Stock"     value={stockSummary.out_of_stock || 0}                                         sub="Needs restocking"  icon="⚠️"
            red={Number(stockSummary.out_of_stock) > 0} />
        </div>
      )}


 

        {profitMetrics && (
          
          <div className="power-card p-6 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                💰 PROFIT OVERVIEW
              </h2>
              <div className="text-right">
                <div className="text-sm text-gray-500">Profit Margin</div>
                <div className="text-2xl font-black text-green-600">{formatPercent(profitMetrics.profit_margin)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border-2 border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📅</span>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">TODAY</span>
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(profitMetrics.daily_profit)}</div>
                <div className="text-xs text-gray-500 mb-2">Daily Profit</div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Sales: {formatCurrency(profitMetrics.daily_sales)}</span>
                  <span className="text-gray-400">Cost: {formatCurrency(profitMetrics.daily_cost)}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📊</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">THIS MONTH</span>
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(profitMetrics.monthly_profit)}</div>
                <div className="text-xs text-gray-500 mb-2">Monthly Profit</div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Sales: {formatCurrency(profitMetrics.monthly_sales)}</span>
                  <span className="text-gray-400">Cost: {formatCurrency(profitMetrics.monthly_cost)}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📈</span>
                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">THIS YEAR</span>
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(profitMetrics.yearly_profit)}</div>
                <div className="text-xs text-gray-500 mb-2">Yearly Profit</div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Sales: {formatCurrency(profitMetrics.yearly_sales)}</span>
                  <span className="text-gray-400">Cost: {formatCurrency(profitMetrics.yearly_cost)}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🏆</span>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">LIFETIME</span>
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">{formatCurrency(profitMetrics.lifetime_profit)}</div>
                <div className="text-xs text-gray-500 mb-2">All-Time Profit</div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Sales: {formatCurrency(profitMetrics.lifetime_sales)}</span>
                  <span className="text-gray-400">Cost: {formatCurrency(profitMetrics.lifetime_cost)}</span>
                </div>
              </div>
            </div>
          </div>
        )}















      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue Area Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
              MONTHLY REVENUE (Last 12 Months)
            </h3>
            {monthly.length === 0 && <span className="text-xs text-gray-400">No data yet — make your first sale!</span>}
          </div>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top:5, right:10, bottom:5, left:10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9ca3af' }} />
                <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} tickFormatter={v => `৳${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ border:'1px solid #e5e7eb', borderRadius:'8px', fontSize:'12px' }}
                  formatter={(v: any) => [`৳${Number(v).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="total" stroke="#dc2626" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill:'#dc2626', r:3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-sm">Revenue chart will appear after first sales</p>
            </div>
          )}

        </div>

        {/* Top Products Pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
            TOP PRODUCTS (30d)
          </h3>
          {topProducts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={topProducts.slice(0,6)} dataKey="revenue" nameKey="product_name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={30}>
                    {topProducts.slice(0,6).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize:'11px', borderRadius:'8px' }}
                    formatter={(v: any) => [`৳${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {topProducts.slice(0,5).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 truncate">{p.product_name}</span>
                    </div>
                    <span className="font-bold text-gray-900 ml-2 flex-shrink-0">{p.qty} pcs</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-gray-300">
              <div className="text-5xl mb-3">🔋</div>
              <p className="text-sm">Appears after first sales</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 mb-4" style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:'1.1rem' }}>
          QUICK ACTIONS
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href:'/pos',        icon:'🛒', label:'New Sale',   desc:'Open POS terminal' },
            { href:'/stock',      icon:'📦', label:'Stock In',   desc:'Add inventory batch' },
            { href: '/returns', icon: '📦', label: 'Returns', desc: 'Add Returns batch' },
            { href: '/customers', icon: '👥', label: 'Customers', desc: 'Add Customers batch' },
            { href:'/reports',    icon:'📊', label:'Reports',    desc:'View & print reports' },
            { href:'/attendance', icon:'📅', label:'Attendance', desc:'Mark today' },
          ].map(a => (
            <a key={a.href} href={a.href}
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-xl transition-all duration-200 text-center group cursor-pointer">
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{a.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                <p className="text-xs text-gray-400">{a.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
