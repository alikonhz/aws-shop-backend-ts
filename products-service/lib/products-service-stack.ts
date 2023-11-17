import * as cdk from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigatewayv2-alpha';
import * as path from 'path';

import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ProductsServiceStack extends cdk.Stack {

  private lambdaProps: Partial<NodejsFunctionProps> = {
    runtime: awslambda.Runtime.NODEJS_18_X,
    environment: {
      PRODUCT_AWS_REGION: process.env.PRODUCT_AWS_REGION!,
    }
  };

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigw.HttpApi(this, 'ProductApi', {
      corsPreflight: {
        allowHeaders: ['*'],
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
      }
    });

    api.addRoutes(this.createProductsListRoute());
    api.addRoutes(this.createProductByIdRoute());

    console.log(api.url);
  }

  private createProductsListRoute(): ApiGwIntegration {
    const getProductsListLambda = new NodejsFunction(this, 'GetProductsListLambda', {
      ...this.lambdaProps,
      functionName: 'getProductsList',
      entry: path.join(__dirname, '../src/handlers/getProductsList.ts'),
    });

    return {
      integration: new HttpLambdaIntegration('GetProductsListIntegration', getProductsListLambda),
      path: '/products',
      methods: [apigw.HttpMethod.GET],
    };
  }

  private createProductByIdRoute(): ApiGwIntegration {
    const getProductsByIdLambda = new NodejsFunction(this, 'GetProductsByIdLambda', {
      ...this.lambdaProps,
      functionName: 'getProductsById',
      entry: path.join(__dirname, '../src/handlers/getProductById.ts'),
    });

    return {
      integration: new HttpLambdaIntegration('GetProductsListIntegration', getProductsByIdLambda),
      path: '/products/{productId}',
      methods: [apigw.HttpMethod.GET],
    };
  }

}

interface ApiGwIntegration {
  integration: HttpLambdaIntegration;
  path: string;
  methods: apigw.HttpMethod[];
}
