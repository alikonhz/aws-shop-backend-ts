import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import path = require('path');
import * as s3 from 'aws-cdk-lib/aws-s3';
import { AuthorizationType, Cors, LambdaIntegration, LambdaRestApi, RestApi } from 'aws-cdk-lib/aws-apigateway';

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

    const restApi = new RestApi(this, withStage(props, 'ImportProductsRestApi-id'), {
      restApiName: withStage(props, 'ImportProductsRestApi-name'),
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      deployOptions: {
        stageName: props.stage.toLowerCase(),
      }
    });

    const importEndpoint = restApi.root.addResource("import");
    const importIntegration = new LambdaIntegration(importLambda, {
      requestParameters: {
        'integration.request.querystring.name': 'method.request.querystring.name',
      }
    });

    importEndpoint.addMethod("GET", importIntegration, {
      apiKeyRequired: false,
      authorizationType: AuthorizationType.NONE,
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
