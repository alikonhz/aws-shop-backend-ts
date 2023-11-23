import { getErrorMessage } from '../errors';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

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
        const command = new GetCommand({
            TableName: process.env.DYNAMO_PRODUCTS,
            Key: {
                id: productId,
            }
        });

        console.log('getProductById: sending request to DynamoDB: ', command);

        const response = await docClient.send(command);

        console.log('getProductById: got response from DynamoDB: ', response);

        if (response.Item == null) {
            return buildResponse(404, {
                message: `product ${productId} doesn't exist`
            });
        }

        return buildResponse(200, response.Item);
    } catch(err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
};