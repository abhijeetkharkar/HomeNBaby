import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CoreInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the DynamoDB table
    const babyLogsTable = new dynamodb.Table(this, 'BabyLogsTable', {
      tableName: 'tracker-baby-logs',
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Store the table ARN in SSM Parameter Store so other apps can look it up
    new ssm.StringParameter(this, 'BabyLogsTableArnParam', {
      parameterName: '/tracker/dynamodb/baby-logs-table-arn',
      stringValue: babyLogsTable.tableArn,
    });
    
    new ssm.StringParameter(this, 'BabyLogsTableNameParam', {
      parameterName: '/tracker/dynamodb/baby-logs-table-name',
      stringValue: babyLogsTable.tableName,
    });
  }
}
