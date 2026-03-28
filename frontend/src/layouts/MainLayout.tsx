import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useState, useEffect } from 'react';

// Each item has a moduleKey that maps to allowed_modules
const allMenuItems = [
  { path: '/', icon: '📊', label: 'Dashboard', exact: true, outlet: true, outletOnly: false, moduleKey: 'dashboard' },
  { path: '/pos', icon: '🛒', label: 'POS Sales', exact: false, outlet: true, outletOnly: false, moduleKey: 'pos' },
  { path: '/products', icon: '📋', label: 'Products', exact: false, outlet: true, outletOnly: false, moduleKey: 'products' },
  { path: '/stock', icon: '📦', label: 'Stock In', exact: false, outlet: true, outletOnly: false, moduleKey: 'stock' },
  { path: '/stock-adjust', icon: '⚙️', label: 'Stock Adjust', exact: false, outlet: true, outletOnly: false, moduleKey: 'stock_adjust' },
  { path: '/customers', icon: '👥', label: 'Customers', exact: false, outlet: true, outletOnly: false, moduleKey: 'customers' },
  { path: '/returns', icon: '↩️', label: 'Returns', exact: false, outlet: false, outletOnly: false, moduleKey: 'returns' },
  { path: '/replacements', icon: '🔄', label: 'Replacements', exact: false, outlet: false, outletOnly: false, moduleKey: 'replacements' },
  { path: '/sales', icon: '🧾', label: 'Sales History', exact: false, outlet: true, outletOnly: false, moduleKey: 'sales' },
  { path: '/sales-history', icon: '📜', label: 'Manage Sales', exact: false, outlet: false, outletOnly: false, moduleKey: 'sales_history' },
  { path: '/collect-due', icon: '💰', label: 'Collect Due', exact: false, outlet: true, outletOnly: false, moduleKey: 'collect_due' },
  { path: '/finance', icon: '💰', label: 'Finance', exact: false, outlet: false, outletOnly: false, moduleKey: 'finance' },
  { path: '/bank-deposit', icon: '🏦', label: 'Bank Deposit', exact: false, outlet: true, outletOnly: false, moduleKey: 'bank_deposit' },
  { path: '/reports', icon: '📈', label: 'Reports', exact: false, outlet: false, outletOnly: false, moduleKey: 'reports' },
  { path: '/statement', icon: '📄', label: 'Statements', exact: false, outlet: false, outletOnly: false, moduleKey: 'statement' },
];

const adminMenuItems = [
  { path: '/accounts', icon: '🏦', label: 'Accounts', exact: false, moduleKey: 'accounts' },
  { path: '/production', icon: '🏭', label: 'Production', exact: false, moduleKey: 'production' },
  { path: '/warehouse', icon: '🏭', label: 'Warehouse', exact: false, moduleKey: 'warehouse' },
  { path: '/vendors', icon: '🚚', label: 'Vendors', exact: false, moduleKey: 'vendors' },
  { path: '/employees', icon: '👥', label: 'Employees', exact: false, moduleKey: 'employees' },
  { path: '/attendance', icon: '📅', label: 'Attendance', exact: false, moduleKey: 'attendance' },
  { path: '/payroll', icon: '💵', label: 'Payroll', exact: false, moduleKey: 'payroll' },
  { path: '/config', icon: '🎨', label: 'Configuration', exact: false, moduleKey: 'config' },
  { path: '/logs', icon: '📋', label: 'Activity Logs', exact: false, moduleKey: 'logs' },
];

export default function MainLayout() {
  const { user, logout, isAdmin, isOutletUser, outletName, hasModule } = useAuth();
  const { config } = useTheme();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Filter menu based on user type AND allowed modules
  const menuItems = (isOutletUser
    ? allMenuItems.filter(item => item.outlet)
    : allMenuItems.filter(item => !item.outletOnly)
  ).filter(item => hasModule(item.moduleKey));

  // Filter admin menu by allowed modules
  const filteredAdminMenu = adminMenuItems.filter(item => hasModule(item.moduleKey));

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--body-bg, #f9fafb)' }}>

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      <aside
        style={{
          position: isMobile ? 'fixed' : 'relative',
          left: isMobile && !sidebarOpen ? '-260px' : '0',
          top: 0, bottom: 0,
          width: isMobile ? 260 : (sidebarOpen ? 240 : 64),
          background: 'var(--sidebar-bg, #fff)',
          borderRight: '1px solid var(--card-border, #e5e7eb)',
          transition: 'all 0.3s ease',
          zIndex: 50, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowX: 'hidden',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border, #e5e7eb)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary, #dc2626)' }}>
            <span className="text-white text-sm font-black">{config.app_icon || '⚡'}</span>
          </div>
          {(sidebarOpen || isMobile) && (
            <div className="flex-1 min-w-0">
              <div className="font-black leading-tight truncate" style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1.05rem', color: 'var(--sidebar-text, #333)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {config.app_name || 'POWERCELL'}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted, #999)' }}>
                {config.business_type ? config.business_type.replace('_', ' ').toUpperCase() : 'ERP SYSTEM'}
              </div>
            </div>
          )}
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)}
              style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text, #666)' }}>
              ✕
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {(sidebarOpen || isMobile) && <p className="text-xs font-semibold uppercase px-3 mb-2 tracking-wider" style={{ color: 'var(--text-muted, #999)' }}>Main Menu</p>}
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}
              title={!sidebarOpen && !isMobile ? item.label : undefined}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {(sidebarOpen || isMobile) && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}

          {isAdmin && filteredAdminMenu.length > 0 && (
            <>
              {(sidebarOpen || isMobile) && <p className="text-xs font-semibold uppercase px-3 mt-4 mb-2 tracking-wider" style={{ color: 'var(--text-muted, #999)' }}>Admin</p>}
              {!sidebarOpen && !isMobile && <div className="my-2 mx-1" style={{ borderTop: '1px solid var(--card-border, #e5e7eb)' }} />}
              {filteredAdminMenu.map(item => (
                <NavLink key={item.path} to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}
                  title={!sidebarOpen && !isMobile ? item.label : undefined}>
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  {(sidebarOpen || isMobile) && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </>
          )}

          {/* Super Admin */}
          {user?.is_super_admin && (
            <>
              {(sidebarOpen || isMobile) && <p className="text-xs font-semibold uppercase px-3 mt-4 mb-2 tracking-wider" style={{ color: '#7c3aed' }}>Super Admin</p>}
              {!sidebarOpen && !isMobile && <div className="my-2 mx-1" style={{ borderTop: '2px solid #7c3aed' }} />}
              <NavLink to="/super-admin"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}
                title={!sidebarOpen && !isMobile ? 'Super Admin' : undefined}
                style={({ isActive }) => isActive ? { background: '#ede9fe', color: '#7c3aed', fontWeight: 700 } : { color: '#7c3aed' }}>
                <span className="text-base flex-shrink-0">🛡️</span>
                {(sidebarOpen || isMobile) && <span className="truncate font-bold">Super Admin</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* User + Status */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border, #e5e7eb)' }}>
          <div className={`flex items-center gap-1.5 text-xs mb-2 ${!sidebarOpen && !isMobile ? 'justify-center' : 'px-1'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`} />
            {(sidebarOpen || isMobile) && <span style={{ color: isOnline ? '#16a34a' : '#ea580c' }}>{isOnline ? 'Online' : 'Offline'}</span>}
          </div>

          {(sidebarOpen || isMobile) && (
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: user?.is_super_admin ? '#ede9fe' : 'var(--primary-light, #fee2e2)', color: user?.is_super_admin ? '#7c3aed' : 'var(--primary, #dc2626)' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--sidebar-text, #333)' }}>{user?.name}</p>
                <p className="text-xs capitalize" style={{ color: user?.is_super_admin ? '#7c3aed' : 'var(--text-muted, #999)' }}>
                  {user?.is_super_admin ? '🛡️ Super Admin' : user?.role}
                </p>
              </div>
            </div>
          )}

          <button onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 text-xs font-medium transition-colors ${!sidebarOpen && !isMobile ? 'justify-center' : ''}`}>
            <span>🚪</span>
            {(sidebarOpen || isMobile) && 'Logout'}
          </button>
        </div>

        {!isMobile && (
          <button onClick={toggleSidebar}
            style={{
              position: 'absolute', bottom: 120, right: -12,
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--card-bg, #fff)', border: '1px solid var(--card-border, #e5e7eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              fontSize: '0.7rem', color: 'var(--text-muted, #999)', zIndex: 10,
            }}>
            {sidebarOpen ? '‹' : '›'}
          </button>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 flex-shrink-0"
          style={{ background: 'var(--header-bg, #fff)', borderBottom: '1px solid var(--card-border, #e5e7eb)' }}>
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar}
              className="md:hidden flex flex-col gap-1 p-1.5 rounded-lg"
              style={{ background: 'var(--sidebar-hover-bg, #f3f4f6)' }}>
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text, #333)', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text, #333)', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: 'var(--header-text, #333)', borderRadius: 1 }} />
            </button>

            <div className="text-base md:text-lg font-black truncate" style={{ fontFamily: 'Barlow Condensed, sans-serif', color: 'var(--header-text, #111)' }}>
              {isOutletUser ? (outletName || 'My Outlet') : (config.shop_name || 'MY BUSINESS')}
            </div>
            <div className="hidden md:block w-px h-5" style={{ background: 'var(--card-border, #ddd)' }} />
            <span className="hidden md:block text-sm" style={{ color: 'var(--header-text-secondary, #999)' }}>
              {user?.is_super_admin ? '🛡️ Super Admin Panel' : isOutletUser ? '🏪 Outlet Panel' : 'POS & ERP Management'}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {!isOnline && (
              <div className="hidden sm:flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-full border border-orange-200">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse inline-block" /> Offline
              </div>
            )}
            <div className="text-xs md:text-sm" style={{ color: 'var(--header-text-secondary, #888)' }}>
              {new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
              <span className="hidden sm:inline"> {new Date().toLocaleDateString('en-BD', { weekday: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
