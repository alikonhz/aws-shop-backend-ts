import { allProducts } from '../constants';
import { getErrorMessage } from '../errors';
import { buildResponse } from '../utils';

export const handler = async (event: any) => {
    try {
        const { productId } = event.pathParameters;
        if (productId == null || productId === '') {
            return buildResponse(400, {
                message: 'product id is required'
            });
        }

        const product = allProducts.find((p) => p.id === productId);
        if (product == null) {
            return buildResponse(404, {
                message: `product ${productId} doesn't exist`
            });
        }

        return buildResponse(200, product);
    } catch(err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
};