const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables using Node's built-in support if .env exists
if (typeof process.loadEnvFile === 'function') {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (err) {
      console.warn('[Env] Warning loading .env file:', err.message);
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  !supabaseUrl.includes('your-project-ref')
);

let supabase = null;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err.message);
  }
}

/**
 * Returns the initialized Supabase client instance.
 * Throws a descriptive configuration error if credentials are not set.
 */
function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Please supply valid SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables in .env.'
    );
  }
  return supabase;
}

module.exports = {
  supabase,
  getSupabaseClient,
  isConfigured
};
