/**
 * scripts/update_cf_lambda.js
 * Reads a CloudFront distribution config from stdin, injects a Lambda
 * Function URL origin + /api/* cache behaviour, writes result to stdout.
 *
 * Usage:
 *   aws cloudfront get-distribution-config --id DIST_ID \
 *     | node scripts/update_cf_lambda.js LAMBDA_URL_DOMAIN \
 *     > /tmp/new-cf-config.json
 */
const lambdaDomain = process.argv[2];
if (!lambdaDomain) {
  console.error('Usage: node update_cf_lambda.js <lambda-url-domain>');
  process.exit(1);
}

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  const data   = JSON.parse(raw);
  const config = data.DistributionConfig;

  // ── Add Lambda Function URL origin ────────────────────────────────────────
  config.Origins.Items.push({
    Id: 'lambda-api',
    DomainName: lambdaDomain,
    CustomOriginConfig: {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: 'https-only',
      OriginSSLProtocols: { Quantity: 1, Items: ['TLSv1.2'] },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5,
    },
  });
  config.Origins.Quantity += 1;

  // ── Add /api/* cache behaviour (before default /*) ────────────────────────
  const apiBehaviour = {
    PathPattern: '/api/*',
    TargetOriginId: 'lambda-api',
    ViewerProtocolPolicy: 'https-only',
    Compress: true,
    // CachingDisabled — never cache API responses
    CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
    // AllViewerExceptHostHeader — forward all headers except Host
    // (Host must be the Lambda URL domain, not the CloudFront domain)
    OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
    AllowedMethods: {
      Quantity: 7,
      Items: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
      CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
    },
  };

  if (!config.CacheBehaviors || !config.CacheBehaviors.Items) {
    config.CacheBehaviors = { Quantity: 0, Items: [] };
  }
  config.CacheBehaviors.Items.push(apiBehaviour);
  config.CacheBehaviors.Quantity += 1;

  console.log(JSON.stringify(config));
});
