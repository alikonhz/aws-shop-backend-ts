export class Stock {
    public productId: string;
    public count: number;

    constructor(productId: string, count: number) {
        this.productId = productId;
        this.count = count;
    }
}