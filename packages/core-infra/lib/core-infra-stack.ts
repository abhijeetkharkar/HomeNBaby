import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CoreInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference the existing DynamoDB table for tracker
    const babyLogsTable = dynamodb.Table.fromTableName(this, 'BabyLogsTable', 'tracker-baby-logs');

    // Store the table ARN in SSM Parameter Store so other apps can look it up
    new ssm.StringParameter(this, 'BabyLogsTableArnParam', {
      parameterName: '/tracker/dynamodb/baby-logs-table-arn',
      stringValue: babyLogsTable.tableArn,
    });
    
    new ssm.StringParameter(this, 'BabyLogsTableNameParam', {
      parameterName: '/tracker/dynamodb/baby-logs-table-name',
      stringValue: babyLogsTable.tableName,
    });

    // Create the DynamoDB table for plants
    const plantsLogsTable = new dynamodb.Table(this, 'PlantsLogsTable', {
      tableName: 'plants-care-logs',
      partitionKey: { name: 'plantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, 'PlantsLogsTableNameParam', {
      parameterName: '/plants/dynamodb/plants-logs-table-name',
      stringValue: plantsLogsTable.tableName,
    });
  }
}
