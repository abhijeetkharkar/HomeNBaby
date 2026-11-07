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

// ── Multi-User Plant Reminders ───────────────────────────────────────────────

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
    const homeOverdueCache = new Map(); // homeId -> { indoor: [], outdoor: [] }

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
            const plantName = row.nickname
                ? `${catalogItem.name || row.customName || 'Plant'} (${row.nickname})`
                : (catalogItem.name || row.customName || 'Plant');
            const emoji = catalogItem.emoji || '🌿';

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

            const notes = [];
            let isOverdue = false;

            if (effectiveGroup === 'indoor') {
                if (isWaterDue && isFertDue) {
                    isOverdue = true;
                    notes.push(`Needs Water + Fertilizer 💧🧪 (${catalogItem.fertRecommendation || 'Fertilizer'})`);
                } else if (isWaterDue) {
                    isOverdue = true;
                    notes.push(isSelfWatering ? 'Refill Reservoir 💧' : 'Needs Water 💧');
                }
            } else {
                if (isWaterDue && isFertDue) {
                    isOverdue = true;
                    notes.push(`Needs Water + Fertilizer 💧🧪 (${catalogItem.fertRecommendation || 'Fertilizer'})`);
                } else if (isWaterDue) {
                    isOverdue = true;
                    notes.push('Needs Water 💧');
                } else if (isFertDue) {
                    isOverdue = true;
                    notes.push(`Needs Fertilizer 🧪 (${catalogItem.fertRecommendation || 'Fertilizer'})`);
                }
            }

            if (isOverdue) {
                const item = {
                    name: `${emoji} ${plantName}`,
                    notes: notes.join(', ')
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
            let htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a2b22;">
                <h1 style="color: #2ea76f; font-size: 22px; margin-bottom: 8px;">Plants Care Digest 🌱</h1>
                <p style="font-size: 15px; color: #567063; margin-top: 0;">Here are the plants that need your attention today:</p>`;

            if (userIndoor.length > 0) {
                htmlBody += `<h2 style="font-size: 17px; color: #1a2b22; margin-top: 20px; border-bottom: 2px solid #e6f7ec; padding-bottom: 4px;">🏠 Indoor Plants (${userIndoor.length})</h2><ul style="padding-left: 20px; line-height: 1.6;">`;
                htmlBody += userIndoor.map(p => `<li><strong>${p.name}</strong> <span style="color: #567063; font-size: 13px;">[${p.homeName}]</span>: ${p.notes}</li>`).join('');
                htmlBody += `</ul>`;
            }

            if (userOutdoor.length > 0) {
                htmlBody += `<h2 style="font-size: 17px; color: #1a2b22; margin-top: 20px; border-bottom: 2px solid #e6f7ec; padding-bottom: 4px;">🪴 Outdoor Plants (${userOutdoor.length})</h2><ul style="padding-left: 20px; line-height: 1.6;">`;
                htmlBody += userOutdoor.map(p => `<li><strong>${p.name}</strong> <span style="color: #567063; font-size: 13px;">[${p.homeName}]</span>: ${p.notes}</li>`).join('');
                htmlBody += `</ul>`;
            }

            htmlBody += `<div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #edf2f7; font-size: 13px; color: #88998f;">
                <p>Log care or manage notification preferences at <a href="https://plants.abhijeetkharkar.com" style="color: #2ea76f; text-decoration: none; font-weight: bold;">Plants Tracker</a>.</p>
            </div></div>`;

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
        console.error('Error in lambda-reminder:', err);
        return { statusCode: 500, body: 'Error' };
    }
};
