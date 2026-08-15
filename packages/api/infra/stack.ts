import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as path from 'path';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference the DynamoDB tables from the Core Infra stack
    const trackerTableName = 'tracker-baby-logs';
    const plantsTableName = 'plants-care-logs';
    
    const trackerTableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${trackerTableName}`;
    const plantsTableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${plantsTableName}`;

    // Create the Nodejs Lambda function (Express app)
    const apiLambda = new lambdaNodejs.NodejsFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda.js'),
      handler: 'handler',
      environment: {
        TRACKER_TABLE_NAME: trackerTableName,
        PLANTS_TABLE_NAME: plantsTableName,
      },
    });

    // Grant DynamoDB permissions for both apps
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 
        'dynamodb:DeleteItem', 'dynamodb:Scan', 'dynamodb:Query',
        'dynamodb:BatchWriteItem', 'dynamodb:BatchGetItem'
      ],
      resources: [trackerTableArn, plantsTableArn],
    }));

    // Setup Custom Domain
    const domainName = 'api.abhijeetkharkar.com';
    const zoneName = 'abhijeetkharkar.com';
    
    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: zoneName });
    
    // Use the existing wildcard cert
    const certificate = acm.Certificate.fromCertificateArn(this, 'ApiCertificate',
      'arn:aws:acm:us-east-1:797884421713:certificate/15b73dd4-bcb8-4f54-b9a4-7dc728ed2727'
    );

    const domain = new apigwv2.DomainName(this, 'ApiDomain', {
      domainName,
      certificate,
    });

    // Create the HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'SharedHttpApi', {
      defaultIntegration: new apigwv2_integrations.HttpLambdaIntegration('LambdaIntegration', apiLambda),
      defaultDomainMapping: {
        domainName: domain,
      },
      // CORS is handled inside the Express app, so we don't need API GW CORS config
    });

    // Route53 Alias Record to point to the API Gateway Custom Domain
    new route53.ARecord(this, 'ApiAliasRecord', {
      recordName: domainName,
      zone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(domain.regionalDomainName, domain.regionalHostedZoneId)),
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `https://${domainName}`,
    });
  }
}
