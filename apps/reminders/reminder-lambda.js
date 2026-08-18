'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { PLANTS } = require('../plants/src/data/plants');

const REGION = 'us-east-1';
const TABLE_NAME = 'tracker-baby-logs';
const PLANTS_TABLE_NAME = process.env.PLANTS_TABLE_NAME || 'plants-care-logs';
const ABHIJEET_PHONE = process.env.ABHIJEET_PHONE;
const PRAJAKTA_PHONE = process.env.PRAJAKTA_PHONE;

// Email targets
const ABHIJEET_EMAIL = 'abhijeetkharkar@gmail.com';
const PRAJAKTA_EMAIL = 'prajaktap999@gmail.com';
const MOM_EMAIL = 'anupakharkar@gmail.com';
const FROM_EMAIL = 'reminders@abhijeetkharkar.com';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: REGION });
const sesClient = new SESClient({ region: REGION });

// Parse NOTIFICATIONS_MODE
let notificationsMode = { baby: 'sms', plants: 'email' };
if (process.env.NOTIFICATIONS_MODE) {
    try {
        notificationsMode = JSON.parse(process.env.NOTIFICATIONS_MODE);
    } catch (e) {
        console.error('Failed to parse NOTIFICATIONS_MODE', e);
    }
}

// Helpers
async function sendSMS(message, phoneNumbers) {
    if (!phoneNumbers || phoneNumbers.length === 0) return;
    const sends = phoneNumbers.map(phone => 
        snsClient.send(new PublishCommand({
            PhoneNumber: phone,
            Message: message
        }))
    );
    await Promise.all(sends);
    console.log(`SMS sent successfully to ${phoneNumbers.length} numbers`);
}

async function sendEmail(subject, htmlBody, toEmails) {
    if (!toEmails || toEmails.length === 0) return;
    
    // In SES Sandbox, if one email in ToAddresses is unverified, the entire batch fails.
    // We send individually so verified addresses still receive the email.
    for (const email of toEmails) {
        try {
            await sesClient.send(new SendEmailCommand({
                Source: FROM_EMAIL,
                Destination: { ToAddresses: [email] },
                Message: {
                    Subject: { Data: subject },
                    Body: { Html: { Data: htmlBody } }
                }
            }));
            console.log(`Email sent successfully to ${email}`);
        } catch (err) {
            console.error(`Failed to send email to ${email}:`, err.message);
        }
    }
}

function computeUrgency(lastDate, freqDays) {
    if (!lastDate) return { daysUntil: -999, status: 'never' };
    const last = new Date(lastDate);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - last.getTime()) / 86400000);
    const target = freqDays[1];
    const daysUntil = target - daysSince;
  
    let status;
    if (daysUntil < 0) status = 'overdue';
    else if (daysUntil === 0) status = 'due-today';
    else if (daysUntil <= 2) status = 'due-soon';
    else status = 'ok';
  
    return { daysUntil, status };
}

function getCentralDateStr(offsetDays = 0) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const now = new Date();
    if (offsetDays !== 0) {
        now.setDate(now.getDate() + offsetDays);
    }
    const parts = formatter.formatToParts(now);
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    const y = parts.find(p => p.type === 'year').value;
    return `${y}-${m}-${d}`;
}

async function fetchBabyLogsForDate(dateStr) {
    const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: '#d = :date',
        ExpressionAttributeNames: { '#d': 'date' },
        ExpressionAttributeValues: { ':date': dateStr }
    }));
    return result.Items || [];
}

async function sendBabyReminder(title, message) {
    if (notificationsMode.baby === 'email') {
        const html = `<h2>Baby Reminder</h2><p style="font-size: 16px;">${message.replace(/\n/g, '<br/>')}</p>`;
        await sendEmail(`🌸 ${title}`, html, [ABHIJEET_EMAIL, PRAJAKTA_EMAIL]);
    } else {
        const phones = [];
        if (ABHIJEET_PHONE) phones.push(ABHIJEET_PHONE);
        if (PRAJAKTA_PHONE) phones.push(PRAJAKTA_PHONE);
        await sendSMS(`🌸 Snigdha Reminder:\n${message}`, phones);
    }
}

async function processBabyReminders(check) {
    console.log(`Processing baby reminder for check: ${check}`);
    
    if (check === 'nails') {
        await sendBabyReminder('Nails Trimming Time', 'It is Sunday! Time to check and trim Snigdha\'s nails if needed 💅');
        return;
    }

    const todayStr = getCentralDateStr(0);
    const logsToday = await fetchBabyLogsForDate(todayStr);

    let tummyTimeCount = 0;
    let massageDone = false;
    let vitDDone = false;
    let bathDone = false;

    for (const log of logsToday) {
        if (log.category === 'tummyTime') tummyTimeCount++;
        else if (log.category === 'massage') massageDone = true;
        else if (log.category === 'vitaminD') vitDDone = true;
        else if (log.category === 'bath') bathDone = true;
    }

    if (check === 'tummyTime1') {
        if (tummyTimeCount < 1) {
            await sendBabyReminder('Tummy Time 1 Overdue', 'Tummy Time 1 (3-4 mins) has not been done yet today! 👶');
        }
    } else if (check === 'massage') {
        if (!massageDone) {
            await sendBabyReminder('Massage Overdue', 'Daily massage has not been done yet today! 💆‍♀️');
        }
    } else if (check === 'vitD_tummyTime2') {
        const alerts = [];
        if (!vitDDone) alerts.push('Vitamin D drops have not been given!');
        if (tummyTimeCount < 2) alerts.push(`Only ${tummyTimeCount} Tummy Time session(s) done today. Need at least 2!`);
        
        if (alerts.length > 0) {
            await sendBabyReminder('Evening Routines Overdue', alerts.join('\n\n'));
        }
    } else if (check === 'bath') {
        if (!bathDone) {
            const yesterdayStr = getCentralDateStr(-1);
            const logsYesterday = await fetchBabyLogsForDate(yesterdayStr);
            const bathYesterday = logsYesterday.some(l => l.category === 'bath');
            
            if (!bathYesterday) {
                await sendBabyReminder('Bath Overdue', 'No bath was given yesterday or today. Time for a bath! 🛁');
            }
        }
    }
}

async function processPlantReminders() {
    console.log('Processing plant reminders...');
    const result = await ddb.send(new ScanCommand({
        TableName: PLANTS_TABLE_NAME
    }));

    const logs = result.Items || [];
    const latestLogs = {};
    for (const log of logs) {
        const key = `${log.plantId}__${log.type}`;
        if (!latestLogs[key] || log.timestamp > latestLogs[key].timestamp) {
            latestLogs[key] = log;
        }
    }

    const overdueIndoor = [];
    const overdueOutdoor = [];

    for (const plant of PLANTS) {
        let isOverdue = false;
        let isWaterDue = false;
        let isFertDue = false;
        
        if (plant.waterFreqDays) {
            const lastWater = latestLogs[`${plant.id}__water`]?.timestamp;
            const waterUrg = computeUrgency(lastWater, plant.waterFreqDays);
            if (waterUrg.status === 'overdue' || waterUrg.status === 'never' || waterUrg.status === 'due-today') {
                isWaterDue = true;
            }
        }
        
        const lastFert = latestLogs[`${plant.id}__fertilize`]?.timestamp;
        const fertUrg = computeUrgency(lastFert, plant.fertFreqDays);
        if (fertUrg.status === 'overdue' || fertUrg.status === 'never' || fertUrg.status === 'due-today') {
            isFertDue = true;
        }

        let notes = [];
        if (plant.group === 'indoor') {
            // Smart Logic: Fertilize only if watering is due
            if (isWaterDue && isFertDue) {
                isOverdue = true;
                notes.push(`Needs Water + Fertilizer 💧🧪 (${plant.fertRecommendation})`);
            } else if (isWaterDue) {
                isOverdue = true;
                notes.push('Needs Water 💧');
            }
        } else {
            // Outdoor Logic: We only track fertilizer
            if (isFertDue) {
                isOverdue = true;
                notes.push(`Needs Fertilizer 🧪 (${plant.fertRecommendation})`);
            }
        }

        if (isOverdue) {
            const item = {
                name: `${plant.emoji} ${plant.name}`,
                notes: notes.join(', ')
            };
            if (plant.group === 'indoor') {
                overdueIndoor.push(item);
            } else {
                overdueOutdoor.push(item);
            }
        }
    }

    if (notificationsMode.plants === 'email') {
        if (overdueIndoor.length > 0) {
            const html = `<h2>Indoor Plants Care Reminder</h2><ul>` + 
                overdueIndoor.map(p => `<li><strong>${p.name}</strong>: ${p.notes}</li>`).join('') + 
                `</ul>`;
            await sendEmail('🪴 Indoor Plants Need Care!', html, [ABHIJEET_EMAIL, PRAJAKTA_EMAIL, MOM_EMAIL]);
        }
        if (overdueOutdoor.length > 0) {
            const html = `<h2>Outdoor Plants Care Reminder</h2><ul>` + 
                overdueOutdoor.map(p => `<li><strong>${p.name}</strong>: ${p.notes}</li>`).join('') + 
                `</ul>`;
            await sendEmail('☀️ Outdoor Plants Need Care!', html, [ABHIJEET_EMAIL]);
        }
    } else {
        const phones = [];
        if (ABHIJEET_PHONE) phones.push(ABHIJEET_PHONE);
        if (PRAJAKTA_PHONE) phones.push(PRAJAKTA_PHONE);
        
        let smsText = '';
        if (overdueIndoor.length > 0) {
            smsText += `🪴 Indoor: ${overdueIndoor.length} plants need care.\n`;
        }
        if (overdueOutdoor.length > 0) {
            smsText += `☀️ Outdoor: ${overdueOutdoor.length} plants need care.\n`;
        }
        if (smsText) {
            await sendSMS(`Plant Reminders:\n${smsText}Check the tracker app!`, phones);
        }
    }
}

exports.handler = async (event) => {
    try {
        const task = event.task;
        if (task === 'baby') {
            await processBabyReminders(event.check);
        } else if (task === 'plants') {
            await processPlantReminders();
        } else {
            console.log("No specific task provided. Running both by default (fallback mode).");
            await processBabyReminders('nails'); // just testing baby fallback
            await processPlantReminders();
        }
        return { statusCode: 200, body: 'Success' };
    } catch (err) {
        console.error('Error in lambda-reminder:', err);
        return { statusCode: 500, body: 'Error' };
    }
};
