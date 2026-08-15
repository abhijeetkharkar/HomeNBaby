import * as cdk from 'aws-cdk-lib';
import { PlantsFrontendStack } from './stack';

const app = new cdk.App();
new PlantsFrontendStack(app, 'PlantsFrontendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Certificates for CloudFront must be in us-east-1
  }
});
