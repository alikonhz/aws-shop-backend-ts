import { handler} from './basicAuthorizer'; // Update with the correct file path

describe('Lambda Function Tests', () => {
  test('Valid Authorization', async () => {
    const event = {
      authorizationToken: 'Basic dGVzdHVzZXJuYW1lOlRFU1RfUEFTU1dPUkQ=',
      methodArn: 'arn:aws:execute-api:region:account-id:api-id/stage/method/resource',
    };

    const context = {} as any;
    const callback = jest.fn();

    await handler(event, context, callback);

    expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({
      principalId: 'testusername',
      policyDocument: {
        Statement: [{
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        }],
        Version: '2012-10-17',
      },
    }));
  });

  test('Missing Authorization Token', async () => {
    const event = {
      // No authorizationToken provided
      methodArn: 'arn:aws:execute-api:region:account-id:api-id/stage/method/resource',
    };

    const context = {} as any;
    const callback = jest.fn();

    await handler(event, context, callback);

    expect(callback).toHaveBeenCalledWith('Unauthorized');
  });

  // Add more test cases for different scenarios, such as invalid tokens, missing environment variables, etc.
});
