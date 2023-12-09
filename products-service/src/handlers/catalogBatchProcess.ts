import { ValidationError, getErrorMessage } from '../errors';
import { buildResponse } from '../utils';
import { validate } from '../product';
import { createProduct } from '../aws-create-product';
import {SNSClient, PublishCommand} from '@aws-sdk/client-sns';
import { ProductDto } from '../product-dto';

export const handler = async (event: any) => {
    try {
        console.log('catalogBatchProcess: starting')
        console.log('catalogBatchProcess: event data: ', JSON.stringify(event));

        const createdProducts: ProductDto[] = [];
        for (let i = 0; i < event.Records.length; i++) {
            const data = JSON.parse(event.Records[i].body);
            const errOrProduct = validate(data);
            if (errOrProduct instanceof ValidationError) {
                console.error('validation error: ', JSON.stringify(errOrProduct));
            } else {
                await createProduct(errOrProduct);
                createdProducts.push(errOrProduct);
            }
        }

        if (createdProducts.length > 0) {

            const j = createdProducts.map((p) => `${p.title} (${p.id})`).join('\n');
            const props = createdProducts.map((p) => p.title ?? 0);
            const propsJ = JSON.stringify(props);
            console.log('catalogBatchProcess: sending message to SNS: ', j);

            const snsClient = new SNSClient({});
            const command = new PublishCommand({
                TopicArn: process.env.SNS_TOPIC!,
                Message: j,
                MessageAttributes: {
                    'title': {
                        DataType: 'String.Array',
                        StringValue: propsJ
                    }
                }
            });

            const snsResponse = await snsClient.send(command);
            console.log('catalogBatchProcess: sns response: ', JSON.stringify(snsResponse));
        }
        
        return buildResponse(200, event);
    } catch(err) {
        console.error('error: ', err);
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
};