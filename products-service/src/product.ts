export class Product {
    public productid: string;
    public title: string;
    public description?: string;
    public price?: number;

    constructor(productid: string, title: string, description?: string, price?: number) {
        this.productid = productid;
        this.title = title;
        this.description = description;
        this.price = price;
    }
}