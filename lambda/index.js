const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({});
const PARAM_NAME = process.env.PARAM_NAME; // injected by CDK, not hardcoded

exports.handler = async (event) => {
  console.log('Workflow input:', JSON.stringify(event));

  // Demo the Retry/Catch path: start an execution with {"simulateFailure": true}
  if (event.simulateFailure) {
    throw new Error('Simulated failure to demonstrate Step Functions retries');
  }

  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: PARAM_NAME }));
  console.log(`Retrieved from SSM: ${Parameter.Name} = "${Parameter.Value}" (version ${Parameter.Version})`);

  return {
    status: 'Success',
    parameter: Parameter.Name,
    greeting: Parameter.Value,
    parameterVersion: Parameter.Version,
    requestedAt: event.requestedAt,
  };
};
