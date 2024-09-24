#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { cdk_Stack } from '../lib/SplitItUI-cdk-stack';

const app = new cdk.App();

const cdk_package = new cdk_Stack(app, 'CdkStack', {
    // add env here
});

//NOTE: replace the cdk_Stack with the name of the class you are exporting from the stack file 


