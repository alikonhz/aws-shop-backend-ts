import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SQSEvent } from 'aws-lambda';
import { handler } from './catalogBatchProcess';
import { ProductDto } from '../product-dto';
import { randomUUID } from 'crypto';

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

describe('handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    snsMock.reset();
  });

  it('handles valid products and sends messages to SNS', async () => {

    let snsCallsCount = 0;
    function generateMessageId() {
      snsCallsCount++;
      return randomUUID() + '-generateMessageId';
    }
    let dynCallsCount = 0;
    function generateDynamoResponse() {
      dynCallsCount++;
      return 200;
    }

    snsMock.on(PublishCommand).resolves({
      MessageId: generateMessageId(),
    });
    ddbMock.on(TransactWriteCommand).resolves({
      $metadata: {
        httpStatusCode: generateDynamoResponse()
      }
    });
    const p: ProductDto = {
      id: 'id1',
      count: 1,
      title: 'title 1',
      description: 'description 1',
      price: 12
    };
    await handler({
      Records: [
        {
          body: JSON.stringify(p)
        }
      ]
    });

    expect(snsCallsCount).toBe(1);
    expect(dynCallsCount).toBe(1);
  });
});
