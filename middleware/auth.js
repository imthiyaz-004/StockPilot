const { verifyToken, createUserScopedClient } = require('../services/supabaseClient');

/**
 * Express middleware to verify Supabase JWT access tokens on protected routes.
 * Enforces authenticated identity from the cryptographically verified token only.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Authorization header with Bearer token is missing.'
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Bearer token is empty.'
    });
  }

  const { user, error } = await verifyToken(token);

  if (error || !user) {
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.'
    });
  }

  // Attach verified user identity and user-scoped Supabase client for RLS
  req.user = user;
  req.token = token;
  req.supabase = createUserScopedClient(token);

  next();
}

module.exports = {
  requireAuth
};
