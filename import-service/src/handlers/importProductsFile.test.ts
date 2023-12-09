import { handler } from './importProductsFile';
import { mocked } from 'jest-mock';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';
import {expect, jest, test} from '@jest/globals';

// Mocking the external libraries
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('@aws-sdk/client-s3');

describe('handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return signed URL when valid file name provided', async () => {

    const event = {
        queryStringParameters: {
            name: 'test'
        } as APIGatewayProxyEvent['queryStringParameters']
    } as APIGatewayProxyEvent;

    const mockedGetSignedUrl = mocked(getSignedUrl);
    mockedGetSignedUrl.mockResolvedValue('mocked-signed-url');

    jest.mocked(S3Client);
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('mocked-signed-url');
  });

  it('should return 400 when query string is empty', async () => {
    const event: APIGatewayProxyEvent = {
      queryStringParameters: null,
    } as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(result.body).toBe('"query string is empty"');
  });
});
