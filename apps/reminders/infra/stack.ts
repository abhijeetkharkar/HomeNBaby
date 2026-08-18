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

    const plantsTableName = 'plants-care-logs';
    const plantsTableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${plantsTableName}`;

    const reminderLambda = new lambdaNodejs.NodejsFunction(this, 'ReminderHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../reminder-lambda.js'),
      handler: 'handler',
      environment: {
        TABLE_NAME: tableName,
        PLANTS_TABLE_NAME: plantsTableName,
        NOTIFICATIONS_MODE: JSON.stringify({ baby: 'email', plants: 'email' }),
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Read access to DynamoDB
    reminderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query', 'dynamodb:Scan', 'dynamodb:GetItem'],
      resources: [tableArn, plantsTableArn],
    }));

    // Publish access to SNS for SMS
    reminderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'], // Allowing all SNS publishing, or limit if a specific topic is used
    }));

    // Send access to SES for Emails
    reminderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // Trigger Plant Reminders daily at 13:00 UTC (8:00 AM Central)
    const rulePlants = new events.Rule(this, 'RulePlants', {
      schedule: events.Schedule.cron({ minute: '0', hour: '13' }),
    });
    rulePlants.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'plants' }),
    }));

    // Trigger Tummy Time 1 daily at 17:00 UTC (12:00 PM Central)
    const ruleTummyTime1 = new events.Rule(this, 'RuleTummyTime1', {
      schedule: events.Schedule.cron({ minute: '0', hour: '17' }),
    });
    ruleTummyTime1.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'baby', check: 'tummyTime1' }),
    }));

    // Trigger Massage daily at 21:00 UTC (4:00 PM Central)
    const ruleMassage = new events.Rule(this, 'RuleMassage', {
      schedule: events.Schedule.cron({ minute: '0', hour: '21' }),
    });
    ruleMassage.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'baby', check: 'massage' }),
    }));

    // Trigger Vit D & Tummy Time 2 daily at 23:00 UTC (6:00 PM Central)
    const ruleVitDAndTummy2 = new events.Rule(this, 'RuleVitDAndTummy2', {
      schedule: events.Schedule.cron({ minute: '0', hour: '23' }),
    });
    ruleVitDAndTummy2.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'baby', check: 'vitD_tummyTime2' }),
    }));

    // Trigger Bath daily at 00:00 UTC (7:00 PM Central)
    const ruleBath = new events.Rule(this, 'RuleBath', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
    });
    ruleBath.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'baby', check: 'bath' }),
    }));

    // Trigger Nails weekly on Sunday at 15:00 UTC (10:00 AM Central)
    const ruleNails = new events.Rule(this, 'RuleNails', {
      schedule: events.Schedule.cron({ minute: '0', hour: '15', weekDay: 'SUN' }),
    });
    ruleNails.addTarget(new targets.LambdaFunction(reminderLambda, {
      event: events.RuleTargetInput.fromObject({ task: 'baby', check: 'nails' }),
    }));
  }
}
