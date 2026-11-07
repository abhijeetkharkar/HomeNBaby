'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const REGION = 'us-east-1';
const TABLE_NAME = process.env.TABLE_NAME || 'baby-tracker-logs';
const USER_HOMES_TABLE = process.env.USER_HOMES_TABLE_NAME || 'plants-user-homes';
const HOMES_TABLE = process.env.HOMES_TABLE_NAME || 'plants-homes';
const HOME_PLANTS_TABLE = process.env.HOME_PLANTS_TABLE_NAME || 'plants-home-plants';
const CATALOG_TABLE = process.env.CATALOG_TABLE_NAME || 'plants-catalog';
const CARE_LOGS_V2_TABLE = process.env.CARE_LOGS_V2_TABLE_NAME || 'plants-care-logs-v2';

const ABHIJEET_PHONE = process.env.ABHIJEET_PHONE;
const PRAJAKTA_PHONE = process.env.PRAJAKTA_PHONE;

// Email targets for baby reminders
const ABHIJEET_EMAIL = 'abhijeetkharkar@gmail.com';
const PRAJAKTA_EMAIL = 'prajaktap999@gmail.com';
const FROM_EMAIL = 'plants@abhijeetkharkar.com';
const BABY_FROM_EMAIL = 'reminders@abhijeetkharkar.com';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
});
const snsClient = new SNSClient({ region: REGION });
const sesClient = new SESClient({ region: REGION });

// Parse NOTIFICATIONS_MODE for baby
let notificationsMode = { baby: 'email', plants: 'email' };
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
    const sends = phoneNumbers.map(phone => {
        const formatted = phone.startsWith('+') ? phone : (phone.length === 10 ? `+1${phone}` : `+${phone}`);
        return snsClient.send(new PublishCommand({
            PhoneNumber: formatted,
            Message: message
        }));
    });
    await Promise.all(sends);
    console.log(`SMS sent successfully to ${phoneNumbers.length} numbers`);
}

async function sendEmail(subject, htmlBody, toEmails, fromAddress = FROM_EMAIL) {
    if (!toEmails || toEmails.length === 0) return;
    for (const email of toEmails) {
        try {
            await sesClient.send(new SendEmailCommand({
                Source: fromAddress,
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
    const target = Array.isArray(freqDays) ? (freqDays[1] || freqDays[0]) : freqDays;
    if (!target) return { daysUntil: 999, status: 'ok' };
    const daysUntil = target - daysSince;

    let status;
    if (daysUntil < 0) status = 'overdue';
    else if (daysUntil === 0) status = 'due-today';
    else if (daysUntil <= 2) status = 'due-soon';
    else status = 'ok';

    return { daysUntil, status };
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderPlantTable(plants) {
    if (!plants || plants.length === 0) return '';
    
    let rowsHtml = '';
    for (let i = 0; i < plants.length; i++) {
        const p = plants[i];
        const isLast = i === plants.length - 1;
        const rowBorder = isLast ? '' : 'border-bottom: 1px solid #eef6f1;';
        
        const waterBadge = p.isWaterDue
            ? `<span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background-color: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; white-space: nowrap;">${p.isSelfWatering ? 'Refill' : 'Due'}</span>`
            : `<span style="color: #94a3b8; font-size: 14px; font-weight: 500;">—</span>`;

        let fertHtml = '';
        if (p.isFertDue) {
            const fertText = p.fertRecommendation || 'Feed';
            fertHtml = `
                <div style="margin-top: 5px;">
                    <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; line-height: 1.3;">
                        🧪 ${escapeHtml(fertText)}
                    </span>
                </div>
            `;
        }

        rowsHtml += `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#fcfdfc'};">
                <td style="padding: 12px 14px; vertical-align: middle; ${rowBorder}">
                    <div style="font-size: 14px; font-weight: 600; color: #1d3527; line-height: 1.35;">
                        ${escapeHtml(p.name)}
                    </div>
                    ${p.homeName ? `<div style="font-size: 12px; color: #647b6a; margin-top: 2px;">${escapeHtml(p.homeName)}</div>` : ''}
                    ${fertHtml}
                </td>
                <td style="padding: 12px 14px; text-align: right; vertical-align: middle; ${rowBorder}">
                    ${waterBadge}
                </td>
            </tr>
        `;
    }

    return `
        <table role="presentation" style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 8px; margin-bottom: 24px; border: 1px solid rgba(46, 167, 111, 0.18); border-radius: 12px; overflow: hidden; background: #ffffff;">
            <thead>
                <tr style="background-color: #f4fdf8; border-bottom: 1px solid rgba(46, 167, 111, 0.18); text-align: left;">
                    <th style="padding: 12px 14px; font-size: 12px; font-weight: 700; color: #647b6a; text-transform: uppercase; letter-spacing: 0.05em; width: 72%;">Plant & Care</th>
                    <th style="padding: 12px 14px; font-size: 12px; font-weight: 700; color: #647b6a; text-transform: uppercase; letter-spacing: 0.05em; text-align: right; width: 28%;">Water 💧</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
}

function buildEmailHtml(userIndoor, userOutdoor, recipientName = 'there') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plants Care Reminder</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; }
        @media screen and (max-width: 600px) {
            .email-container { width: 100% !important; margin: auto !important; }
            .header-padding { padding: 20px 16px !important; }
            .content-padding { padding: 16px 12px !important; }
            .footer-padding { padding: 20px 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4fdf8; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d3527;">
    <div style="background-color: #f4fdf8; padding: 32px 12px; width: 100%; box-sizing: border-box;">
        <table role="presentation" class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(46, 167, 111, 0.2); box-shadow: 0 4px 16px rgba(46, 167, 111, 0.08); overflow: hidden; border-spacing: 0;">
            <!-- Header -->
            <tr>
                <td class="header-padding" style="padding: 24px 28px 20px 28px; background: linear-gradient(180deg, #e6f7ec 0%, #ffffff 100%); border-bottom: 1px solid rgba(46, 167, 111, 0.12);">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td>
                                <div style="display: inline-block; font-size: 24px; font-weight: 700; color: #1d3527; letter-spacing: -0.01em;">
                                    Hi ${escapeHtml(recipientName)} 👋
                                </div>
                                <div style="margin-top: 4px; font-size: 14px; color: #647b6a; font-weight: 500;">
                                    Plants Tracker &bull; Here are your plants needing attention today
                                </div>
                            </td>
                        </tr>
                    </table>

                    <!-- Summary Badges -->
                    <div style="margin-top: 14px;">
                        ${userIndoor.length > 0 ? `
                            <span style="display: inline-block; padding: 5px 12px; margin-right: 8px; margin-bottom: 6px; border-radius: 20px; font-size: 12px; font-weight: 600; background-color: #ffffff; color: #1d3527; border: 1px solid rgba(46, 167, 111, 0.25);">
                                🏠 Indoor: <strong>${userIndoor.length} Due</strong>
                            </span>
                        ` : ''}
                        ${userOutdoor.length > 0 ? `
                            <span style="display: inline-block; padding: 5px 12px; margin-right: 8px; margin-bottom: 6px; border-radius: 20px; font-size: 12px; font-weight: 600; background-color: #ffffff; color: #1d3527; border: 1px solid rgba(46, 167, 111, 0.25);">
                                🪴 Outdoor: <strong>${userOutdoor.length} Due</strong>
                            </span>
                        ` : ''}
                    </div>
                </td>
            </tr>

            <!-- Content -->
            <tr>
                <td class="content-padding" style="padding: 24px 24px 12px 24px;">
                    ${userIndoor.length > 0 ? `
                        <div style="margin-bottom: 24px;">
                            <h2 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #1d3527;">
                                🏠 Indoor Plants <span style="font-size: 12px; font-weight: 600; color: #647b6a; background-color: #e6f7ec; padding: 2px 8px; border-radius: 12px; margin-left: 6px; vertical-align: middle;">${userIndoor.length}</span>
                            </h2>
                            ${renderPlantTable(userIndoor)}
                        </div>
                    ` : ''}

                    ${userOutdoor.length > 0 ? `
                        <div style="margin-bottom: 24px;">
                            <h2 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #1d3527;">
                                🪴 Outdoor Plants <span style="font-size: 12px; font-weight: 600; color: #647b6a; background-color: #e6f7ec; padding: 2px 8px; border-radius: 12px; margin-left: 6px; vertical-align: middle;">${userOutdoor.length}</span>
                            </h2>
                            ${renderPlantTable(userOutdoor)}
                        </div>
                    ` : ''}
                </td>
            </tr>

            <!-- Footer CTA Matching App Theme -->
            <tr>
                <td class="footer-padding" style="padding: 24px 28px; background-color: #f4fdf8; border-top: 1px solid rgba(46, 167, 111, 0.12); text-align: center;">
                    <a href="https://plants.abhijeetkharkar.com" target="_blank" style="display: inline-block; background-color: #2ea76f; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 12px; box-shadow: 0 2px 8px rgba(46, 167, 111, 0.28);">
                        Open Plants Tracker
                    </a>
                    <div style="margin-top: 14px; font-size: 12px; color: #647b6a; line-height: 1.5;">
                        Log care or manage your notification preferences in Account Settings.
                    </div>
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;
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
        await sendEmail(`🌸 ${title}`, html, [ABHIJEET_EMAIL, PRAJAKTA_EMAIL], BABY_FROM_EMAIL);
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

async function scanAllItems(tableName) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const res = await ddb.send(new ScanCommand({
            TableName: tableName,
            ExclusiveStartKey,
        }));
        if (res.Items) items.push(...res.Items);
        ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

async function queryHomeItems(tableName, homeId) {
    const items = [];
    let ExclusiveStartKey;
    do {
        const res = await ddb.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'homeId = :hid',
            ExpressionAttributeValues: { ':hid': homeId },
            ExclusiveStartKey,
        }));
        if (res.Items) items.push(...res.Items);
        ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
}

async function processPlantReminders() {
    console.log('Processing multi-user plant reminders...');

    // 1. Load catalog plants map
    const catalogItems = await scanAllItems(CATALOG_TABLE);
    const catalogMap = new Map();
    for (const item of catalogItems) {
        catalogMap.set(item.plantId, item);
    }
    console.log(`Loaded ${catalogMap.size} plants from catalog.`);

    // 2. Scan plants-user-homes to find all user profiles and memberships
    const userHomesItems = await scanAllItems(USER_HOMES_TABLE);

    // Group memberships by user email, and collect profile records
    const userProfiles = new Map(); // email -> profile item
    const userHomes = new Map();    // email -> Set of homeIds

    for (const item of userHomesItems) {
        const email = String(item.email || '').toLowerCase().trim();
        if (!email) continue;

        if (item.homeId === 'PROFILE') {
            userProfiles.set(email, item);
        } else {
            if (!userHomes.has(email)) userHomes.set(email, new Set());
            userHomes.get(email).add(item.homeId);
        }
    }

    console.log(`Found ${userProfiles.size} user profiles and ${userHomes.size} users with homes.`);

    // 3. Cache home names and home plant calculations
    const homeNames = new Map();
    const homeOverdueCache = new Map(); // homeId -> { overdueIndoor: [], overdueOutdoor: [] }

    async function getHomeOverdue(homeId) {
        if (homeOverdueCache.has(homeId)) return homeOverdueCache.get(homeId);

        // Fetch home metadata for name
        let name = homeNames.get(homeId);
        if (!name) {
            try {
                const hRes = await ddb.send(new GetCommand({
                    TableName: HOMES_TABLE,
                    Key: { homeId }
                }));
                name = hRes.Item?.name || 'Garden Home';
            } catch (e) {
                name = 'Garden Home';
            }
            homeNames.set(homeId, name);
        }

        // Fetch plants and logs
        const [homePlantRows, careLogRows] = await Promise.all([
            queryHomeItems(HOME_PLANTS_TABLE, homeId),
            queryHomeItems(CARE_LOGS_V2_TABLE, homeId)
        ]);

        const latestLogs = {};
        for (const log of careLogRows) {
            const plantId = log.plantId || log.homePlantId;
            if (!plantId) continue;
            const key = `${plantId}__${log.type}`;
            if (!latestLogs[key] || log.timestamp > latestLogs[key].timestamp) {
                latestLogs[key] = log;
            }
        }

        const overdueIndoor = [];
        const overdueOutdoor = [];

        for (const row of homePlantRows) {
            if (row.deleted) continue;
            const catalogItem = catalogMap.get(row.catalogId) || {};
            const effectiveGroup = row.groupOverride || catalogItem.group || row.group || 'indoor';
            
            // Prioritize nickname; fallback to common name or customName
            const plantDisplayName = (row.nickname && row.nickname.trim())
                ? row.nickname.trim()
                : (catalogItem.name || row.customName || 'Plant');

            const isSelfWatering = row.potType === 'self-watering';
            const effectiveWaterFreq = isSelfWatering && catalogItem.selfWaterFreqDays
                ? catalogItem.selfWaterFreqDays
                : catalogItem.waterFreqDays;

            let isWaterDue = false;
            let isFertDue = false;

            if (effectiveGroup === 'indoor' || (effectiveGroup === 'outdoor-potted' && row.trackWatering)) {
                if (effectiveWaterFreq) {
                    const lastWater = latestLogs[`${row.homePlantId}__water`]?.timestamp;
                    const waterUrg = computeUrgency(lastWater, effectiveWaterFreq);
                    if (waterUrg.status === 'overdue' || waterUrg.status === 'never' || waterUrg.status === 'due-today') {
                        isWaterDue = true;
                    }
                }
            }

            if (catalogItem.fertFreqDays) {
                const lastFert = latestLogs[`${row.homePlantId}__fertilize`]?.timestamp;
                const fertUrg = computeUrgency(lastFert, catalogItem.fertFreqDays);
                if (fertUrg.status === 'overdue' || fertUrg.status === 'never' || fertUrg.status === 'due-today') {
                    isFertDue = true;
                }
            }

            if (isWaterDue || isFertDue) {
                const item = {
                    name: plantDisplayName,
                    isWaterDue,
                    isSelfWatering,
                    isFertDue,
                    fertRecommendation: catalogItem.fertRecommendation || '',
                    effectiveGroup,
                };
                if (effectiveGroup === 'indoor') overdueIndoor.push(item);
                else overdueOutdoor.push(item);
            }
        }

        const res = { homeId, name, overdueIndoor, overdueOutdoor };
        homeOverdueCache.set(homeId, res);
        return res;
    }

    // 4. Process each user according to their stored notification preferences
    for (const [email, profile] of userProfiles.entries()) {
        const notif = profile.notifications || {};
        const careReminders = notif.careReminders ?? true;
        const sendEmailOpt = notif.email ?? true;
        const sendSmsOpt = Boolean(notif.sms);
        const phoneNumber = profile.phoneNumber ? String(profile.phoneNumber).trim() : '';

        if (!careReminders) {
            console.log(`Skipping reminders for ${email}: careReminders is disabled.`);
            continue;
        }

        if (!sendEmailOpt && !sendSmsOpt) {
            console.log(`Skipping reminders for ${email}: both email and sms are disabled.`);
            continue;
        }

        const userHomeIds = userHomes.get(email);
        if (!userHomeIds || userHomeIds.size === 0) {
            console.log(`User ${email} has no homes.`);
            continue;
        }

        // Aggregate overdue plants across user's homes
        const userIndoor = [];
        const userOutdoor = [];

        for (const homeId of userHomeIds) {
            const hData = await getHomeOverdue(homeId);
            for (const p of hData.overdueIndoor) {
                userIndoor.push({ ...p, homeName: hData.name });
            }
            for (const p of hData.overdueOutdoor) {
                userOutdoor.push({ ...p, homeName: hData.name });
            }
        }

        if (userIndoor.length === 0 && userOutdoor.length === 0) {
            console.log(`All plants up to date for ${email}. No reminders needed.`);
            continue;
        }

        console.log(`Sending reminder to ${email}: ${userIndoor.length} indoor, ${userOutdoor.length} outdoor overdue.`);

        // Dispatch Email
        if (sendEmailOpt) {
            const recipientName = (profile.firstName && profile.firstName.trim())
                ? profile.firstName.trim()
                : (email.split('@')[0] || 'there');
            const htmlBody = buildEmailHtml(userIndoor, userOutdoor, recipientName);
            await sendEmail('🌱 Plants Care Reminder', htmlBody, [email], FROM_EMAIL);
        }

        // Dispatch SMS
        if (sendSmsOpt && phoneNumber) {
            let smsText = `Plants Tracker 🌱\n`;
            if (userIndoor.length > 0) smsText += `🏠 Indoor: ${userIndoor.length} need care.\n`;
            if (userOutdoor.length > 0) smsText += `🪴 Outdoor: ${userOutdoor.length} need care.\n`;
            smsText += `Log care at https://plants.abhijeetkharkar.com`;

            await sendSMS(smsText, [phoneNumber]);
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
            await processBabyReminders('nails');
            await processPlantReminders();
        }
        return { statusCode: 200, body: 'Success' };
    } catch (err) {
        console.error('Error processing reminders:', err);
        return { statusCode: 500, body: err.message };
    }
};
