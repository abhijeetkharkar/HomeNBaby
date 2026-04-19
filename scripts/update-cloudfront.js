/**
 * scripts/update-cloudfront.js
 * Updates CloudFront distribution to add Lambda origin + /api/* behaviour.
 * Uses AWS SDK directly, avoiding shell path issues on Windows.
 *
 * Usage: node scripts/update-cloudfront.js DIST_ID LAMBDA_DOMAIN PROFILE
 */
const { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand } = require('@aws-sdk/client-cloudfront');

const [distId, lambdaDomain, profile] = process.argv.slice(2);

if (!distId || !lambdaDomain || !profile) {
  console.error('Usage: node update-cloudfront.js <dist-id> <lambda-domain> <profile>');
  process.exit(1);
}

(async () => {
  try {
    // Set AWS profile for SDK
    process.env.AWS_PROFILE = profile;

    const client = new CloudFrontClient({
      region: 'us-east-1',
    });

    // Get current distribution config
    console.log(`  Fetching CloudFront config for ${distId}...`);
    const getResp = await client.send(new GetDistributionConfigCommand({ Id: distId }));
    console.log('DEBUG: getResp keys:', Object.keys(getResp));

    const config = getResp.DistributionConfig;
    const etag = getResp.ETag;

    console.log('DEBUG: config type:', typeof config);
    console.log('DEBUG: config keys:', config ? Object.keys(config) : 'null');
    console.log('DEBUG: config.Origins:', config ? config.Origins : 'undefined');

    if (!config || !config.Origins || !config.Origins.Items) {
      console.error('DEBUG: Full response:', JSON.stringify(getResp, null, 2));
      throw new Error('Invalid CloudFront config: Origins or Items not found');
    }

    // Add Lambda origin
    config.Origins.Items.push({
      Id: 'lambda-api',
      DomainName: lambdaDomain,
      OriginPath: '',
      CustomHeaders: { Quantity: 0, Items: [] },
      ConnectionAttempts: 3,
      ConnectionTimeout: 10,
      OriginShield: { Enabled: false },
      CustomOriginConfig: {
        HTTPPort: 80,
        HTTPSPort: 443,
        OriginProtocolPolicy: 'https-only',
        OriginSslProtocols: { Quantity: 1, Items: ['TLSv1.2'] },
        OriginReadTimeout: 30,
        OriginKeepaliveTimeout: 5,
      },
    });
    config.Origins.Quantity += 1;

    // Add /api/* behaviour
    if (!config.CacheBehaviors || !Array.isArray(config.CacheBehaviors.Items)) {
      config.CacheBehaviors = { Quantity: 0, Items: [] };
    }

    console.log('DEBUG: About to push to CacheBehaviors.Items');
    config.CacheBehaviors.Items.push({
      PathPattern: '/api/*',
      TargetOriginId: 'lambda-api',
      ViewerProtocolPolicy: 'https-only',
      Compress: true,
      SmoothStreaming: false,
      FieldLevelEncryptionId: '',
      CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
      OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
      AllowedMethods: {
        Quantity: 7,
        Items: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
      },
      TrustedSigners: { Enabled: false, Quantity: 0, Items: [] },
      TrustedKeyGroups: { Enabled: false, Quantity: 0, Items: [] },
      LambdaFunctionAssociations: { Quantity: 0, Items: [] },
      FunctionAssociations: { Quantity: 0, Items: [] },
    });
    config.CacheBehaviors.Quantity += 1;

    // Update distribution
    console.log(`  Updating distribution...`);
    await client.send(
      new UpdateDistributionCommand({
        Id: distId,
        DistributionConfig: config,
        IfMatch: etag,
      })
    );

    console.log('  CloudFront updated ✓');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
