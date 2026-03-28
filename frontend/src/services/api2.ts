import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (data: any) => api.put('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
  createUser: (data: any) => api.post('/auth/users', data),
};

// Products API
export const productsAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getOne: (id: number) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
  getSerialNumbers: (productId: number) => api.get(`/products/${productId}/serial-numbers`),
};

// Stock API
export const stockAPI = {
  getBatches: (productId: number) => api.get(`/stock/batches/${productId}`),
  stockIn: (data: any) => api.post('/stock/in', data),
  adjust: (data: any) => api.post('/stock/adjust', data),
  getMovements: (params?: any) => api.get('/stock/movements', { params }),
  getHistory: (productId: number) => api.get(`/stock/history/${productId}`),
  getLowStock: (threshold?: number) => api.get('/stock/low-stock', { params: { threshold } }),
  getSummary: () => api.get('/stock/summary/stock'),
};

// Sales API
export const salesAPI = {
  create: (data: any) => api.post('/sales', data),
  getAll: (params?: any) => api.get('/sales', { params }),
  getOne: (id: number) => api.get(`/sales/${id}`),
  delete: (id: number, reason?: string) => api.delete(`/sales/${id}`, { data: { reason } }),
  getAnalytics: () => api.get('/sales/analytics/summary'),
  getProfitMetrics: () => api.get('/sales/analytics/profit'),
  getDailyReport: (date?: string) => api.get('/sales/reports/daily', { params: { date } }),
};

// Customers API
export const customersAPI = {
  getAll: (params?: any) => api.get('/customers', { params }),
  getOne: (id: number) => api.get(`/customers/${id}`),
  create: (data: any) => api.post('/customers', data),
  update: (id: number, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: number) => api.delete(`/customers/${id}`),
  addPayment: (id: number, data: any) => api.post(`/customers/${id}/payments`, data),
  getPayments: (id: number) => api.get(`/customers/${id}/payments`),
  getSales: (id: number, params?: any) => api.get(`/customers/${id}/sales`, { params }),
  getPaymentReceipt: (customerId: number, paymentId: number) => api.get(`/customers/${customerId}/payments/${paymentId}/receipt`),
  getCreditDues: () => api.get('/customers/credit/dues'),
  getStatement: (id: number, params?: any) => api.get(`/customers/${id}/statement`, { params }),
  search: (query: string) => api.get('/customers/search', { params: { q: query } }),
};

// Returns API
export const returnsAPI = {
  searchProduct: (serial: string) => api.get('/returns/search', { params: { serial } }),
  create: (data: any) => api.post('/returns/create', data),
  getAll: (params?: any) => api.get('/returns', { params }),
  getOne: (id: number) => api.get(`/returns/${id}`),
};

// Replacements API
export const replacementsAPI = {
  create: (data: any) => api.post('/replacements/create', data),
  getAll: (params?: any) => api.get('/replacements', { params }),
  getOne: (id: number) => api.get(`/replacements/${id}`),
};

// Employees API
export const employeesAPI = {
  getAll: () => api.get('/employees'),
  create: (data: any) => api.post('/employees', data),
  update: (id: number, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: number) => api.delete(`/employees/${id}`),
  getAttendance: (params?: any) => api.get('/employees/attendance', { params }),
  markAttendance: (data: any) => api.post('/employees/attendance', data),
  getRules: () => api.get('/employees/attendance-rules'),
  updateRules: (data: any) => api.put('/employees/attendance-rules', data),
  getPayroll: (month: number, year: number) => api.get('/employees/payroll', { params: { month, year } }),
  generatePayroll: (month: number, year: number) => api.post('/employees/payroll/generate', { month, year }),
  markPayrollPaid: (id: number) => api.put(`/employees/payroll/${id}/pay`, {}),
};

// Company API
export const companyAPI = {
  get: () => api.get('/company'),
  update: (data: any) => api.put('/company', data),
};


// Reports API
export const reportsAPI = {
  getStatement: (params: any) => api.get('/reports/statement', { params }),
};


export default api;