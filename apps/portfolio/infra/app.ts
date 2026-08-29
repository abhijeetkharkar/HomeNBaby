import * as cdk from 'aws-cdk-lib';
import { PortfolioFrontendStack } from './stack';

const app = new cdk.App();
new PortfolioFrontendStack(app, 'PortfolioFrontendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // Certificates for CloudFront must be in us-east-1
  }
});
