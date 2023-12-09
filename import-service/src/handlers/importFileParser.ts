import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, S3, S3Client } from "@aws-sdk/client-s3";
import { buildResponse } from "../../utils";
import { Readable } from "stream";
import csvParser = require("csv-parser");

export const handler = async (event: any) => {
    console.log('importFileParser: starting')
    console.log('importFileParser: event data: ', event);

    try {

        const bucket = event.Records[0].s3.bucket.name;
        const key = event.Records[0].s3.object.key;

        const client = new S3Client({});

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const resp = await client.send(command);

        const readable = resp.Body as Readable;
        
        if (readable == null) {
            return buildResponse(500, {
                error: 'unable to open S3 object as Readable',
            });
        }
        
        const targetBucket = process.env.S3_BUCKET!;

        const promise = new Promise<string>((resolve, reject) => {
            readable.pipe(csvParser())
                .on('data', (row) => {
                    console.log('CSV row:', row);
                })
                .on('end', () => {
                    console.log('CSV EOF');
                    resolve('done');
                })
                .on('error', (error) => {
                    console.error('error occurred while parsing CSV file:', error);
                    reject(error);
                });
        });
        
        const result = await promise;

        const copyCommand = new CopyObjectCommand({
            CopySource: `/${bucket}/${key}`,
            Bucket: targetBucket,

            Key: key.replace('uploaded', 'parsed')
        });

        const copyResponse = await client.send(copyCommand);
        if (copyResponse.$metadata.httpStatusCode !== 200) {
            console.error('copy request failed: ', JSON.stringify(copyResponse))
            return buildResponse(500, {
                message: `copy request failed. see ${copyResponse.$metadata.requestId}`,
            });
        }

        console.log('file copied successfully');

        const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const deleteResponse = await client.send(deleteCommand);

        // we can't do anything if it fails so just report the return code
        console.log('file delete response: ', deleteResponse.$metadata.httpStatusCode);

        const body: FileParserResponse = {
            copyResult: copyResponse.VersionId,
            deleteResult: deleteResponse.VersionId,
            parseResult: result,
        };
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': 'text/plain',
            },
            body: body,
        }
    } catch(err) {
        console.error(err);
        return buildResponse(500, err);
    }
}

export interface FileParserResponse {
    copyResult?: string;
    deleteResult?: string;
    parseResult?: string;
}