import * as cdk from 'aws-cdk-lib';
import { TrackerFrontendStack } from './stack';

const app = new cdk.App();
new TrackerFrontendStack(app, 'TrackerFrontendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  }
});
