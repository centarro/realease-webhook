# Jira Release Webhook - Local Setup Guide

## Step 1: Create Project Directory
```bash
mkdir jira-release-webhook
cd jira-release-webhook
```

## Step 2: Initialize Node.js Project
```bash
npm init -y
```

## Step 3: Install Dependencies
```bash
npm install express node-fetch
npm install -D nodemon  # For development
```

## Step 4: Create Main File
Create `index.js` and copy the webhook code from the previous artifact.

## Step 5: Get Jira API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name it "Webhook Integration"
4. Copy the generated token

## Step 6: Get Slack Webhook URL
1. Go to your Slack workspace
2. Navigate to https://api.slack.com/apps
3. Click "Create New App" → "From scratch"
4. Name: "Jira Releases", select your workspace
5. Go to "Incoming Webhooks" → Toggle "On"
6. Click "Add New Webhook to Workspace"
7. Select your target channel
8. Copy the webhook URL

## Step 7: Configure Environment Variables
Create `.env` file in your project root:
```env
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token-here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
PORT=3000
```

## Step 8: Update Code for Environment Variables
Add this to the top of `index.js` (after the requires):
```javascript
require('dotenv').config();

// Configuration from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
```

## Step 9: Install dotenv
```bash
npm install dotenv
```

## Step 10: Add Scripts to package.json
Update your `package.json` scripts section:
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Step 11: Create .gitignore
```gitignore
node_modules/
.env
*.log
.DS_Store
```

## Step 12: Start the Server
```bash
npm run dev
```

You should see: `Webhook server running on port 3000`

## Step 13: Test the Health Check
Open browser and go to: http://localhost:3000/health

Should return: `{"status":"OK","timestamp":"..."}`

## Step 14: Expose Locally (for Jira testing)
Install ngrok for public URL:
```bash
npm install -g ngrok
```

In another terminal:
```bash
ngrok http 3000
```

Copy the HTTPS URL (like `https://abc123.ngrok.io`)

## Step 15: Test with Sample Data
Use curl or Postman to test:
```bash
curl -X POST http://localhost:3000/jira-release \
  -H "Content-Type: application/json" \
  -d '{
    "issue": {
      "key": "TEST-123",
      "title": "Sample Release Test",
      "summary": "Sample Release Test"
    }
  }'
```

## Step 16: Configure Jira Automation
1. Go to Jira → Project Settings → Automation
2. Create rule with these settings:
   - **Trigger**: Issue transitioned
   - **From**: (your in-progress status)
   - **To**: (your released/done status)
   - **Action**: Send web request
     - Method: POST
     - URL: `https://your-ngrok-url.ngrok.io/jira-release`
     - Headers: `Content-Type: application/json`
     - Body:
     ```json
     {
       "issue": {
         "key": "{{issue.key}}",
         "title": "{{issue.title}}",
         "summary": "{{issue.summary}}"
       }
     }
     ```

## Project Structure
```
jira-release-webhook/
├── index.js          # Main webhook code
├── package.json      # Dependencies
├── .env             # Environment variables
├── .gitignore       # Git ignore rules
└── README.md        # Documentation
```

## Troubleshooting
- **Port 3000 in use**: Change PORT in .env to 3001, 8000, etc.
- **Jira API 401**: Verify email and API token are correct
- **Slack webhook fails**: Check webhook URL format
- **ngrok expires**: Free ngrok URLs expire after 8 hours

## Production Deployment
Once tested locally, deploy to:
- **Vercel**: `vercel --prod`
- **Heroku**: Push to Heroku git
- **AWS Lambda**: Use Serverless framework

Replace ngrok URL with production URL in Jira automation.