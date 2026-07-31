import { CatalogMealItemInput } from "./CatalogMealItemInput.ts";

export class ProductMealItemInput extends CatalogMealItemInput {
	public readonly foodType = "PRODUCT";
	public readonly productId: string | number;

	public constructor(
		productId: string | number,
		measureId: string | number,
		measureQuantity?: number,
		eaten?: boolean,
	) {
		super(measureId, measureQuantity, eaten);
		this.productId = productId;
	}
}
