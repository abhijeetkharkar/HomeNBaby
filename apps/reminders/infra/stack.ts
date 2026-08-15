import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as path from 'path';

export class RemindersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tableName = 'tracker-baby-logs';
    const tableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}`;

    const reminderLambda = new lambdaNodejs.NodejsFunction(this, 'ReminderHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../reminder-lambda.js'),
      handler: 'handler',
      environment: {
        TABLE_NAME: tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Read access to DynamoDB
    reminderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:GetItem'],
      resources: [tableArn],
    }));

    // Publish access to SNS for SMS
    reminderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'], // Allowing all SNS publishing, or limit if a specific topic is used
    }));

    // Trigger daily at 13:00 UTC (8:00 AM Central)
    const rule = new events.Rule(this, 'DailyReminderRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '13' }),
    });

    rule.addTarget(new targets.LambdaFunction(reminderLambda));
  }
}
