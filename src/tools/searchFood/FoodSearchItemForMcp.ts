import type { FoodSearchItem } from "../../api/foodSearch/FoodSearchResult.ts";
import { FoodMeasureForMcp } from "./FoodMeasureForMcp.ts";

export class FoodSearchItemForMcp {
	public readonly index: number;
	public readonly source: FoodSearchItem["source"];
	public readonly foodId: string;
	public readonly productId: string;
	public readonly foodType: string | null;
	public readonly name: string | null;
	public readonly displayName: string;
	public readonly brand: string | null;
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly measureQuantity: number | null;
	public readonly weightG: number | null;
	public readonly kcal: number | null;
	public readonly verified: boolean | null;
	public readonly photoUrl: string | null;
	public readonly matchScore: number;
	public readonly measures: readonly FoodMeasureForMcp[];

	public constructor(item: FoodSearchItem) {
		this.index = item.index;
		this.source = item.source;
		this.foodId = item.foodId;
		this.productId = item.productId;
		this.foodType = item.foodType;
		this.name = item.name;
		this.displayName = item.displayName;
		this.brand = item.brand;
		this.measureId = item.measureId;
		this.measureName = item.measureName;
		this.measureQuantity = item.measureQuantity;
		this.weightG = item.weightG;
		this.kcal = item.kcal;
		this.verified = item.verified;
		this.photoUrl = item.photoUrl;
		this.matchScore = item.matchScore;
		this.measures = item.measures.map((measure) => new FoodMeasureForMcp(measure));
	}
}
