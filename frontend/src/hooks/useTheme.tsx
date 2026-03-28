import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { companyAPI } from '../services/api';

export const THEME_TEMPLATES: Record<string, ThemeConfig> = {
  default: { name: 'Classic Red', preview: '🔴', primary: '#dc2626', secondary: '#1e3a5f', accent: '#f59e0b', sidebarBg: '#ffffff', sidebarText: '#374151', headerBg: '#ffffff', headerText: '#111827', bodyBg: '#f9fafb' },
  ocean: { name: 'Ocean Blue', preview: '🔵', primary: '#2563eb', secondary: '#1e40af', accent: '#06b6d4', sidebarBg: '#0f172a', sidebarText: '#94a3b8', headerBg: '#ffffff', headerText: '#0f172a', bodyBg: '#f1f5f9' },
  emerald: { name: 'Emerald Green', preview: '🟢', primary: '#059669', secondary: '#065f46', accent: '#d97706', sidebarBg: '#064e3b', sidebarText: '#a7f3d0', headerBg: '#ffffff', headerText: '#064e3b', bodyBg: '#f0fdf4' },
  purple: { name: 'Royal Purple', preview: '🟣', primary: '#7c3aed', secondary: '#4c1d95', accent: '#ec4899', sidebarBg: '#1e1b4b', sidebarText: '#c4b5fd', headerBg: '#ffffff', headerText: '#1e1b4b', bodyBg: '#faf5ff' },
  sunset: { name: 'Sunset Orange', preview: '🟠', primary: '#ea580c', secondary: '#9a3412', accent: '#eab308', sidebarBg: '#431407', sidebarText: '#fed7aa', headerBg: '#ffffff', headerText: '#431407', bodyBg: '#fff7ed' },
  midnight: { name: 'Midnight Dark', preview: '⚫', primary: '#3b82f6', secondary: '#1e293b', accent: '#22d3ee', sidebarBg: '#0f172a', sidebarText: '#94a3b8', headerBg: '#1e293b', headerText: '#f1f5f9', bodyBg: '#0f172a' },
  rose: { name: 'Rose Gold', preview: '🌸', primary: '#e11d48', secondary: '#881337', accent: '#f472b6', sidebarBg: '#fff1f2', sidebarText: '#881337', headerBg: '#ffffff', headerText: '#881337', bodyBg: '#fdf2f8' },
  steel: { name: 'Steel Gray', preview: '⚪', primary: '#475569', secondary: '#1e293b', accent: '#0ea5e9', sidebarBg: '#f8fafc', sidebarText: '#475569', headerBg: '#ffffff', headerText: '#1e293b', bodyBg: '#f1f5f9' },
};

export const BUSINESS_TYPES = [
  { value: 'wholesale', label: 'Wholesale', icon: '📦' },
  { value: 'retail', label: 'Retail', icon: '🏪' },
  { value: 'electronics', label: 'Electronics', icon: '📱' },
  { value: 'battery', label: 'Battery', icon: '🔋' },
  { value: 'auto_parts', label: 'Auto Parts', icon: '🚗' },
  { value: 'hardware', label: 'Hardware', icon: '🔧' },
  { value: 'furniture', label: 'Furniture', icon: '🪑' },
  { value: 'clothing', label: 'Clothing', icon: '👔' },
  { value: 'grocery', label: 'Grocery', icon: '🛒' },
  { value: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { value: 'building', label: 'Building Materials', icon: '🏗️' },
  { value: 'stationery', label: 'Stationery', icon: '📝' },
  { value: 'food', label: 'Food & Beverage', icon: '🍔' },
  { value: 'general', label: 'General Trading', icon: '🏢' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export interface ThemeConfig {
  name?: string; preview?: string;
  primary: string; secondary: string; accent: string;
  sidebarBg: string; sidebarText: string;
  headerBg: string; headerText: string; bodyBg: string;
}

export interface CompanyConfig {
  id?: number;
  shop_name: string; business_type: string; app_name: string; app_icon: string;
  logo: string; address: string; phone: string; email: string;
  vat_percentage: number; tin_certificate_id: string; invoice_footer: string;
  currency: string; currency_symbol: string; theme_template: string;
  primary_color: string; secondary_color: string; accent_color: string;
  sidebar_bg: string; sidebar_text: string; header_bg: string; header_text: string; body_bg: string;
  logo_url: string; favicon_url: string; favicon_ico: string;
  invoice_logo_url: string; invoice_logo_position: string; invoice_logo_width: number; invoice_logo_height: number; show_invoice_logo: number;
  [key: string]: any;
}

const DEFAULTS: CompanyConfig = {
  shop_name: 'My Business', business_type: 'wholesale', app_name: 'SmartERP', app_icon: '⚡',
  logo: '', address: '', phone: '', email: '', vat_percentage: 0, tin_certificate_id: '', invoice_footer: '',
  currency: 'BDT', currency_symbol: '৳', theme_template: 'default', logo_url: '', favicon_url: '', favicon_ico: '',
  invoice_logo_url: '', invoice_logo_position: 'center', invoice_logo_width: 120, invoice_logo_height: 60, show_invoice_logo: 1,
  primary_color: '#dc2626', secondary_color: '#1e3a5f', accent_color: '#f59e0b',
  sidebar_bg: '#ffffff', sidebar_text: '#374151', header_bg: '#ffffff', header_text: '#111827', body_bg: '#f9fafb',
};

function isColorDark(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function applyCSS(c: Partial<CompanyConfig>) {
  const root = document.documentElement;
  const s = (k: string, v: string | undefined) => { if (v) root.style.setProperty(k, v); };
  s('--primary', c.primary_color); s('--secondary', c.secondary_color); s('--accent', c.accent_color);
  s('--sidebar-bg', c.sidebar_bg); s('--sidebar-text', c.sidebar_text);
  s('--header-bg', c.header_bg); s('--header-text', c.header_text); s('--body-bg', c.body_bg);
  if (c.primary_color) { s('--primary-light', c.primary_color + '18'); s('--primary-hover', c.primary_color + '22'); }
  if (c.sidebar_bg) {
    const dark = isColorDark(c.sidebar_bg);
    s('--sidebar-active-bg', dark ? 'rgba(255,255,255,0.12)' : (c.primary_color || '#dc2626') + '15');
    s('--sidebar-active-text', dark ? '#ffffff' : c.primary_color || '#dc2626');
    s('--sidebar-hover-bg', dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6');
  }
  if (c.body_bg) {
    const dark = isColorDark(c.body_bg);
    s('--card-bg', dark ? '#1e293b' : '#ffffff'); s('--card-border', dark ? '#334155' : '#e5e7eb');
    s('--text-primary', dark ? '#f1f5f9' : '#111827'); s('--text-secondary', dark ? '#94a3b8' : '#6b7280');
    s('--text-muted', dark ? '#64748b' : '#9ca3af');
    s('--input-bg', dark ? '#1e293b' : '#ffffff'); s('--input-border', dark ? '#475569' : '#d1d5db');
  }
  if (c.header_bg) { s('--header-text-secondary', isColorDark(c.header_bg) ? 'rgba(255,255,255,0.5)' : '#6b7280'); }
}

function setFavicon(url: string) {
  if (!url) return;
  try {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = url;
  } catch { }
}

interface ThemeCtx { config: CompanyConfig; loading: boolean; refreshConfig: () => Promise<void>; applyTheme: (t: Partial<CompanyConfig>) => void; }
const ThemeContext = createContext<ThemeCtx>({ config: DEFAULTS, loading: true, refreshConfig: async () => { }, applyTheme: () => { } });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CompanyConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refreshConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      const res = await companyAPI.get();
      if (res.data.success && res.data.data) {
        const c = { ...DEFAULTS, ...res.data.data };
        setConfig(c);
        applyCSS(c);
        // Sync page title
        document.title = c.app_name || c.shop_name || 'SmartERP';
        // Sync favicon
        if (c.favicon_ico) setFavicon(c.favicon_ico);
        else if (c.favicon_url) setFavicon(c.favicon_url);
      }
    } catch { } finally { setLoading(false); }
  };

  const applyTheme = (t: Partial<CompanyConfig>) => applyCSS(t);

  useEffect(() => { applyCSS(DEFAULTS); refreshConfig(); }, []);

  return <ThemeContext.Provider value={{ config, loading, refreshConfig, applyTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }