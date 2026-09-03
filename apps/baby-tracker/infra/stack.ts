import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class TrackerFrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = 'babytracker.abhijeetkharkar.com';
    const zoneName = 'abhijeetkharkar.com';

    // Use the existing wildcard cert (*.abhijeetkharkar.com) — already validated
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCertificate',
      'arn:aws:acm:us-east-1:797884421713:certificate/15b73dd4-bcb8-4f54-b9a4-7dc728ed2727'
    );

    // Look up the hosted zone
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });

    const siteBucket = new s3.Bucket(this, 'TrackerSiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'TrackerDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      domainNames: [domainName],
      certificate,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        }
      ]
    });

    // API is now hosted independently at api.abhijeetkharkar.com

    // --- Authentication (Cognito) ---
    const userPool = new cognito.UserPool(this, 'TrackerUserPool', {
      userPoolName: 'tracker-user-pool',
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Adjust for production
    });

    const cognitoDomain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'tracker-abhijeetkharkar',
      },
    });

    const supportedProviders = [cognito.UserPoolClientIdentityProvider.COGNITO];
    let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;

    if (process.env.GOOGLE_CLIENT_SECRET) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool: userPool,
        clientId: '102477411233-ncb6svq2ft8t2926k642mud0d6pfhtlr.apps.googleusercontent.com',
        clientSecretValue: cdk.SecretValue.unsafePlainText(process.env.GOOGLE_CLIENT_SECRET),
        scopes: ['profile', 'email', 'openid'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });
      supportedProviders.push(cognito.UserPoolClientIdentityProvider.GOOGLE);
    }

    const callbackUrls = [
      'http://localhost:5173/', // Local dev
      `https://${domainName}/` // Prod
    ];

    const logoutUrls = [
      'http://localhost:5173/',
      `https://${domainName}/`
    ];

    const userPoolClient = new cognito.UserPoolClient(this, 'TrackerUserPoolClient', {
      userPool,
      userPoolClientName: 'tracker-react-client',
      generateSecret: false, // React is a public client, so no secret
      supportedIdentityProviders: supportedProviders,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: callbackUrls,
        logoutUrls: logoutUrls,
      },
    });

    // Ensure the Google Provider is created before the User Pool Client
    if (googleProvider) {
      userPoolClient.node.addDependency(googleProvider);
    }

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'CognitoDomainOutput', { value: cognitoDomain.baseUrl() });

    // Create a Route53 alias record for the custom domain
    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone
    });

    new s3deploy.BucketDeployment(this, 'DeployTrackerSite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../public'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${domainName}`,
    });
  }
}
