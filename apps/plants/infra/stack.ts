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

export class PlantsFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'plants.abhijeetkharkar.com';
    const zoneName = 'abhijeetkharkar.com';

    // ── S3 Bucket ──────────────────────────────────────────────────────────
    const siteBucket = new s3.Bucket(this, 'PlantsSiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── CloudFront ─────────────────────────────────────────────────────────
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });

    // Import existing wildcard cert — do NOT create a new one
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate',
      'arn:aws:acm:us-east-1:797884421713:certificate/15b73dd4-bcb8-4f54-b9a4-7dc728ed2727'
    );

    const distribution = new cloudfront.Distribution(this, 'PlantsDistribution', {
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

    // API is now handled by shared API Gateway at api.abhijeetkharkar.com

    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone,
    });

    new s3deploy.BucketDeployment(this, 'DeployPlantsSite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${domainName}` });
  }
}
