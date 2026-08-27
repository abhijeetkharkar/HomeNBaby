const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const client = new DynamoDBClient({
    region: 'us-east-1',
    credentials: fromIni({ profile: 'admin' })
});

const ddb = DynamoDBDocumentClient.from(client);

async function seed() {
    try {
        const babyId = 'baby-snigdha-123';
        const parents = ['abhijeetkharkar@gmail.com', 'prajaktap999@gmail.com'];
        
        console.log("Seeding babies table...");
        await ddb.send(new PutCommand({
            TableName: 'babies',
            Item: {
                babyId,
                name: 'Snigdha',
                gender: 'girl',
                parents
            }
        }));
        
        for (const email of parents) {
            console.log(`Seeding baby-profiles for ${email}...`);
            await ddb.send(new PutCommand({
                TableName: 'baby-profiles',
                Item: {
                    email,
                    babyId
                }
            }));
        }
        
        console.log("Migrating old logs from tracker-baby-logs to baby-tracker-logs...");
        let lastEvaluatedKey = undefined;
        let count = 0;
        
        do {
            const scanRes = await ddb.send(new ScanCommand({
                TableName: 'tracker-baby-logs',
                ExclusiveStartKey: lastEvaluatedKey
            }));
            
            const items = scanRes.Items || [];
            for (const item of items) {
                // new PK is babyId#date
                const newItem = {
                    ...item,
                    'babyId#date': `${babyId}#${item.date}`
                };
                
                await ddb.send(new PutCommand({
                    TableName: 'baby-tracker-logs',
                    Item: newItem
                }));
                count++;
            }
            lastEvaluatedKey = scanRes.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        console.log(`Successfully migrated ${count} old logs to new table!`);
        console.log("Done seeding!");
    } catch (err) {
        console.error("Error:", err);
    }
}

seed();
