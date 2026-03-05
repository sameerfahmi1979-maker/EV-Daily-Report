import dotenv from 'dotenv';

dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  server: {
    port: parseInt(process.env.OCPP_PORT || '9000', 10),
  },
  ocpp: {
    heartbeatInterval: 60,
    connectionTimeout: 300,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  env: process.env.NODE_ENV || 'development',
};

export function validateConfig() {
  const errors: string[] = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.serviceKey) {
    errors.push('SUPABASE_SERVICE_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
