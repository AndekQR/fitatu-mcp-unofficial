export abstract class CatalogMealItemInput {
	declare public readonly measureId: string | number;
	declare public readonly measureQuantity?: number;
	declare public readonly eaten?: boolean;
}
