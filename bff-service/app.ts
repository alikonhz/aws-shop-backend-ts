import express from 'express';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use('/cart', createProxyMiddleware({
    target: process.env.SERVICE_CART_URL,
    changeOrigin: true,
    pathRewrite: {'^/cart' : ''}
}));

app.use('/products', createProxyMiddleware({
    target: process.env.SERVICE_PRODUCTS_URL,
    changeOrigin: true,
    pathRewrite: {'^/products' : ''}
}));

app.use('/import', createProxyMiddleware({
    target: process.env.SERVICE_IMPORT_URL,
    changeOrigin: true,
    pathRewrite: {'^/import' : ''}
}));

app.use((_, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ statusCode: 502, message: 'Cannot process request' }));
});

app.listen(PORT, () => {
    console.log(`proxy is running on http://localhost:${PORT}`);
});