import * as cdk from 'aws-cdk-lib';
import { ApiStack } from './stack';

const app = new cdk.App();
new ApiStack(app, 'TrackerApiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
