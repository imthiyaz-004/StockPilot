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
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err.message);
  }
}

/**
 * Returns the base initialized Supabase client instance.
 * Throws a descriptive error if credentials are not configured.
 */
function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Please supply valid SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.'
    );
  }
  return supabase;
}

/**
 * Creates an isolated, user-scoped Supabase client for a specific access token.
 * This client sends the caller's JWT in the Authorization header to PostgREST,
 * ensuring PostgreSQL's Row Level Security (RLS) evaluates auth.uid() to the actual user.
 *
 * @param {string} accessToken - Verified Supabase user JWT access token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createUserScopedClient(accessToken) {
  if (!isConfigured) {
    throw new Error('Supabase client is not configured.');
  }
  if (!accessToken) {
    throw new Error('An access token is required to create a user-scoped client.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

/**
 * Verifies a JWT access token directly against the Supabase Auth server.
 * Never trusts client-reported user IDs.
 *
 * @param {string} accessToken
 * @returns {Promise<{ user: object|null, error: object|null }>}
 */
async function verifyToken(accessToken) {
  if (!isConfigured) {
    return { user: null, error: new Error('Supabase is not configured') };
  }
  if (!accessToken || typeof accessToken !== 'string') {
    return { user: null, error: new Error('Invalid or missing access token') };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data || !data.user) {
      return { user: null, error: error || new Error('User not found for token') };
    }
    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}

module.exports = {
  supabase,
  getSupabaseClient,
  createUserScopedClient,
  verifyToken,
  isConfigured
};
