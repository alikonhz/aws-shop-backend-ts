import * as cdk from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigw from '@aws-cdk/aws-apigatewayv2-alpha';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

import { Construct } from 'constructs';

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
      partitionKey: { name: 'productid', type: dynamodb.AttributeType.STRING },
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
      billing: dynamodb.Billing.onDemand(),
    });
    
    const stocksTable = new dynamodb.TableV2(this, withStage(props, 'Stocks'), {
      partitionKey: { name: 'productid', type: dynamodb.AttributeType.STRING },
      tableClass: dynamodb.TableClass.STANDARD_INFREQUENT_ACCESS,
      billing: dynamodb.Billing.onDemand(),
    });

    this.props = new DynamoDbProps(prodTable.tableName, prodTable.tableArn, stocksTable.tableName, stocksTable.tableArn);
  }
}

export class ProductsApi extends Construct {

  private lambdaProps(props: ProductsApiOptions): Partial<NodejsFunctionProps> {
    return  {
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
    api.addRoutes(this.createNewProductRoute(props));

    this.createCatalogBatchProcess(props);
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
      resources: [props.productsArn,props.stocksArn],
    }));

    return {
      integration: new HttpLambdaIntegration(withStage(props, 'GetProductsListIntegration'), getProductsListLambda),
      path: '/products',
      methods: [apigw.HttpMethod.GET],
    };
  }

  private createNewProductRoute(props: ProductsApiOptions): ApiGwIntegration {
    const createProductLambda = new NodejsFunction(this, withStage(props, 'CreateProductLambda'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, "createProduct"),
      entry: path.join(__dirname, '../src/handlers/createProduct.ts'),
    });
    createProductLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
      resources: [props.productsArn, props.stocksArn]
    }));

    return {
      integration: new HttpLambdaIntegration(withStage(props, 'CreateProductIntegration'), createProductLambda),
      path: '/products',
      methods: [apigw.HttpMethod.POST, apigw.HttpMethod.PUT],
    }
  }

  private createProductByIdRoute(props: ProductsApiOptions): ApiGwIntegration {
    const getProductsByIdLambda = new NodejsFunction(this, withStage(props, 'GetProductsByIdLambda'), {
      ...this.lambdaProps(props),
      functionName: withStage(props, 'getProductsById'),
      entry: path.join(__dirname, '../src/handlers/getProductById.ts'),
    });

    getProductsByIdLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:BatchGetItem', 'dynamodb:GetItem'],
      resources: [props.productsArn, props.stocksArn],
    }));


    return {
      integration: new HttpLambdaIntegration(withStage(props, 'GetProductsListIntegration'), getProductsByIdLambda),
      path: '/products/{productId}',
      methods: [apigw.HttpMethod.GET],
    };
  }

  private createCatalogBatchProcess(props: ProductsApiOptions) {
    const queueName = withStage(props, 'CatalogItemsQueue-Name');
    const sqsQueue = new sqs.Queue(this, withStage(props, 'CatalogItemsQueue'), {
      queueName: queueName,
    });

    const snsTopic = new sns.Topic(this, withStage(props, 'CatalogBatchProcess-SNS-TS'));

    const carFilter = {
      title: sns.SubscriptionFilter.stringFilter({
        matchPrefixes: ['Car']
      }),
    };
    snsTopic.addSubscription(new subs.EmailSubscription(process.env.SNS_TARGET_EMAIL!));
    snsTopic.addSubscription(new subs.EmailSubscription(process.env.SNS_TARGET_PRIO_EMAIL!, {filterPolicy: carFilter}));

    const fnProps = { ...this.lambdaProps(props) };
    fnProps.environment!.SNS_TOPIC = snsTopic.topicArn;

    const catalogBatchProcessFn = new NodejsFunction(this, withStage(props, 'CatalogBatchProcess'), {
      ...fnProps,
      functionName: withStage(props, 'catalogBatchProcess'),
      entry: path.join(__dirname, '../src/handlers/catalogBatchProcess.ts'),
    });
    catalogBatchProcessFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
      resources: [props.productsArn, props.stocksArn]
    }));
    catalogBatchProcessFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:ReceiveMessage'],
      resources: [sqsQueue.queueArn],
    }));
    catalogBatchProcessFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:publish'],
      resources: [snsTopic.topicArn],
    }));

    catalogBatchProcessFn.addEventSource(new lambdaEventSources.SqsEventSource(sqsQueue, {
      batchSize: 5,
      maxBatchingWindow: cdk.Duration.seconds(5),
    }));

    new cdk.CfnOutput(this, withStage(props, 'SQS_QUEUE_URL'), {
      value: sqsQueue.queueUrl,
      exportName: withStage(props, 'SQS-QUEUE-URL')
    });
    new cdk.CfnOutput(this, withStage(props, 'SQS_QUEUE_ARN'), {
      value: sqsQueue.queueArn,
      exportName: withStage(props, 'SQS-QUEUE-ARN')
    });
  }
}

interface ApiGwIntegration {
  integration: HttpLambdaIntegration;
  path: string;
  methods: apigw.HttpMethod[];
}
