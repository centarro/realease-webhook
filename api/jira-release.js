const fetch = require('node-fetch');

// Configuration from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

async function getJiraIssueDetails(issueKey) {
  try {
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
    const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}?expand=issuelinks`;
    
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
    
    // Extract blocking issues with their Drupal Issue IDs
    const blockingIssues = [];
    if (issue.fields.issuelinks) {
      for (const link of issue.fields.issuelinks) {
        // Check if this issue was blocked by another issue
        if (link.type.name === 'Blocks' && link.inwardIssue) {
          // Get detailed info for the blocking issue to fetch Drupal Issue ID
          const blockingIssueDetails = await getBlockingIssueDetails(link.inwardIssue.key, auth);
          blockingIssues.push(blockingIssueDetails);
        }
      }
    }
    
    return {
      key: issue.key,
      summary: issue.fields.summary,
      url: `${JIRA_BASE_URL}/browse/${issue.key}`,
      blockingIssues: blockingIssues
    };
  } catch (error) {
    console.error('Error fetching Jira issue details:', error);
    throw error;
  }
}

async function getBlockingIssueDetails(issueKey, auth) {
  try {
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
      console.error(`Failed to fetch blocking issue ${issueKey}: ${response.status}`);
      return {
        key: issueKey,
        summary: 'Could not fetch issue details',
        drupalUrl: null
      };
    }

    const issue = await response.json();
    
    // Look for Drupal Issue ID in custom fields
    let drupalIssueId = null;
    const fields = issue.fields;
    
    // First, try to get field metadata to find the exact field ID for "Drupal Issue ID"
    try {
      const fieldsResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/field`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });
      
      if (fieldsResponse.ok) {
        const fieldDefinitions = await fieldsResponse.json();
        const drupalField = fieldDefinitions.find(field => 
          field.name && field.name.toLowerCase().includes('drupal') && 
          field.name.toLowerCase().includes('issue') &&
          field.name.toLowerCase().includes('id')
        );
        
        if (drupalField && fields[drupalField.id]) {
          drupalIssueId = fields[drupalField.id];
        }
      }
    } catch (fieldError) {
      console.error('Error fetching field definitions:', fieldError);
    }
    
    // Fallback: Search for numeric custom fields if the specific field wasn't found
    if (!drupalIssueId) {
      for (const fieldKey in fields) {
        const fieldValue = fields[fieldKey];
        if (fieldKey.includes('customfield') && fieldValue) {
          if (typeof fieldValue === 'number' || (typeof fieldValue === 'string' && /^\d+$/.test(fieldValue))) {
            drupalIssueId = fieldValue;
            break;
          }
        }
      }
    }
    
    return {
      key: issue.key,
      summary: issue.fields.summary,
      drupalUrl: drupalIssueId ? `https://www.drupal.org/i/${drupalIssueId}` : null,
      drupalIssueId: drupalIssueId
    };
  } catch (error) {
    console.error(`Error fetching blocking issue ${issueKey}:`, error);
    return {
      key: issueKey,
      summary: 'Could not fetch issue details',
      drupalUrl: null
    };
  }
}

async function sendSlackNotification(issueDetails) {
  try {
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚀 *New Release* *${issueDetails.summary}*`
        }
      }
    ];

    // Add blocking issues if any exist
    if (issueDetails.blockingIssues && issueDetails.blockingIssues.length > 0) {
      const blockingText = issueDetails.blockingIssues
        .map(issue => {
          if (issue.drupalUrl) {
            return `• <${issue.drupalUrl}|${issue.summary}>`;
          } else {
            return `• ${issue.summary}`;
          }
        })
        .join('\n');
      
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Issues included in this release:*\n${blockingText}`
        }
      });
    }

    // Add the action button
    blocks.push({
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
    });

    const slackMessage = {
      text: `🚀 *New Release*`,
      blocks: blocks
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