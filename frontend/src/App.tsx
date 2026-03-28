import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import MainLayout from './layouts/MainLayout';

// Lazy loaded pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const POSPage = lazy(() => import('./pages/pos/POSPage'));
const ProductsPage = lazy(() => import('./pages/inventory/ProductsPage'));
const StockPage = lazy(() => import('./pages/inventory/StockPage'));
const SalesPage = lazy(() => import('./pages/reports/SalesPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const EmployeesPage = lazy(() => import('./pages/attendance/EmployeesPage'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const PayrollPage = lazy(() => import('./pages/payroll/PayrollPage'));
const CompanyConfigPage = lazy(() => import('./pages/config/CompanyConfigPage'));
const ReturnsPage = lazy(() => import('./pages/returns/ReturnsPage'));
const ReplacementsPage = lazy(() => import('./pages/replacements/ReplacementsPage'));
const CustomerStatementPage = lazy(() => import('./pages/customers/CustomerStatementPage'));
const SalesHistoryPage = lazy(() => import('./pages/sales/SalesHistoryPage'));
const StockAdjustPage = lazy(() => import('./pages/stock/StockAdjustPage'));
const CollectDuePage = lazy(() => import('./pages/customers/CollectDuePage'));
const AccountsPage = lazy(() => import('./pages/accounts/AccountsPage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const WarehousePage = lazy(() => import('./pages/warehouse/WarehousePage'));
const BankDepositPage = lazy(() => import('./pages/outlet/BankDepositPage'));
const ActivityLogsPage = lazy(() => import('./pages/logs/ActivityLogsPage'));

const ProductionPage = lazy(() => import('./pages/production/ProductionPage'));

const SuperAdminDashboard = lazy(() => import('./pages/super/SuperAdminDashboard'));
const VendorPage = lazy(() => import('./pages/vendors/VendorPage'));

 


const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--body-bg, #f9fafb)' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, border: '4px solid var(--primary, #dc2626)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--text-muted, #999)', fontWeight: 500 }}>Loading...</p>
    </div>
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="stock-adjust" element={<StockAdjustPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="bank-deposit" element={<BankDepositPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="collect-due" element={<CollectDuePage />} />
        <Route path="employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
        <Route path="config" element={<AdminRoute><CompanyConfigPage /></AdminRoute>} />
        <Route path="sales-history" element={<SalesHistoryPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="replacements" element={<ReplacementsPage />} />
        <Route path="statement" element={<CustomerStatementPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="logs" element={<ActivityLogsPage />} />
        <Route path="production" element={<ProductionPage />} />
 
        <Route path="super-admin" element={<SuperAdminDashboard />} />

        <Route path="vendors" element={<VendorPage />} />

      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
