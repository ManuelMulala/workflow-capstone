import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class WorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Configuration in SSM Parameter Store
    const greeting = new ssm.StringParameter(this, 'AppGreeting', {
      parameterName: '/app/config/greeting',
      stringValue: 'Hello from CI/CD Automated Infrastructure!',
      description: 'Greeting read at runtime by the workflow Lambda',
    });

    // 2. Lambda that reads the parameter
    const fn = new lambda.Function(this, 'WorkflowTask', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(10),
      environment: { PARAM_NAME: greeting.parameterName },
      logGroup: new logs.LogGroup(this, 'WorkflowTaskLogs', {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    // Least privilege: read access to this one parameter only
    greeting.grantRead(fn);

    // 3. Workflow states
    const prepare = new sfn.Pass(this, 'PrepareInput', {
      parameters: {
        'requestedAt.$': '$$.Execution.StartTime',
        'simulateFailure.$': 'States.ArrayContains(States.Array(true), $.simulateFailure)',
      },
    });

    const wait = new sfn.Wait(this, 'WaitBeforeTask', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(3)),
    });

    const readConfig = new tasks.LambdaInvoke(this, 'ReadConfigFromSSM', {
      lambdaFunction: fn,
      payloadResponseOnly: true,
    });

    // Error handling: retry with exponential backoff, then catch into a Fail state
    readConfig.addRetry({
      errors: ['States.ALL'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const failed = new sfn.Fail(this, 'ConfigReadFailed', {
      error: 'ConfigReadFailed',
      cause: 'Lambda could not read the SSM parameter after retries',
    });
    readConfig.addCatch(failed, { resultPath: '$.error' });

    const done = new sfn.Succeed(this, 'Done');

    // 4. State machine
    const stateMachine = new sfn.StateMachine(this, 'WorkflowStateMachine', {
      stateMachineName: 'ConfigWorkflow',
      definitionBody: sfn.DefinitionBody.fromChainable(
        prepare.next(wait).next(readConfig).next(done),
      ),
      timeout: cdk.Duration.minutes(5),
    });

    new cdk.CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'LambdaLogGroup', { value: `/aws/lambda/${fn.functionName}` });
  }
}
