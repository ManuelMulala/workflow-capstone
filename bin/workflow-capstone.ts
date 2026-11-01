#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();
new PipelineStack(app, 'WorkflowPipelineStack', {
  env: { account: '586481704498', region: 'eu-west-1' },
});
