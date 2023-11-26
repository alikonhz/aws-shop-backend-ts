import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ProductDto } from "./product-dto";
import { randomUUID } from "crypto";
import * as dotenv from 'dotenv';

async function generateProducts() {
    dotenv.config();

    console.log('creating DB client');

    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    
    console.log('starting import');

    for(let i = 1; i < 20; i++) {
        const p: ProductDto = {
            id: randomUUID(),
            count: i,
            price: 10*i + 0.1 * i,
            title: `Auto product ${i}`,
            description: `Audo description ${i}`,
        }
        console.log('generateProducts: ', i);
        await createNewProduct(docClient, p);
    }
}

async function createNewProduct(client: DynamoDBDocumentClient, p: ProductDto) {
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

    const response = await client.send(command);
    const status = response.$metadata.httpStatusCode ?? 500;
    if (status >= 200 && status < 300) {
        return;
    }

    throw new Error('failed to create product: ' + response);
}

(async () => {
    await generateProducts();
})();