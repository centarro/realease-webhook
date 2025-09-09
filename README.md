# Jira Release Webhook

A serverless webhook service that integrates Jira releases with Slack notifications, optimized for Vercel deployment.

## Features

- 🚀 Serverless deployment on Vercel
- 📬 Rich Slack notifications for Jira releases
- 🔒 Secure environment variable management
- 🏥 Health check endpoint
- 📝 Comprehensive error handling and logging
- 🎯 CORS support for cross-origin requests

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/jira-release-webhook)

## Manual Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Vercel CLI](https://vercel.com/cli) installed globally
- Jira Cloud instance
- Slack workspace with webhook permissions

### 2. Installation

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `JIRA_BASE_URL`: Your Jira instance URL (e.g., `https://company.atlassian.net`)
- `JIRA_EMAIL`: Your Jira account email
- `JIRA_API_TOKEN`: [Generate API token](https://id.atlassian.com/manage-profile/security/api-tokens)
- `SLACK_WEBHOOK_URL`: [Create Slack incoming webhook](https://api.slack.com/messaging/webhooks)

### 4. Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Test health check
curl http://localhost:3000/health
```

### 5. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Set Environment Variables in Vercel

```bash
# Add environment variables
vercel env add JIRA_BASE_URL
vercel env add JIRA_EMAIL  
vercel env add JIRA_API_TOKEN
vercel env add SLACK_WEBHOOK_URL

# Redeploy with new environment variables
vercel --prod
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service status and configuration check.

### Webhook Endpoint
```
POST /jira-release
```

Processes Jira webhook payloads and sends Slack notifications.

**Expected payload:**
```json
{
  "issue": {
    "key": "PROJECT-123",
    "title": "Release Title",
    "summary": "Release Summary"
  }
}
```

## Jira Automation Setup

1. Go to **Project Settings** → **Automation** in your Jira project
2. Create a new rule with:
   - **Trigger**: Issue transitioned
   - **Conditions**: From status (In Progress) → To status (Released/Done)
   - **Action**: Send web request
     - Method: `POST`
     - URL: `https://your-vercel-deployment.vercel.app/jira-release`
     - Headers: `Content-Type: application/json`
     - Body:
     ```json
     {
       "issue": {
         "key": "{{issue.key}}",
         "title": "{{issue.summary}}",
         "summary": "{{issue.summary}}"
       }
     }
     ```

## Testing

Test the webhook locally or in production:

```bash
curl -X POST https://your-deployment.vercel.app/jira-release \
  -H "Content-Type: application/json" \
  -d '{
    "issue": {
      "key": "TEST-123",
      "title": "Test Release",
      "summary": "Testing webhook integration"
    }
  }'
```

## Architecture

```
├── api/
│   ├── jira-release.js    # Main webhook handler
│   └── health.js          # Health check endpoint
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
├── .env.example           # Environment template
└── index.js               # Local development server
```

## Error Handling

The service includes comprehensive error handling:
- Input validation
- Jira API error handling
- Slack webhook error handling
- Environment configuration validation
- Detailed logging for debugging

## Security

- Environment variables are securely managed
- CORS headers are properly configured
- Input validation prevents injection attacks
- No sensitive data is logged

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details.