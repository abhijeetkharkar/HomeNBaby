import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class CoreInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- Multi-Tenancy Tables ---
    const babyProfilesTable = new dynamodb.Table(this, 'BabyProfilesTable', {
      tableName: 'baby-profiles',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const babiesTable = new dynamodb.Table(this, 'BabiesTable', {
      tableName: 'babies',
      partitionKey: { name: 'babyId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const babyLogsTable = new dynamodb.Table(this, 'BabyTrackerLogsTable', {
      tableName: 'baby-tracker-logs',
      partitionKey: { name: 'babyId#date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Store the table ARNs and names in SSM Parameter Store
    new ssm.StringParameter(this, 'BabyProfilesTableNameParam', {
      parameterName: '/tracker/dynamodb/baby-profiles-table-name',
      stringValue: babyProfilesTable.tableName,
    });

    new ssm.StringParameter(this, 'BabiesTableNameParam', {
      parameterName: '/tracker/dynamodb/babies-table-name',
      stringValue: babiesTable.tableName,
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
