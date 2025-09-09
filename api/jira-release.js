const fetch = require('node-fetch');

// Configuration from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function getJiraIssueDetails(issueKey) {
  try {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
    const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
    }

    const issue = await response.json();
    return {
      key: issue.key,
      summary: issue.fields.summary,
      description: issue.fields.description?.content?.[0]?.content?.[0]?.text || 'No description',
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      priority: issue.fields.priority?.name || 'None',
      issueType: issue.fields.issuetype.name,
      url: `${JIRA_BASE_URL}/browse/${issue.key}`,
      created: issue.fields.created,
      updated: issue.fields.updated
    };
  } catch (error) {
    console.error('Error fetching Jira issue details:', error);
    throw error;
  }
}

async function sendSlackNotification(issueDetails) {
  try {
    const slackMessage = {
      text: `🚀 *New Release: ${issueDetails.key}*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🚀 *New Release: ${issueDetails.key}*\n*${issueDetails.summary}*`
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View in Jira"
              },
              url: issueDetails.url,
              action_id: "view_jira_issue"
            }
          ]
        }
      ]
    };

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook error: ${response.status} ${response.statusText}`);
    }

    return { success: true, message: 'Slack notification sent successfully' };
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    throw error;
  }
}

function validateEnvironmentVariables() {
  const required = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'SLACK_WEBHOOK_URL'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JIRA_BASE_URL format
  const jiraUrl = process.env.JIRA_BASE_URL;
  if (!jiraUrl.startsWith('http://') && !jiraUrl.startsWith('https://')) {
    throw new Error('JIRA_BASE_URL must be a valid URL starting with http:// or https://');
  }

  // Validate SLACK_WEBHOOK_URL format
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackUrl.startsWith('https://hooks.slack.com/')) {
    throw new Error('SLACK_WEBHOOK_URL must be a valid Slack webhook URL');
  }
}

function validateRequestBody(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a valid JSON object');
  }

  if (!body.issue || !body.issue.key) {
    throw new Error('Request body must contain issue.key');
  }

  return true;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  try {
    // Validate environment variables
    validateEnvironmentVariables();
    
    // Validate request body
    validateRequestBody(req.body);
    
    console.log('Received webhook payload:', JSON.stringify(req.body, null, 2));
    
    const issueKey = req.body.issue.key;
    
    // Get detailed issue information from Jira
    const issueDetails = await getJiraIssueDetails(issueKey);
    console.log('Retrieved issue details:', issueDetails);
    
    // Send notification to Slack
    const slackResult = await sendSlackNotification(issueDetails);
    console.log('Slack notification result:', slackResult);
    
    return res.status(200).json({
      success: true,
      message: 'Release notification sent successfully',
      issue: {
        key: issueDetails.key,
        summary: issueDetails.summary,
        status: issueDetails.status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};