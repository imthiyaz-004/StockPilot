const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON payloads
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

const authRouter = require('./routes/auth');

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

module.exports = { app, server };
