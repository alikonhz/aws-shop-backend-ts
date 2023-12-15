import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AuthorizationType, Cors, LambdaIntegration, LambdaRestApi, ResponseType, RestApi, TokenAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface ImportStackOptions extends cdk.StackProps {
  stage: string
}

function withStage(props: ImportStackOptions, param: string): string {
  return `${props.stage.toUpperCase()}-${param}`;
}

export class ImportServiceStack extends cdk.Stack {
  private lambdaProps(props: ImportStackOptions): Partial<NodejsFunctionProps> {
    return   {
      runtime: awslambda.Runtime.NODEJS_18_X,
      environment: {
        PRODUCT_AWS_REGION: process.env.PRODUCT_AWS_REGION!,
        
      }
    }
  };

  constructor(scope: Construct, id: string, props: ImportStackOptions) {

    super(scope, id, props);

    const importBucket = new s3.Bucket(this, withStage(props, 'import-bucket-id-ts'), {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: withStage(props, 'import-bucket-name-ts').toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.HEAD, s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['Authorization', '*'],
        },
      ]
    }); 

    const importLambda = new NodejsFunction(this, withStage(props, 'ImportProductsFile'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, 'importProductsFile'),
      entry: path.join(__dirname, '../src/handlers/importProductsFile.ts'),
      environment: {
        S3_BUCKET: importBucket.bucketName,
      }
    });
    importBucket.grantPut(importLambda);

    const lambdaPath = path.join(__dirname, '../src/handlers/importFileParser.ts');
    console.log('lambda path: ', lambdaPath);
    const importFileParser = new NodejsFunction(this, withStage(props, 'ImportFileParser'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, 'importFileParser'),
      entry: lambdaPath,
      environment: {
        S3_BUCKET: importBucket.bucketName,
        SQS_QUEUE_URL: process.env.SQS_QUEUE_URL!,
      },
    });
    importFileParser.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:sendmessage'],
      resources: [process.env.SQS_QUEUE_ARN!],
    }));
    importBucket.grantDelete(importFileParser);
    importBucket.grantPut(importFileParser);
    importBucket.grantReadWrite(importFileParser);

    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new LambdaDestination(importFileParser),
      {
        prefix: 'uploaded/',
      }
    );

    const restApi = new RestApi(this, withStage(props, 'ImportProductsRestApi-id'), {
      restApiName: withStage(props, 'ImportProductsRestApi-name'),
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
      deployOptions: {
        stageName: props.stage.toLowerCase(),
      }
    });

    restApi.addGatewayResponse(withStage(props, 'ImportProducts401'), {
      type: ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      }
    });

    // --- IMPORTANT: START
    // adding default gateway responses to the REST API
    // these responses make sure that when auth. lambda returns 401/403 API gateway will return Access-Control-Allow-Origin header
    restApi.addGatewayResponse(withStage(props, 'ImportProducts403'), {
      type: ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
      }
    });
    const importEndpoint = restApi.root.addResource("import");
    const importIntegration = new LambdaIntegration(importLambda, {
      requestParameters: {
        'integration.request.querystring.name': 'method.request.querystring.name',
      },
    });
    // --- IMPORTANT: END

    const lambdaAuthArn = cdk.Fn.importValue(withStage(props, 'AuthServiceFunc'));
    const tokenAuthLambdaFn = awslambda.Function.fromFunctionArn(this, withStage(props, 'basicAuthorizer'), lambdaAuthArn.toString());
    const invokeTokenRole = new iam.Role(this, withStage(props, 'InvokeAuthLambdaRoleId'), {
      roleName: withStage(props, 'InvokeAuthLambdaRoleName'),
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    });
    const invoiceTokenPolicyStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      sid: withStage(props, 'AllowInvokeAuthLambda').replace('-', ''),
      resources: [lambdaAuthArn.toString()],
      actions: ['lambda:InvokeFunction'],
    });
    const policy = new iam.Policy(this, withStage(props, 'InvokeAuthLambdaPolicyId'), {
      policyName: withStage(props, 'InvokeAuthLambdaPolicyName'),
      statements: [invoiceTokenPolicyStatement],
      roles: [invokeTokenRole],
    });

    const importAuthorizer = new cdk.aws_apigateway.TokenAuthorizer(this, withStage(props, 'RestApiAuthorizer'), {
      handler: tokenAuthLambdaFn,
      assumeRole: invokeTokenRole,
      resultsCacheTtl: cdk.Duration.millis(0),
    });
    importEndpoint.addMethod("GET", importIntegration, {
      apiKeyRequired: false,
      authorizationType: AuthorizationType.CUSTOM,
      authorizer: importAuthorizer,
      requestParameters: {
        'method.request.querystring.name': true,
      },
      requestValidatorOptions: {
        validateRequestParameters: true,
      }
    });

    new cdk.CfnOutput(this, withStage(props, 'ImportProductsRestApi-URL-ts'), {
      value: restApi.url,
    });
  }
}
