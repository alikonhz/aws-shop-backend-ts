import { getErrorMessage } from '../errors';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: any) => {
    try {
        console.log('getProductsList: starting')
        console.log('getProductsList: event data: ', event);

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const command = new ScanCommand({
            TableName: process.env.DYNAMO_PRODUCTS,
            ProjectionExpression: "id, title, description, price",
        });

        console.log('getProductsList: sending request to DynamoDB: ', command);

        const response = await docClient.send(command);

        console.log('getProductsList: got response from DynamoDB: ', response);

        return buildResponse(200, response.Items);
    } catch (err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
}