import * as swaggerJSDoc from 'swagger-jsdoc';
import * as YAML from 'js-yaml';

const options = {
    swaggerDefinition: {
        info: {
            title: 'Products service API',
            version: '1.0.0',
            description: 'Products service API',
        },
    },
    apis: ['./src/handlers/*.ts'],
};

const swaggerJSON = swaggerJSDoc(options);
const swaggerYAML = YAML.dump(swaggerJSON);
console.log(swaggerYAML);