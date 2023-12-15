import { Context, Callback } from 'aws-lambda';

// event is APIGatewayTokenAuthorizerEvent
export const handler = (event: any, context: Context, callback: Callback) => {
    try {

        const authHeader = event?.authorizationToken;

        console.log('event: ', JSON.stringify(event));

        if (!authHeader) {
            callback('Unauthorized');
            return;
        }

        const token = authHeader.replace('Basic ', '');
        console.log('token: ', token);
        const data = Buffer.from(token, 'base64').toString('utf-8');
        const [userName, pwd] = data.split(':');
        console.log('userName: ', userName);
        console.log('pwd: ', pwd);

        if (!userName || !pwd) {
            callback('Unauthorized');
            return;
        }

        const userPwd = <string>process.env[userName];
        console.log('process.env.pwd: ', process.env[userName]);
        if (pwd === userPwd) {
            console.log('result: Allow');
            callback(null, generatePolicy(userName, 'Allow', event.methodArn));
            return;
        }

        console.log('result: Deny');
        callback(null, generatePolicy(userName, 'Deny', event.methodArn));
    } catch(err) {
        console.error(err);
        // in case of error - return 401
        callback('Unauthorized');
    }
};

function generatePolicy(principalId: string, effect: string, resource: string) {
    return {
        principalId: principalId,
        policyDocument: {
            Statement: [{
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: resource
            }],
            Version: '2012-10-17'
        }
    };
}