import { allProducts } from '../constants';
import { handler } from './getProductById';

describe('getProductById', () => {
  it('should return 400 if productId is missing', async () => {
    const mockEvent = {
      pathParameters: {},
    };

    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(400);
  });

  it('should return 404 if product does not exist', async () => {
    const mockEvent = {
      pathParameters: {
        productId: 'nonexistentid',
      },
    };

    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(404);
  });

  it('should return 200 with product details if product exists', async () => {
    const mockProductId = allProducts[0].id;
    const mockEvent = {
      pathParameters: {
        productId: mockProductId,
      },
    };

    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(200);
  });

  it('should return 500 for unexpected errors', async () => {
    const mockProductId = allProducts[0].id;
    const mockEvent = {
      pathParameters: {
        productId: mockProductId,
      },
    };

    jest.spyOn(allProducts, 'find').mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await handler(mockEvent);
    expect(result.statusCode).toBe(500);
  });
});
