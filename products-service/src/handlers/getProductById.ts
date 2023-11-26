import { getErrorMessage } from '../errors';
import { ProductDto } from '../product-dto';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: any) => {
    try {
        console.log('getProductById: starting')
        console.log('getProductById: event data: ', event);

        const { productId } = event.pathParameters;
        if (productId == null || productId === '') {
            return buildResponse(400, {
                message: 'product id is required'
            });
        }

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const prodTable = process.env.DYNAMO_PRODUCTS!;
        const stocksTable = process.env.DYNAMO_STOCKS!;
        const command = new BatchGetCommand({
            RequestItems: {
                [prodTable]: {
                    Keys: [
                        {
                            productid: productId
                        }
                    ]
                },
                [stocksTable]: {
                    Keys: [
                        {
                            productid: productId
                        }
                    ]
                }
            }
        })

        console.log('getProductById: sending request to DynamoDB: ', command);

        const response = await docClient.send(command);

        console.log('getProductById: got response from DynamoDB: ', response);

        if (response.Responses == null) {
            return buildResponse(404, {
                message: `product ${productId} doesn't exist`
            });
        }

        const products = response.Responses[prodTable];
        const stocks = response.Responses[stocksTable];
        if (products == null || products.length == 0) {
            return buildResponse(404, {
                message: `product ${productId} doesn't exist`
            });
        }

        const p = products[0];
        const s = stocks != null && stocks.length > 0 ? stocks[0] : null;

        const res: ProductDto = {
            id: p.productid,
            title: p.title,
            description: p.description,
            price: p.price,
            count: s?.count,
        }

        return buildResponse(200, res);
    } catch(err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
};