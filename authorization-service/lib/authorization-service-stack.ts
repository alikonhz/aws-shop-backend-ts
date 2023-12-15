import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path = require('path');

export interface AuthServiceProps extends cdk.StackProps {
  stage: string;
}

function withStage(props: AuthServiceProps, param: string): string {
  return `${props.stage.toUpperCase()}-${param}`;
}

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthServiceProps) {
    super(scope, id, props);

    const env: Record<string, any> = {};
    for (const key in process.env) {
      if (key.startsWith('LAMBDA_ENV_')) {
        const envKey = key.replace('LAMBDA_ENV_', '');
        env[envKey] = process.env[key];
      }
    }
    const lambda = new NodejsFunction(this, withStage(props, 'AuthService'), {
      functionName: withStage(props, 'basicAuthorizer'),
      entry: path.join(__dirname, '../src/handlers/basicAuthorizer.ts'),
      environment: env,
    });

    new cdk.CfnOutput(this, withStage(props, 'AuthServiceCfnOutput'), {
      value: lambda.functionArn,
      exportName: withStage(props, 'AuthServiceFunc')
    })
  }
}
