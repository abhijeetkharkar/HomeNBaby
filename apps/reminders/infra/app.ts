import * as cdk from 'aws-cdk-lib';
import { RemindersStack } from './stack';

const app = new cdk.App();
new RemindersStack(app, 'TrackerRemindersStack');
