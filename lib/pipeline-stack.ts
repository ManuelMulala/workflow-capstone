import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { WorkflowStage } from './workflow-stage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const connectionArn = this.node.tryGetContext('connectionArn');
    const repo = this.node.tryGetContext('repo') ?? 'ManuelMulala/workflow-capstone';

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'WorkflowPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(repo, 'main', { connectionArn }),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    pipeline.addStage(new WorkflowStage(this, 'Prod', { env: props?.env }));
  }
}
