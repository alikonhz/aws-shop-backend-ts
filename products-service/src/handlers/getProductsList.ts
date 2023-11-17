import { allProducts } from '../constants';
import { getErrorMessage } from '../errors';
import { buildResponse } from '../utils';

export const handler = async () => {
    try {
        return buildResponse(200, allProducts);
    } catch (err) {
        return buildResponse(500, {
            message: getErrorMessage(err),
        });
    }
}