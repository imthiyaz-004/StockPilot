const express = require('express');
const { getSupabaseClient, createUserScopedClient } = require('../services/supabaseClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Validate standard email format
 */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * POST /api/auth/register
 * Handles user sign-up using Supabase Auth.
 * Passwords are never stored in our own database.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Check if session was granted immediately or requires email confirmation
    if (!data.session) {
      return res.status(201).json({
        status: 'unverified',
        message: 'Registration successful. A confirmation email has been sent. Please confirm your email before logging in.',
        user: {
          id: data.user?.id,
          email: data.user?.email
        }
      });
    }

    return res.status(201).json({
      status: 'authenticated',
      message: 'Registration successful.',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      },
      user: {
        id: data.user?.id,
        email: data.user?.email
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials via Supabase Auth.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      // Differentiate unverified email from bad credentials
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return res.status(403).json({
          error: 'Email address has not been confirmed yet. Please verify your email via the confirmation link.'
        });
      }
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        return res.status(401).json({
          error: 'Invalid email or password.'
        });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      status: 'authenticated',
      message: 'Login successful.',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in
      },
      user: {
        id: data.user?.id,
        email: data.user?.email,
        last_sign_in_at: data.user?.last_sign_in_at
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Terminates the active session in Supabase.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const scopedClient = createUserScopedClient(token);
          await scopedClient.auth.signOut();
        } catch {
          // Proceed with local logout even if remote revocation fails
        }
      }
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Logged out successfully.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Protected route to verify current token and return authenticated profile.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    status: 'ok',
    user: {
      id: req.user.id,
      email: req.user.email,
      last_sign_in_at: req.user.last_sign_in_at,
      created_at: req.user.created_at
    }
  });
});

/**
 * GET /api/auth/test-rls
 * Protected route to verify database query execution under the caller's RLS context.
 */
router.get('/test-rls', requireAuth, async (req, res, next) => {
  try {
    // Queries businesses table strictly under the authenticated user's RLS context
    const { data, error, status } = await req.supabase
      .from('businesses')
      .select('id, name, currency, created_at');

    if (error) {
      return res.status(status || 500).json({
        error: 'Database query failed under authenticated user context.',
        details: error.message
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Authenticated RLS query succeeded.',
      verifiedUserId: req.user.id,
      accessibleBusinessesCount: data ? data.length : 0,
      businesses: data || []
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
