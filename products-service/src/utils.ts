export const buildResponse = (statusCode: number, body: any) => ({
    statusCode: statusCode,
    headers: {
        //'Access-Control-Allow-Credentials': true, //TODO: 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
    },
    body: JSON.stringify(body)
});