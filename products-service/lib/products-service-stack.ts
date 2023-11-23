import * as cdk from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigw from '@aws-cdk/aws-apigatewayv2-alpha';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface ProductsStackOptions extends cdk.StackProps {
  stage: string
}

export type ProductsApiOptions =  ProductsStackOptions & DynamoDbProps;

function withStage(props: ProductsStackOptions, param: string): string {
  return `${props.stage.toUpperCase()}-${param}`;
}

export class ProductsServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProductsStackOptions) {
    super(scope, id, props);

    const db = new ProductsDb(this, withStage(props, 'ProducstService-db'), props);

    const opts: ProductsApiOptions = Object.assign({}, props, db.props);
    
    new cdk.CfnOutput(this, withStage(props, 'ProductsTable'), {
      value: db.props.productsTable,
    });
    new cdk.CfnOutput(this, withStage(props, 'StocksTable'), {
      value: db.props.stocksTable,
    });

    new ProductsApi(this, withStage(props, 'ProductsService-api'), opts );
  }
}

export class DynamoDbProps {
  productsTable: string;
  productsArn: string;
  stocksTable: string;
  stocksArn: string;

  constructor(productsTable: string, productsArn: string, stocksTable: string, stocksArn: string) {
    this.productsTable = productsTable;
    this.productsArn = productsArn;
    this.stocksTable = stocksTable;
    this.stocksArn = stocksArn;
  }
}

export class ProductsDb extends Construct {
  
  public props: DynamoDbProps;

  constructor(scope: Construct, id: string, props: ProductsStackOptions) {
    super(scope, id)

    const prodTable = new dynamodb.TableV2(this, withStage(props, 'Products'), {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
      billing: dynamodb.Billing.onDemand(),
    });
    
    const stocksTable = new dynamodb.TableV2(this, withStage(props, 'Stocks'), {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
      billing: dynamodb.Billing.onDemand(),
    });

    this.props = new DynamoDbProps(prodTable.tableName, prodTable.tableArn, stocksTable.tableName, stocksTable.tableArn);
  }
}

export class ProductsApi extends Construct {

  private lambdaProps(props: ProductsApiOptions): Partial<NodejsFunctionProps> {
    return   {
      runtime: awslambda.Runtime.NODEJS_18_X,
      environment: {
        PRODUCT_AWS_REGION: process.env.PRODUCT_AWS_REGION!,
        DYNAMO_PRODUCTS: props.productsTable,
        DYNAMO_STOCKS: props.stocksTable,
      }
    }
  };

  constructor(scope: Construct, id: string, props: ProductsApiOptions) {
    super(scope, id);

    const api = new apigw.HttpApi(this, withStage(props, 'ProductApi'), {
      corsPreflight: {
        allowHeaders: ['*'],
        allowOrigins: ['*'],
        allowMethods: [apigw.CorsHttpMethod.ANY],
      }
    });

    api.addRoutes(this.createProductsListRoute(props));
    api.addRoutes(this.createProductByIdRoute(props));

    new cdk.CfnOutput(this, withStage(props, 'Products-API-URL'), {
      value: api.apiEndpoint,
    })
  }

  private createProductsListRoute(props: ProductsApiOptions): ApiGwIntegration {
    const getProductsListLambda = new NodejsFunction(this, withStage(props, 'GetProductsListLambda'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, 'getProductsList'),
      entry: path.join(__dirname, '../src/handlers/getProductsList.ts'),
    });

    getProductsListLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan'],
      resources: [props.productsArn],
    }));
    getProductsListLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Scan'],
      resources: [props.stocksArn],
    }));

    return {
      integration: new HttpLambdaIntegration(withStage(props, 'GetProductsListIntegration'), getProductsListLambda),
      path: '/products',
      methods: [apigw.HttpMethod.GET],
    };
  }

  private createProductByIdRoute(props: ProductsApiOptions): ApiGwIntegration {
    const getProductsByIdLambda = new NodejsFunction(this, withStage(props, 'GetProductsByIdLambda'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, 'getProductsById'),
      entry: path.join(__dirname, '../src/handlers/getProductById.ts'),
    });

    getProductsByIdLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem'],
      resources: [props.productsArn],
    }));
    getProductsByIdLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem'],
      resources: [props.stocksArn],
    }));


    return {
      integration: new HttpLambdaIntegration(withStage(props, 'GetProductsListIntegration'), getProductsByIdLambda),
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
