import { ValidationError, getErrorMessage } from '../errors';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ProductDto } from '../product-dto';
import { validate } from '../product';
import { createProduct } from '../aws-create-product';


export const handler = async (event: APIGatewayProxyEvent) => {
    try {
        console.log('createProduct: starting')
        console.log('createProduct: event data: ', event);

        if (event.body == null) {
            return buildResponse(400, "body must not be empty")
        }

        const data = JSON.parse(event.body);
        const errOrProduct = validate(data);

        if (errOrProduct instanceof ValidationError) {
            return buildResponse(400, errOrProduct);
        }

        const p = errOrProduct as ProductDto;
        const response = await createProduct(p);

        const status = response.$metadata.httpStatusCode ?? 500;
        if (status >= 200 && status < 300) {
            return buildResponse(200, p)
        }

        console.log('createProduct: unexpected status code from DynamoDB: ', response.$metadata.httpStatusCode);

        return buildResponse(500, {
            message: 'failed to create new product',
        });
    } catch (err) {
        console.log('createProduct: error: ', err);
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
}

