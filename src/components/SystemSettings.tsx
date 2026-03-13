import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Building2, FileText, Printer, Save,
  Upload, Loader2, CheckCircle, Image, AlertCircle,
} from 'lucide-react';
import { getAllSettings, updateSettings, uploadCompanyLogo, SettingsMap } from '../lib/settingsService';

type TabKey = 'branding' | 'station_defaults' | 'pdf_layout';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'branding', label: 'Company Branding', icon: Building2 },
  { key: 'station_defaults', label: 'Station Defaults', icon: Settings },
  { key: 'pdf_layout', label: 'PDF Layout', icon: Printer },
];

export default function SystemSettings() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('branding');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getAllSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    }
  }

  function handleChange(key: string, value: string) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await updateSettings(settings);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 500 * 1024) {
      setError('Logo must be under 500KB');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadCompanyLogo(file);
      handleChange('company_logo_url', url);
      setUploading(false);
    } catch (err) {
      setError('Failed to upload logo');
      setUploading(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="text-gray-600 mt-1">Configure company branding, defaults, and PDF layout</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? 'bg-emerald-600 text-white'
              : dirty
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'branding' && (
          <div className="space-y-6">
            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                  {settings.company_logo_url ? (
                    <img src={settings.company_logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Image size={32} className="text-gray-300" />
                  )}
                </div>
                <div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">PNG/JPG, max 500KB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SettingsField label="Company Name" value={settings.company_name} onChange={(v) => handleChange('company_name', v)} />
              <SettingsField label="Company Email" value={settings.company_email} onChange={(v) => handleChange('company_email', v)} type="email" />
              <SettingsField label="Company Phone" value={settings.company_phone} onChange={(v) => handleChange('company_phone', v)} />
              <SettingsField label="Currency Symbol" value={settings.currency_symbol} onChange={(v) => handleChange('currency_symbol', v)} />
              <SettingsField label="Currency Decimals" value={settings.currency_decimals} onChange={(v) => handleChange('currency_decimals', v)} type="number" />
            </div>
            <SettingsField label="Company Address" value={settings.company_address} onChange={(v) => handleChange('company_address', v)} multiline />
            <SettingsField label="Report Footer Text" value={settings.report_footer_text} onChange={(v) => handleChange('report_footer_text', v)} multiline placeholder="e.g., Thank you for choosing our services" />
          </div>
        )}

        {activeTab === 'station_defaults' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SettingsField label="Default Timezone" value={settings.default_timezone} onChange={(v) => handleChange('default_timezone', v)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Shift Duration</label>
              <div className="flex gap-3">
                {['8h', '12h'].map(dur => (
                  <button
                    key={dur}
                    onClick={() => handleChange('default_shift_duration', dur)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      settings.default_shift_duration === dur
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    {dur === '8h' ? '8 Hours' : '12 Hours'}
                  </button>
                ))}
              </div>
            </div>
            <SettingsField label="Max Upload File Size (MB)" value={settings.max_upload_file_size_mb} onChange={(v) => handleChange('max_upload_file_size_mb', v)} type="number" />
            <SettingsField label="Bulk Insert Chunk Size" value={settings.bulk_insert_chunk_size} onChange={(v) => handleChange('bulk_insert_chunk_size', v)} type="number" />
          </div>
        )}

        {activeTab === 'pdf_layout' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Paper Size</label>
              <select
                value={settings.paper_size}
                onChange={(e) => handleChange('paper_size', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Logo Position</label>
              <select
                value={settings.logo_position}
                onChange={(e) => handleChange('logo_position', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
            <ToggleField label="Show Company Address on PDFs" checked={settings.show_company_address === 'true'} onChange={(v) => handleChange('show_company_address', v ? 'true' : 'false')} />
            <ToggleField label="Show Page Numbers" checked={settings.show_page_numbers === 'true'} onChange={(v) => handleChange('show_page_numbers', v ? 'true' : 'false')} />
          </div>
        )}

        {/* Live Preview */}
        {activeTab === 'branding' && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={16} />
              PDF Header Preview
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                {settings.company_logo_url && (
                  <img src={settings.company_logo_url} alt="Logo" className="w-16 h-16 object-contain" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{settings.company_name || 'Company Name'}</h3>
                  {settings.company_address && <p className="text-sm text-gray-600">{settings.company_address}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    {settings.company_phone && <span>📞 {settings.company_phone}</span>}
                    {settings.company_email && <span>✉️ {settings.company_email}</span>}
                  </div>
                </div>
              </div>
              {settings.report_footer_text && (
                <div className="mt-4 pt-3 border-t border-gray-300 text-center text-xs text-gray-500 italic">
                  {settings.report_footer_text}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable field components
function SettingsField({ label, value, onChange, type = 'text', multiline = false, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; multiline?: boolean; placeholder?: string;
}) {
  const cls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  return (
    <div className={multiline ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} placeholder={placeholder} />
      )}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
