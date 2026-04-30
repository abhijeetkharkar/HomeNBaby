/**
 * lambda-reminder.js
 * Triggered daily by EventBridge at 8:00 AM Central.
 * Scans DynamoDB for overdue tasks/items and those due within 3 days,
 * then sends a grouped email via SES to the relevant assignees.
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const REGION = 'us-east-1';
const TABLE_NAME = process.env.TABLE_NAME || 'tracker-tasks';
const FROM_EMAIL = process.env.FROM_EMAIL || 'reminders@tracker.abhijeetkharkar.com';
const ABHIJEET_EMAIL = 'abhijeetkharkar@gmail.com';
const PRAJAKTA_EMAIL = 'prajaktap999@gmail.com';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const ses = new SESClient({ region: REGION });

function getTodayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getThresholdStr() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split('T')[0];
}

/**
 * Returns 'overdue' | 'approaching' | null for a given date string.
 */
function classifyDate(dateStr, today, threshold) {
  if (!dateStr) return null;
  if (dateStr < today) return 'overdue';
  if (dateStr <= threshold) return 'approaching';
  return null;
}

/**
 * Collect all alerts for a task.
 * Returns array of { status, taskName, itemName (optional), dueDate, owner }
 */
function collectAlerts(task, today, threshold) {
  const alerts = [];

  // Task-level date (rare — only id:7 still has one)
  if (task.target_date && !task.completed) {
    const status = classifyDate(task.target_date, today, threshold);
    if (status && task.owner && task.owner !== 'null') {
      alerts.push({ status, taskName: task.task, itemName: null, dueDate: task.target_date, owner: task.owner });
    }
  }

  // Subtask-level
  for (const subtask of (task.subtasks || [])) {
    if (subtask.done) continue;
    const effectiveOwner = task.owner || subtask.owner;
    if (!effectiveOwner) continue;

    if (subtask.due) {
      const status = classifyDate(subtask.due, today, threshold);
      if (status) {
        alerts.push({ status, taskName: task.task, itemName: subtask.text, dueDate: subtask.due, owner: effectiveOwner });
      }
    }

    // Nested items
    for (const item of (subtask.items || [])) {
      if (item.done) continue;
      const itemOwner = effectiveOwner || item.owner;
      if (!itemOwner) continue;
      if (item.due) {
        const status = classifyDate(item.due, today, threshold);
        if (status) {
          alerts.push({ status, taskName: task.task, itemName: item.text, dueDate: item.due, owner: itemOwner });
        }
      }
    }
  }

  return alerts;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildEmailBody(alerts, recipientName) {
  const overdue = alerts.filter(a => a.status === 'overdue');
  const approaching = alerts.filter(a => a.status === 'approaching');

  let text = `Hi ${recipientName},\n\nHere's your daily Home & Baby Tracker reminder.\n\n`;
  let html = `<p>Hi ${recipientName},</p><p>Here's your daily <strong>Home &amp; Baby Tracker</strong> reminder.</p>`;

  if (overdue.length > 0) {
    text += `🔴 OVERDUE (${overdue.length})\n`;
    html += `<h3 style="color:#d32f2f">🔴 Overdue (${overdue.length})</h3><ul>`;
    for (const a of overdue) {
      const line = a.itemName
        ? `${a.taskName} → ${a.itemName} (due ${formatDate(a.dueDate)})`
        : `${a.taskName} (due ${formatDate(a.dueDate)})`;
      text += `  • ${line}\n`;
      html += `<li><strong>${a.taskName}</strong>${a.itemName ? ` → ${a.itemName}` : ''} <span style="color:#d32f2f">(due ${formatDate(a.dueDate)})</span></li>`;
    }
    text += '\n';
    html += '</ul>';
  }

  if (approaching.length > 0) {
    text += `🟡 DUE WITHIN 3 DAYS (${approaching.length})\n`;
    html += `<h3 style="color:#e65100">🟡 Due Within 3 Days (${approaching.length})</h3><ul>`;
    for (const a of approaching) {
      const line = a.itemName
        ? `${a.taskName} → ${a.itemName} (due ${formatDate(a.dueDate)})`
        : `${a.taskName} (due ${formatDate(a.dueDate)})`;
      text += `  • ${line}\n`;
      html += `<li><strong>${a.taskName}</strong>${a.itemName ? ` → ${a.itemName}` : ''} <span style="color:#e65100">(due ${formatDate(a.dueDate)})</span></li>`;
    }
    text += '\n';
    html += '</ul>';
  }

  text += `View tracker: https://tracker.abhijeetkharkar.com\n`;
  html += `<p><a href="https://tracker.abhijeetkharkar.com">Open Tracker →</a></p>`;

  return { text, html };
}

exports.handler = async () => {
  const today = getTodayStr();
  const threshold = getThresholdStr();

  // Fetch all incomplete tasks
  const result = await ddb.send(new ScanCommand({ TableName: TABLE_NAME }));
  const tasks = (result.Items || []).filter(t => !t.completed);

  // Collect alerts per owner
  const abhijeetAlerts = [];
  const prajaktaAlerts = [];

  for (const task of tasks) {
    const alerts = collectAlerts(task, today, threshold);
    for (const alert of alerts) {
      const o = alert.owner;
      if (o === 'Abhijeet' || o === 'Both') abhijeetAlerts.push(alert);
      if (o === 'Prajakta' || o === 'Both') prajaktaAlerts.push(alert);
    }
  }

  const sends = [];

  if (abhijeetAlerts.length > 0) {
    const { text, html } = buildEmailBody(abhijeetAlerts, 'Abhijeet');
    const overdue = abhijeetAlerts.filter(a => a.status === 'overdue').length;
    const approaching = abhijeetAlerts.filter(a => a.status === 'approaching').length;
    const subject = `🏠 Tracker Reminder: ${overdue > 0 ? `${overdue} overdue` : ''}${overdue > 0 && approaching > 0 ? ', ' : ''}${approaching > 0 ? `${approaching} due soon` : ''}`;
    sends.push(ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [ABHIJEET_EMAIL] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    })));
    console.log(`Sending to Abhijeet: ${abhijeetAlerts.length} alerts`);
  }

  if (prajaktaAlerts.length > 0) {
    const { text, html } = buildEmailBody(prajaktaAlerts, 'Prajakta');
    const overdue = prajaktaAlerts.filter(a => a.status === 'overdue').length;
    const approaching = prajaktaAlerts.filter(a => a.status === 'approaching').length;
    const subject = `🏠 Tracker Reminder: ${overdue > 0 ? `${overdue} overdue` : ''}${overdue > 0 && approaching > 0 ? ', ' : ''}${approaching > 0 ? `${approaching} due soon` : ''}`;
    sends.push(ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [PRAJAKTA_EMAIL] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    })));
    console.log(`Sending to Prajakta: ${prajaktaAlerts.length} alerts`);
  }

  if (sends.length === 0) {
    console.log('No alerts today — no emails sent.');
    return { statusCode: 200, body: 'No alerts' };
  }

  await Promise.all(sends);
  console.log('Reminder emails sent successfully.');
  return { statusCode: 200, body: 'Emails sent' };
};
