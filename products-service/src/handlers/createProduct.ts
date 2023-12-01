import { ValidationError, getErrorMessage } from '../errors';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ProductDto } from '../product-dto';


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
        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const command = new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: process.env.DYNAMO_PRODUCTS,
                        Item: {
                            productid: p.id,
                            title: p.title,
                            description: p.description,
                            price: p.price,
                        }
                        
                    },
                },
                {
                    Put: {
                        TableName: process.env.DYNAMO_STOCKS,
                        Item: {
                            productid: p.id,
                            count: p.count,
                        },
                    }
                }
            ]
        });

        console.log('createProduct: sending request to DynamoDB: ', command);

        const response = await docClient.send(command);

        console.log('createProduct: got response from DynamoDB: ', response);

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

function validate(data: any): ValidationError | ProductDto {
    const count = data.count == null ? 0 : Number(data.count);
    const price = Number(data.price);

    const errors: string[] = [];
    if (isNaN(price)) {
        errors.push('price must be a number >= 0');
    }
    if (isNaN(count)) {
        errors.push('count must be a zero or a positive number');
    }

    if (errors.length > 0) {
        return new ValidationError(errors);
    }

    const p: ProductDto = {
        count: count,
        price: price,
        description: data.description,
        title: data.title,
        id: '',
    };

    if (p.count < 0) {
        errors.push('count must be >= 0');
    }
    if (p.price == null || p.price <= 0) {
        errors.push('price must be > 0');
    }
    if (p.title == null) {
        errors.push('title must be set');
    }

    if (errors.length > 0) {
        // error
        return new ValidationError(errors);
    }

    const id = randomUUID();
    p.id = id;

    return p;
}
