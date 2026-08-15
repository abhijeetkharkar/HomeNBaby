/**
 * lambda-reminder.js
 * Triggered daily by EventBridge.
 * Reads yesterday's logs and sends an SMS summary via SNS.
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// === OLD EMAIL REMINDER CODE (kept for reference) ===
/*
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

function classifyDate(dateStr, today, threshold) {
  if (!dateStr) return null;
  if (dateStr < today) return 'overdue';
  if (dateStr <= threshold) return 'approaching';
  return null;
}

function collectAlerts(task, today, threshold) { ... }
function formatDate(dateStr) { ... }
function buildEmailBody(alerts, recipientName) { ... }

exports.handler = async () => { ... }
*/

const REGION = 'us-east-1';
const TABLE_NAME = 'tracker-baby-logs';
const ABHIJEET_PHONE = process.env.ABHIJEET_PHONE;
const PRAJAKTA_PHONE = process.env.PRAJAKTA_PHONE;

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: REGION });

// Birth date is July 9, 2026
const BIRTH_DATE = new Date('2026-07-09T00:00:00');

function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

exports.handler = async () => {
    try {
        const yesterdayStr = getYesterdayStr();
        const yesterdayDate = new Date(yesterdayStr + 'T00:00:00');
        
        // Calculate day number from birth date
        const diffTime = yesterdayDate.getTime() - BIRTH_DATE.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // July 9 is Day 1

        const result = await ddb.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: '#d = :date',
            ExpressionAttributeNames: { '#d': 'date' },
            ExpressionAttributeValues: { ':date': yesterdayStr }
        }));

        const logs = result.Items || [];

        let feedCount = 0;
        let feedMin = 0;
        let diaperWet = 0;
        let diaperDirty = 0;
        let sleepHours = 0;
        let vitD = false;
        let massage = false;
        let bath = false;

        for (const log of logs) {
            if (log.category === 'feed') {
                feedCount++;
                feedMin += (log.durationMin || 0);
            } else if (log.category === 'diaper') {
                if (log.type === 'wet' || log.type === 'both') diaperWet++;
                if (log.type === 'dirty' || log.type === 'both') diaperDirty++;
            } else if (log.category === 'sleep') {
                sleepHours += ((log.durationMin || 0) / 60);
            } else if (log.category === 'vitaminD') {
                vitD = true;
            } else if (log.category === 'massage') {
                massage = true;
            } else if (log.category === 'bath') {
                bath = true;
            }
        }

        const diaperLogCount = logs.filter(l => l.category === 'diaper').length;

        // Message format example: 🌸 Snigdha Day 28: 9 feeds (185 min) | 11 diapers (7W 4D) | 14.5h sleep | VitD ✓ | Massage ✓ | Bath ✗
        const vitDStr = vitD ? '✓' : '✗';
        const massageStr = massage ? '✓' : '✗';
        const bathStr = bath ? '✓' : '✗';
        
        const sleepRounded = Math.round(sleepHours * 10) / 10;
        const message = `🌸 Snigdha Day ${diffDays}: ${feedCount} feeds (${feedMin} min) | ${diaperLogCount} diapers (${diaperWet}W ${diaperDirty}D) | ${sleepRounded}h sleep | VitD ${vitDStr} | Massage ${massageStr} | Bath ${bathStr}`;

        const phones = [];
        if (ABHIJEET_PHONE) phones.push(ABHIJEET_PHONE);
        if (PRAJAKTA_PHONE) phones.push(PRAJAKTA_PHONE);

        const sends = phones.map(phone => 
            snsClient.send(new PublishCommand({
                PhoneNumber: phone,
                Message: message
            }))
        );

        if (sends.length > 0) {
            await Promise.all(sends);
            console.log('SMS sent successfully to', phones.length, 'numbers');
        } else {
            console.log('No phone numbers configured');
        }

        return { statusCode: 200, body: 'Success' };
    } catch (err) {
        console.error('Error in lambda-reminder:', err);
        return { statusCode: 500, body: 'Error' };
    }
};
