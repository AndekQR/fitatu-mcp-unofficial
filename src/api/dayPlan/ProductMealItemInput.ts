import { CatalogMealItemInput } from "./CatalogMealItemInput.ts";

export class ProductMealItemInput extends CatalogMealItemInput {
	declare public readonly foodType: "PRODUCT";
	declare public readonly productId: string | number;
}
