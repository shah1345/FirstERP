import { useState, useEffect, useRef } from 'react';
import { companyAPI } from '../../services/api';
import { useTheme, THEME_TEMPLATES, BUSINESS_TYPES } from '../../hooks/useTheme';
import api from '../../services/api';

export default function CompanyConfigPage() {
  const { config: currentConfig, refreshConfig, applyTheme } = useTheme();
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'business' | 'theme' | 'invoice'>('business');
  const [uploading, setUploading] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const invoiceLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadConfig(); }, []);

  // Update page title when app_name changes
  useEffect(() => {
    if (form.app_name) document.title = form.app_name;
  }, [form.app_name]);

  const loadConfig = async () => {
    try {
      const res = await companyAPI.get();
      if (res.data.success && res.data.data) setForm(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateField = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const applyTemplate = (templateKey: string) => {
    const t = THEME_TEMPLATES[templateKey];
    if (!t) return;
    const updates: any = { theme_template: templateKey, primary_color: t.primary, secondary_color: t.secondary, accent_color: t.accent, sidebar_bg: t.sidebarBg, sidebar_text: t.sidebarText, header_bg: t.headerBg, header_text: t.headerText, body_bg: t.bodyBg };
    setForm((prev: any) => ({ ...prev, ...updates }));
    applyTheme(updates);
  };

  const handleColorChange = (key: string, value: string) => { updateField(key, value); applyTheme({ ...form, [key]: value }); };

  // File upload → base64
  const handleFileUpload = async (field: string, file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('File too large. Max 2MB.'); return; }
    setUploading(field);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        // Try to save via upload endpoint
        try {
          const res = await api.post('/company/upload', { field, data: base64 });
          if (res.data.success) {
            updateField(field, base64);
            setSaved(true); setTimeout(() => setSaved(false), 2000);
          }
        } catch {
          // Fallback: just set in form, will save with main save
          updateField(field, base64);
        }
        setUploading(null);
      };
      reader.readAsDataURL(file);
    } catch { setUploading(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await companyAPI.update(form);
      if (res.data.success) {
        await refreshConfig();
        document.title = form.app_name || 'SmartERP';
        // Update favicon
        if (form.favicon_url || form.favicon_ico) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
          link.rel = 'icon';
          link.href = form.favicon_ico || form.favicon_url;
          document.head.appendChild(link);
        }
        setSaved(true); setTimeout(() => setSaved(false), 3000);
      }
    } catch (err: any) { alert(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading configuration...</div>;

  const tabs = [
    { key: 'business' as const, label: '🏢 Business Info' },
    { key: 'theme' as const, label: '🎨 Theme & Branding' },
    { key: 'invoice' as const, label: '🧾 Invoice Settings' },
  ];

  const logoPosition = form.invoice_logo_position || 'center';
  const logoWidth = form.invoice_logo_width || 120;
  const logoHeight = form.invoice_logo_height || 60;
  const showLogo = form.show_invoice_logo !== 0 && form.show_invoice_logo !== false;
  const invoiceLogo = form.invoice_logo_url || form.logo_url || '';

  // Image upload button component
  const ImageUpload = ({ field, label, currentValue, accept }: { field: string; label: string; currentValue: string; accept?: string }) => (
    <div className="space-y-2">
      <label className="power-label">{label}</label>
      <div className="flex gap-2">
        <input value={currentValue || ''} onChange={e => updateField(field, e.target.value)} className="power-input flex-1" placeholder="https://... or upload below" />
        <input type="file" accept={accept || 'image/*'} className="hidden"
          ref={field === 'logo_url' ? logoRef : field === 'favicon_url' || field === 'favicon_ico' ? faviconRef : invoiceLogoRef}
          onChange={e => { if (e.target.files?.[0]) handleFileUpload(field, e.target.files[0]); }} />
        <button onClick={() => {
          if (field === 'logo_url') logoRef.current?.click();
          else if (field === 'favicon_url' || field === 'favicon_ico') faviconRef.current?.click();
          else invoiceLogoRef.current?.click();
        }} className="btn-outline text-xs py-2 px-3 whitespace-nowrap" disabled={uploading === field}>
          {uploading === field ? '⏳' : '📤 Upload'}
        </button>
      </div>
      {currentValue && (
        <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
          <img src={currentValue} alt={label} className="w-10 h-10 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{currentValue.startsWith('data:') ? '📎 Uploaded image' : currentValue}</span>
          <button onClick={() => updateField(field, '')} className="text-xs text-red-500 px-2">✕ Clear</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🎨 Configuration</h1>
          <p className="page-subtitle">Customize business profile, theme, branding & invoice settings</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm">✅ Saved!</div>}
          <button onClick={handleSave} disabled={saving} className="btn-power">{saving ? '⏳ Saving...' : '💾 Save All Changes'}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="power-card p-1 flex gap-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.key ? 'text-white shadow-sm' : 'hover:bg-gray-100'}`}
            style={activeTab === tab.key ? { background: 'var(--primary, #dc2626)', color: '#fff' } : { color: 'var(--text-muted)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: BUSINESS INFO ──────────────────── */}
      {activeTab === 'business' && (
        <div className="power-card p-6 space-y-5">
          <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>BUSINESS INFORMATION</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div><label className="power-label">Business / Shop Name *</label><input value={form.shop_name || ''} onChange={e => updateField('shop_name', e.target.value)} className="power-input" /></div>
            <div><label className="power-label">Business Type</label>
              <select value={form.business_type || 'wholesale'} onChange={e => updateField('business_type', e.target.value)} className="power-input">
                {BUSINESS_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.icon} {bt.label}</option>)}
              </select>
            </div>
            <div><label className="power-label">Phone</label><input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} className="power-input" /></div>
            <div><label className="power-label">Email</label><input value={form.email || ''} onChange={e => updateField('email', e.target.value)} className="power-input" /></div>
            <div><label className="power-label">TIN / Tax ID</label><input value={form.tin_certificate_id || ''} onChange={e => updateField('tin_certificate_id', e.target.value)} className="power-input" /></div>
            <div><label className="power-label">Currency</label>
              <div className="flex gap-2">
                <input value={form.currency || ''} onChange={e => updateField('currency', e.target.value)} className="power-input" placeholder="BDT" />
                <input value={form.currency_symbol || ''} onChange={e => updateField('currency_symbol', e.target.value)} className="power-input w-24" placeholder="৳" />
              </div>
            </div>
            <div className="col-span-2"><label className="power-label">Full Address</label><textarea value={form.address || ''} onChange={e => updateField('address', e.target.value)} className="power-input resize-none" rows={2} /></div>
          </div>
        </div>
      )}

      {/* ─── TAB: THEME & BRANDING ──────────────── */}
      {activeTab === 'theme' && (
        <div className="space-y-5">
          {/* App Branding */}
          <div className="power-card p-6 space-y-5">
            <h3 className="font-bold" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>APP BRANDING</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="power-label">Software Name (Browser Title & Sidebar)</label>
                <input value={form.app_name || ''} onChange={e => { updateField('app_name', e.target.value); document.title = e.target.value || 'SmartERP'; }} className="power-input" placeholder="SmartERP" />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This shows as browser tab title and sidebar header</p>
              </div>
              <div>
                <label className="power-label">App Icon (Emoji)</label>
                <input value={form.app_icon || ''} onChange={e => updateField('app_icon', e.target.value)} className="power-input text-center text-2xl" placeholder="⚡" maxLength={2} />
              </div>
            </div>

            {/* Logo Upload */}
            <ImageUpload field="logo_url" label="🖼️ App Logo (Sidebar & Header)" currentValue={form.logo_url || ''} />

            {/* Favicon Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ImageUpload field="favicon_url" label="🌐 Favicon (Browser Tab Icon — PNG/SVG)" currentValue={form.favicon_url || ''} accept="image/png,image/svg+xml,image/x-icon" />
              <ImageUpload field="favicon_ico" label="🌐 Favicon ICO (Legacy .ico format)" currentValue={form.favicon_ico || ''} accept=".ico,image/x-icon" />
            </div>

            {/* Preview */}
            <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--body-bg)', border: '1px solid var(--card-border)' }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: form.primary_color || 'var(--primary)', color: '#fff' }}>{form.app_icon || '⚡'}</div>
              )}
              <div>
                <div className="font-black text-lg" style={{ fontFamily: 'Barlow Condensed', textTransform: 'uppercase' }}>{form.app_name || 'SmartERP'}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{BUSINESS_TYPES.find(b => b.value === form.business_type)?.icon} {BUSINESS_TYPES.find(b => b.value === form.business_type)?.label || 'ERP System'}</div>
              </div>
              <div className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>← Sidebar preview</div>
            </div>
          </div>

          {/* Theme Templates */}
          <div className="power-card p-6">
            <h3 className="font-bold mb-4" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>THEME TEMPLATES</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(THEME_TEMPLATES).map(([key, t]) => {
                const isActive = form.theme_template === key;
                return (
                  <div key={key} onClick={() => applyTemplate(key)} className="cursor-pointer rounded-xl p-3 transition-all hover:shadow-md"
                    style={{ border: isActive ? `2px solid ${t.primary}` : '1px solid var(--card-border)', background: isActive ? t.primary + '10' : 'transparent' }}>
                    <div className="flex items-center gap-2 mb-2"><span className="text-lg">{t.preview}</span><span className="font-bold text-xs">{t.name}</span></div>
                    <div className="flex gap-1 h-8 rounded-md overflow-hidden border border-gray-200">
                      <div style={{ width: '25%', background: t.sidebarBg }} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><div style={{ height: '30%', background: t.headerBg, borderBottom: '1px solid #eee' }} /><div style={{ flex: 1, background: t.bodyBg }} /></div>
                    </div>
                    <div className="flex gap-1.5 mt-2">{[t.primary, t.secondary, t.accent].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />)}</div>
                    {isActive && <div className="text-xs font-bold mt-1" style={{ color: t.primary }}>✓ Active</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="power-card p-6">
            <h3 className="font-bold mb-4" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>CUSTOM COLORS</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'primary_color', label: 'Primary' }, { key: 'secondary_color', label: 'Secondary' },
                { key: 'accent_color', label: 'Accent' }, { key: 'sidebar_bg', label: 'Sidebar BG' },
                { key: 'sidebar_text', label: 'Sidebar Text' }, { key: 'header_bg', label: 'Header BG' },
                { key: 'header_text', label: 'Header Text' }, { key: 'body_bg', label: 'Page BG' },
              ].map(c => (
                <div key={c.key} className="flex items-center gap-3">
                  <input type="color" value={form[c.key] || '#000000'} onChange={e => handleColorChange(c.key, e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-2 p-0.5" style={{ borderColor: 'var(--card-border)' }} />
                  <div><div className="text-xs font-semibold">{c.label}</div><div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{form[c.key]}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: INVOICE SETTINGS ──────────────── */}
      {activeTab === 'invoice' && (
        <div className="space-y-5">
          {/* Invoice Logo */}
          <div className="power-card p-6">
            <h3 className="font-bold mb-5" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>🖼️ INVOICE LOGO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-4">
                <ImageUpload field="invoice_logo_url" label="Invoice Logo (URL or Upload)" currentValue={form.invoice_logo_url || ''} />

                <div>
                  <label className="power-label">Logo Position</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'left', label: '◀ Left' },
                      { value: 'center', label: '● Center' },
                      { value: 'right', label: '▶ Right' },
                    ].map(p => (
                      <button key={p.value} onClick={() => updateField('invoice_logo_position', p.value)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all border-2`}
                        style={logoPosition === p.value ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' } : { borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="power-label">Width ({logoWidth}px)</label>
                    <input type="range" min="40" max="300" value={logoWidth} onChange={e => updateField('invoice_logo_width', parseInt(e.target.value))} className="w-full" style={{ accentColor: 'var(--primary)' }} />
                  </div>
                  <div>
                    <label className="power-label">Height ({logoHeight}px)</label>
                    <input type="range" min="20" max="200" value={logoHeight} onChange={e => updateField('invoice_logo_height', parseInt(e.target.value))} className="w-full" style={{ accentColor: 'var(--primary)' }} />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input type="checkbox" checked={showLogo} onChange={e => updateField('show_invoice_logo', e.target.checked ? 1 : 0)} className="w-4 h-4 rounded" style={{ accentColor: 'var(--primary)' }} />
                  Show logo on invoice
                </label>
              </div>

              {/* Live Preview */}
              <div>
                <label className="power-label">Live Preview</label>
                <div className="rounded-xl p-4" style={{ background: '#fff', border: '2px dashed var(--card-border)', minHeight: 120 }}>
                  {invoiceLogo && showLogo ? (
                    <div style={{ textAlign: logoPosition as any }}>
                      <img src={invoiceLogo} alt="Logo" style={{ width: logoWidth, height: logoHeight, objectFit: 'contain', display: 'inline-block' }}
                        onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = '⚠️ Invalid URL'; }} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {!showLogo ? '🚫 Logo hidden' : '🖼️ Upload or paste logo URL'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VAT / Footer */}
          <div className="power-card p-6 space-y-4">
            <h3 className="font-bold mb-3" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>🧾 INVOICE & RECEIPT</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="power-label">Default VAT (%)</label>
                <input type="number" step="0.01" value={form.vat_percentage || ''} onChange={e => updateField('vat_percentage', e.target.value)} className="power-input" placeholder="0" />
              </div>
              <div>
                <label className="power-label">Currency</label>
                <div className="flex gap-2">
                  <input value={form.currency || ''} onChange={e => updateField('currency', e.target.value)} className="power-input" placeholder="BDT" />
                  <input value={form.currency_symbol || ''} onChange={e => updateField('currency_symbol', e.target.value)} className="power-input w-24" placeholder="৳" />
                </div>
              </div>
            </div>
            <div><label className="power-label">Invoice Footer Text</label><textarea value={form.invoice_footer || ''} onChange={e => updateField('invoice_footer', e.target.value)} className="power-input resize-none" rows={2} placeholder="Thank you for your business!" /></div>
          </div>

          {/* Full Invoice Preview */}
          <div className="power-card overflow-hidden">
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'var(--body-bg)', borderBottom: '1px solid var(--card-border)' }}>
              <span>👁️</span><h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Invoice Preview</h3>
            </div>
            <div className="p-6">
              <div className="rounded-xl p-6 mx-auto" style={{ maxWidth: 500, border: '2px dashed var(--card-border)' }}>
                {invoiceLogo && showLogo && (
                  <div style={{ textAlign: logoPosition as any, marginBottom: 12 }}>
                    <img src={invoiceLogo} alt="Logo" style={{ width: logoWidth, height: logoHeight, objectFit: 'contain', display: 'inline-block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-2xl font-black" style={{ fontFamily: 'Barlow Condensed', color: 'var(--text-primary)' }}>{form.shop_name || 'Your Business'}</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{form.address || 'Business Address'}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>📞 {form.phone || '+880 XXXX'} • ✉️ {form.email || 'email@business.com'}</p>
                  {form.tin_certificate_id && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>TIN: {form.tin_certificate_id}</p>}
                </div>
                <div className="border-t border-b my-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)', borderColor: 'var(--card-border)' }}>— Invoice items —</div>
                {form.invoice_footer && <p className="text-xs text-center italic" style={{ color: 'var(--text-muted)' }}>{form.invoice_footer}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="power-card p-5">
        <h3 className="font-bold mb-3" style={{ fontFamily: 'Barlow Condensed', fontSize: '1.1rem', color: 'var(--text-primary)' }}>SYSTEM</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[{ label: 'Software', value: form.app_name || 'SmartERP' }, { label: 'Version', value: 'v3.0' }, { label: 'Database', value: 'MySQL' }, { label: 'Stack', value: 'React + Node.js' }].map((info, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: 'var(--body-bg)' }}>
              <p className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>{info.label}</p>
              <p className="font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pb-10">
        <button onClick={handleSave} disabled={saving} className="btn-power px-8">{saving ? '⏳ Saving...' : '💾 Save Configuration'}</button>
      </div>
    </div>
  );
}