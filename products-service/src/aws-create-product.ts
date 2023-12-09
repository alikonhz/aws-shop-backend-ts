import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand, TransactWriteCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ProductDto } from "./product-dto";

export async function createProduct(p: ProductDto): Promise<TransactWriteCommandOutput> {
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

    return response;
}