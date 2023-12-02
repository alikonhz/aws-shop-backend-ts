import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileParserResponse, handler } from './importFileParser';
import {mockClient} from 'aws-sdk-client-mock';
import {sdkStreamMixin} from '@aws-sdk/util-stream-node';
import { Readable } from 'stream';

const s3Mock = mockClient(S3Client);

describe('handler', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('should process S3 event and perform required operations', async () => {
    const stream = new Readable();
    stream.push('title,description,price,count');
    stream.push('product 1,description 1,12,20');
    stream.push(null);

    const sdkStream = sdkStreamMixin(stream);
    s3Mock.on(GetObjectCommand).resolves({
        Body: sdkStream,
    });
    const copyVersionId = '100500';
    s3Mock.on(CopyObjectCommand).resolves({
        $metadata: {
            httpStatusCode: 200,
        },
        VersionId: copyVersionId,
    });
    const deleteVersionId = '200500';
    s3Mock.on(DeleteObjectCommand).resolves({
        $metadata: {
            httpStatusCode: 200,
        },
        VersionId: deleteVersionId,
    });

    const event = {
      Records: [
        {
          s3: {
              bucket: {
                  name: 'source-bucket',
              },
              object: {
                  key: 'uploaded/example.csv',
              },
          },
        },
      ],
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const b = result.body as FileParserResponse;
    expect(b.copyResult).toBe(copyVersionId);
    expect(b.deleteResult).toBe(deleteVersionId);
    expect(b.parseResult).toBe('done');
  });
});
