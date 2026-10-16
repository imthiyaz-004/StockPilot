const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

// Ensure environment variables from .env are loaded
if (typeof process.loadEnvFile === 'function') {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (_) {}
  }
}

/**
 * Validate required startup environment variables.
 * Fails fast on server boot if critical Supabase configuration is missing.
 * GEMINI_API_KEY is optional for core inventory operations.
 */
function validateStartupEnv({ exitOnError = (require.main === module) } = {}) {
  const errors = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.trim() || supabaseUrl.includes('your-project-ref')) {
    errors.push('SUPABASE_URL is missing or using placeholder value.');
  }

  if (
    !supabaseKey ||
    !supabaseKey.trim() ||
    supabaseKey.includes('your-supabase-publishable-or-anon-key') ||
    supabaseKey.includes('your_supabase_anon_key')
  ) {
    errors.push('SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) is missing or using placeholder value.');
  }

  if (errors.length > 0) {
    console.error('\n[FATAL STARTUP ERROR] Missing or invalid required environment variables:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('Please configure your .env file or environment variables before running StockPilot.\n');

    if (exitOnError) {
      process.exit(1);
    }
  }

  return errors;
}

// Run startup environment check
validateStartupEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// Reverse proxy trust configuration
// When deployed behind a reverse proxy (Render, Fly.io, Heroku, AWS ALB, Nginx),
// TRUST_PROXY should be set (e.g. TRUST_PROXY=1) so req.ip uses the trusted proxy client IP.
// Defaults to false to prevent client IP spoofing via forwarded headers.
if (process.env.TRUST_PROXY) {
  const trustVal = process.env.TRUST_PROXY.trim();
  if (/^\d+$/.test(trustVal)) {
    app.set('trust proxy', parseInt(trustVal, 10));
  } else if (trustVal.toLowerCase() === 'true') {
    app.set('trust proxy', true);
  } else if (trustVal.toLowerCase() === 'false') {
    app.set('trust proxy', false);
  } else {
    app.set('trust proxy', trustVal);
  }
}

// HTTP Security Headers via Helmet
// Configured to permit Google Fonts and inline styles while strictly controlling script sources
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Parse incoming JSON payloads
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

const authRouter = require('./routes/auth');
const businessesRouter = require('./routes/businesses');
const productsRouter = require('./routes/products');
const suppliersRouter = require('./routes/suppliers');
const salesRouter = require('./routes/sales');
const purchasesRouter = require('./routes/purchases');
const analyticsRouter = require('./routes/analytics');
const aiRouter = require('./routes/ai');

// API health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'StockPilot API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// Business onboarding and management routes
app.use('/api/businesses', businessesRouter);

// Product and Inventory routes
app.use('/api/products', productsRouter);

// Suppliers routes
app.use('/api/suppliers', suppliersRouter);

// Sales routes
app.use('/api/sales', salesRouter);

// Purchases routes
app.use('/api/purchases', purchasesRouter);

// Dashboard Analytics routes
app.use('/api/analytics', analyticsRouter);

// AI Inventory Analyst routes
app.use('/api/ai', aiRouter);

// Catch-all handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Centralized error handling middleware
// Prevents leaking stack traces or internal environment variables
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(err.status || 500).json({
    error: 'An internal server error occurred.'
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`StockPilot server is running on http://localhost:${PORT}`);
});

module.exports = { app, server, validateStartupEnv };
