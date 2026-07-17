// =============================================
// settingsService.ts
// CRUD for system_settings key-value store
// Used by PDF generators, branding, and config
// =============================================
import { supabase } from './supabase';

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: 'branding' | 'station_defaults' | 'pdf_layout';
  updated_by: string | null;
  updated_at: string | null;
}

export interface SettingsMap {
  // Branding
  company_name: string;
  company_logo_url: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  report_footer_text: string;
  currency_symbol: string;
  currency_decimals: string;
  // Station Defaults
  default_timezone: string;
  default_shift_duration: string;
  max_upload_file_size_mb: string;
  bulk_insert_chunk_size: string;
  // PDF Layout
  paper_size: string;
  logo_position: string;
  show_company_address: string;
  show_page_numbers: string;
  [key: string]: string;
}

// Default values used when settings are missing from DB
const DEFAULTS: SettingsMap = {
  company_name: 'EV Charging Station',
  company_logo_url: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  report_footer_text: '',
  currency_symbol: 'JOD',
  currency_decimals: '3',
  default_timezone: 'Asia/Amman',
  default_shift_duration: '12h',
  max_upload_file_size_mb: '10',
  bulk_insert_chunk_size: '250',
  paper_size: 'A4',
  logo_position: 'left',
  show_company_address: 'true',
  show_page_numbers: 'true',
};

/**
 * Fetch all settings as a flat key-value map.
 * Missing keys are filled from defaults.
 */
export async function getAllSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value');

  if (error) {
    console.error('Failed to fetch settings:', error);
    return { ...DEFAULTS };
  }

  const map: SettingsMap = { ...DEFAULTS };
  if (data) {
    for (const row of data) {
      map[row.key] = row.value;
    }
  }
  return map;
}

/**
 * Get a single setting value by key.
 */
export async function getSetting(key: string): Promise<string> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    return DEFAULTS[key] ?? '';
  }
  return data.value;
}

/**
 * Update a single setting. Creates if not exists.
 */
export async function updateSetting(
  key: string,
  value: string,
  category?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value,
      category: category || getCategoryForKey(key),
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    console.error('Failed to update setting:', error);
    throw error;
  }
}

/**
 * Update multiple settings at once.
 */
export async function updateSettings(
  settings: Record<string, string>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    category: getCategoryForKey(key),
    updated_by: user?.id || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('system_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Upload company logo to Supabase Storage and save URL to settings.
 */
export async function uploadCompanyLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `logos/company-logo.${ext}`;

  // Upload (overwrite if exists)
  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error('Logo upload failed:', uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage
    .from('company-assets')
    .getPublicUrl(path);

  const publicUrl = data.publicUrl;

  // Save URL to settings
  await updateSetting('company_logo_url', publicUrl, 'branding');

  return publicUrl;
}

/**
 * Get settings grouped by category.
 */
export async function getSettingsByCategory(): Promise<Record<string, SystemSetting[]>> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    console.error('Failed to fetch settings by category:', error);
    return {};
  }

  const grouped: Record<string, SystemSetting[]> = {};
  for (const row of data || []) {
    if (!grouped[row.category]) {
      grouped[row.category] = [];
    }
    grouped[row.category].push(row as SystemSetting);
  }
  return grouped;
}

// Helper: determine category from key name
function getCategoryForKey(key: string): string {
  if (key.startsWith('company_') || key.startsWith('currency_') || key.startsWith('report_')) {
    return 'branding';
  }
  if (key.startsWith('default_') || key.startsWith('max_') || key.startsWith('bulk_')) {
    return 'station_defaults';
  }
  if (key.startsWith('paper_') || key.startsWith('logo_') || key.startsWith('show_')) {
    return 'pdf_layout';
  }
  return 'branding';
}
