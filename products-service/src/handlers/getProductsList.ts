import { getErrorMessage } from '../errors';
import { Product } from '../product';
import { ProductDto } from '../product-dto';
import { Stock } from '../stock';
import { buildResponse } from '../utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export const handler = async (event: any) => {
    try {
        console.log('getProductsList: starting')
        console.log('getProductsList: event data: ', event);

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);
        const products = await getProducts(docClient);
        const stocks = await getStocks(docClient);
        
        console.log('products: ', products);
        console.log('stocks: ', stocks);

        const result: ProductDto[] = [];

        for (const [key, product] of products) {
            const stock = stocks.get(key);
            const count = stock?.count ?? 0;
            result.push({
                id: product.productid,
                count: count,
                title: product.title,
                description: product.description,
                price: product.price,
            });
        }

        return buildResponse(200, result);
    } catch (err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
}

async function getStocks(docClient: DynamoDBDocumentClient): Promise<Map<string, Stock>> {
    const command = new ScanCommand({
        TableName: process.env.DYNAMO_STOCKS,
        ProjectionExpression: "productid, #count",
        ExpressionAttributeNames: { "#count": "count"},
    });

    console.log('getStocks: sending request to DynamoDB: ', command);

    const response = await docClient.send(command);
    console.log('getStocks: got response from DynamoDB: ', response);

    const stocks: Map<string, Stock> = new Map<string, Stock>();

    if (response.Items != null) {
        for (let i = 0; i < response.Items.length; i++) {
            const p = response.Items[i];
            const stock = new Stock(p.productid, p.count);
            stocks.set(stock.productId, stock);
        }
    }

    return stocks;
}

async function getProducts(docClient: DynamoDBDocumentClient): Promise<Map<string, Product>> {
    const command = new ScanCommand({
        TableName: process.env.DYNAMO_PRODUCTS,
        ProjectionExpression: "productid, title, description, price",
    });

    console.log('getProductsList: sending request to DynamoDB: ', command);

    const response = await docClient.send(command);
    console.log('getProductsList: got response from DynamoDB: ', response);

    const products = new Map<string, Product>();

    if (response.Items != null) {
        for (let i = 0; i < response.Items.length; i++) {
            const p = response.Items[i];
            const product = new Product(p.productid, p.title, p.description, p.price);
            products.set(product.productid, product);
        }
    }

    return products;
}