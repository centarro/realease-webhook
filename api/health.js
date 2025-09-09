module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests'
    });
  }

  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      },
      config_check: {
        jira_base_url: process.env.JIRA_BASE_URL ? '✓ Set' : '✗ Missing',
        jira_email: process.env.JIRA_EMAIL ? '✓ Set' : '✗ Missing',
        jira_api_token: process.env.JIRA_API_TOKEN ? '✓ Set' : '✗ Missing',
        slack_webhook_url: process.env.SLACK_WEBHOOK_URL ? '✓ Set' : '✗ Missing'
      }
    };

    return res.status(200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    
    return res.status(500).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};