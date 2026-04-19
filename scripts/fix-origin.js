/**
 * scripts/fix-origin.js
 * Updates the lambda-api origin domain in CloudFront to use API Gateway
 * instead of Lambda Function URL.
 *
 * Usage: node scripts/fix-origin.js DIST_ID NEW_DOMAIN PROFILE
 */
const { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } = require('@aws-sdk/client-cloudfront');

const [distId, newDomain, profile] = process.argv.slice(2);

if (!distId || !newDomain || !profile) {
  console.error('Usage: node fix-origin.js <dist-id> <new-domain> <profile>');
  process.exit(1);
}

(async () => {
  try {
    process.env.AWS_PROFILE = profile;
    const client = new CloudFrontClient({ region: 'us-east-1' });

    console.log(`  Fetching CloudFront config for ${distId}...`);
    const getResp = await client.send(new GetDistributionConfigCommand({ Id: distId }));
    const config = getResp.DistributionConfig;
    const etag = getResp.ETag;

    // Find and update the lambda-api origin
    const origin = config.Origins.Items.find(o => o.Id === 'lambda-api');
    if (!origin) {
      throw new Error('Origin "lambda-api" not found in distribution');
    }

    console.log(`  Old domain: ${origin.DomainName}`);
    console.log(`  New domain: ${newDomain}`);
    origin.DomainName = newDomain;

    console.log(`  Updating distribution...`);
    await client.send(
      new UpdateDistributionCommand({
        Id: distId,
        DistributionConfig: config,
        IfMatch: etag,
      })
    );

    console.log('  CloudFront origin updated ✓');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
