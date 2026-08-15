import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference the DynamoDB table from the Core Infra stack via SSM
    const tableName = 'tracker-baby-logs';
    const tableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}`;

    // Create the Nodejs Lambda function
    const apiLambda = new lambdaNodejs.NodejsFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../tracker-api-lambda.js'),
      handler: 'handler',
      environment: {
        TABLE_NAME: tableName,
      },
    });

    // Grant DynamoDB permissions
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 
        'dynamodb:DeleteItem', 'dynamodb:Scan', 'dynamodb:Query',
        'dynamodb:BatchWriteItem', 'dynamodb:BatchGetItem'
      ],
      resources: [tableArn],
    }));

    // Setup Lambda Function URL (Simpler than API Gateway HTTP API for this setup, 
    // but if API GW is preferred we can do that. Using Function URL for cost/simplicity).
    // Let's stick to a Function URL since we're rewriting it anyway, it's easier to proxy via CloudFront.
    const functionUrl = apiLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
      }
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: functionUrl.url,
    });

    new ssm.StringParameter(this, 'ApiEndpointParam', {
      parameterName: '/tracker/api/endpoint',
      stringValue: functionUrl.url,
    });
  }
}
