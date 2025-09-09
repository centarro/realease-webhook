require('dotenv').config();
const express = require('express');
const jiraReleaseHandler = require('./api/jira-release');
const healthHandler = require('./api/health');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Wrapper function to convert Vercel API handlers to Express middleware
const vercelToExpress = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
};

// Routes
app.get('/health', vercelToExpress(healthHandler));
app.post('/jira-release', vercelToExpress(jiraReleaseHandler));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Jira Release Webhook',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/jira-release'
    },
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Jira Release Webhook server running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/jira-release`);
  });
}

module.exports = app;