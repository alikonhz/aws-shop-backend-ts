import { randomUUID } from "crypto";
import { ValidationError } from "./errors";
import { ProductDto } from "./product-dto";

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

export function validate(data: any): ValidationError | ProductDto {
    const count = data.count == null ? 0 : Number(data.count);
    const price = Number(data.price);

    const errors: string[] = [];
    if (isNaN(price)) {
        errors.push('price must be a number >= 0');
    }
    if (isNaN(count)) {
        errors.push('count must be a zero or a positive number');
    }

    if (errors.length > 0) {
        return new ValidationError(errors);
    }

    const p: ProductDto = {
        count: count,
        price: price,
        description: data.description,
        title: data.title,
        id: '',
    };

    if (p.count < 0) {
        errors.push('count must be >= 0');
    }
    if (p.price == null || p.price <= 0) {
        errors.push('price must be > 0');
    }
    if (p.title == null) {
        errors.push('title must be set');
    }

    if (errors.length > 0) {
        // error
        return new ValidationError(errors);
    }

    const id = randomUUID();
    p.id = id;

    return p;
}
