import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';

export class PortfolioFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'portfolio.abhijeetkharkar.com';
    const zoneName = 'abhijeetkharkar.com';

    // ── S3 Bucket for Portfolio Site ───────────────────────────────────────
    const siteBucket = new s3.Bucket(this, 'PortfolioSiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── Route 53 Hosted Zone ───────────────────────────────────────────────
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });

    // ── Shared Wildcard Certificate ────────────────────────────────────────
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'SiteCertificate',
      'arn:aws:acm:us-east-1:797884421713:certificate/15b73dd4-bcb8-4f54-b9a4-7dc728ed2727'
    );

    // ── 1. Portfolio CloudFront Distribution (portfolio.abhijeetkharkar.com) ─
    const distribution = new cloudfront.Distribution(this, 'PortfolioDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      domainNames: [domainName],
      certificate,
      errorResponses: [{ httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }],
    });

    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone,
    });

    new s3deploy.BucketDeployment(this, 'DeployPortfolioSite', {
      sources: [s3deploy.Source.asset(path.resolve('dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${domainName}` });

    // ── 2. Apex & WWW 301 Redirect to portfolio.abhijeetkharkar.com ────────
    const redirectFunction = new cloudfront.Function(this, 'RedirectToPortfolioFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri || '/';
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      'location': { value: 'https://portfolio.abhijeetkharkar.com' + uri }
    }
  };
}
      `),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const redirectDistribution = new cloudfront.Distribution(this, 'ApexRedirectDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: redirectFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      domainNames: ['abhijeetkharkar.com', 'www.abhijeetkharkar.com'],
      certificate,
    });

    new route53.ARecord(this, 'ApexAliasRecord', {
      recordName: zoneName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(redirectDistribution)),
      zone,
    });

    new route53.ARecord(this, 'WwwAliasRecord', {
      recordName: `www.${zoneName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(redirectDistribution)),
      zone,
    });

    new cdk.CfnOutput(this, 'ApexRedirectUrl', { value: `https://${zoneName}` });
  }
}
