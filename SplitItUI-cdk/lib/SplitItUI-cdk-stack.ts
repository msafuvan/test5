import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

interface WebAppStackProps extends cdk.StackProps {
  // Define your stack properties here
}

export class WebAppStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: WebAppStackProps) {
    super(scope, id, props);

    // Create an S3 bucket for the web app
    const webAppS3 = new s3.Bucket(this, 'WebAppS3', {
      bucketName: 'my-webapp-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This is just an example, adjust as needed
    });

    // Create a CloudFront distribution for content delivery
    const contentDelivery = new cloudfront.Distribution(this, 'ContentDelivery', {
      defaultBehavior: {
        origin: new cloudfront.S3Origin(webAppS3),
      },
    });

    // Output the website URL
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: contentDelivery.distributionDomainName,
    });
  }
}