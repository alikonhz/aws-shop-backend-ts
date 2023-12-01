import { randomUUID } from "crypto";
import { buildResponse } from "../../utils"
import { APIGatewayProxyEvent } from 'aws-lambda';
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const handler = async (event: APIGatewayProxyEvent) => {
    console.log('importProductsFile: starting')
    console.log('importProductsFile: event data: ', event);

    if (event.queryStringParameters == null) {
        return buildResponse(400, "query string is empty");
    }

    const { name } = event.queryStringParameters!; // fileName
    
    const putObjectParams = {
        Bucket: process.env.S3_BUCKET!,
        Key: `uploaded/${name}`,
        ContentType: "text/csv",
    };
    const command = new PutObjectCommand(putObjectParams);
    const client = new S3Client({});
    const signedUrl = await getSignedUrl(client, command, { expiresIn: parseInt(process.env.URL_EXPIRATION_SECONDS || '300')})

    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Content-Type': 'text/plain',
        },
        body: signedUrl,
    }
}