import type { FoodMeasure } from "./FoodMeasure.ts";
import type { FoodNutrition } from "./FoodNutrition.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";
import type { FoodTypeName } from "../dayPlan/FoodType.ts";

export class NormalizedFoodSearchItem {
	public readonly source: FoodSearchSource;
	public readonly foodId: string;
	public readonly foodType: FoodTypeName;
	public readonly name: string | null;
	public readonly brand: string | null;
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly measureQuantity: number | null;
	public readonly weightG: number | null;
	public readonly kcal: number | null;
	public readonly nutritionPer100g: FoodNutrition;
	public readonly nutritionPerDefaultMeasure: FoodNutrition;
	public readonly verified: boolean | null;
	public readonly photoUrl: string | null;
	public readonly matchScore: number;
	public readonly measures: readonly FoodMeasure[];

	public constructor(item: NormalizedFoodSearchItem);
	public constructor(
		source: FoodSearchSource,
		foodId: string,
		foodType: FoodTypeName,
		name: string | null,
		brand: string | null,
		measureId: string | null,
		measureName: string | null,
		measureQuantity: number | null,
		weightG: number | null,
		kcal: number | null,
		nutritionPer100g: FoodNutrition,
		nutritionPerDefaultMeasure: FoodNutrition,
		verified: boolean | null,
		photoUrl: string | null,
		matchScore: number,
		measures: readonly FoodMeasure[],
	);
	public constructor(
		itemOrSource: NormalizedFoodSearchItem | FoodSearchSource,
		foodId?: string,
		foodType?: FoodTypeName,
		name?: string | null,
		brand?: string | null,
		measureId?: string | null,
		measureName?: string | null,
		measureQuantity?: number | null,
		weightG?: number | null,
		kcal?: number | null,
		nutritionPer100g?: FoodNutrition,
		nutritionPerDefaultMeasure?: FoodNutrition,
		verified?: boolean | null,
		photoUrl?: string | null,
		matchScore?: number,
		measures?: readonly FoodMeasure[],
	) {
		if (itemOrSource instanceof NormalizedFoodSearchItem) {
			this.source = itemOrSource.source;
			this.foodId = itemOrSource.foodId;
			this.foodType = itemOrSource.foodType;
			this.name = itemOrSource.name;
			this.brand = itemOrSource.brand;
			this.measureId = itemOrSource.measureId;
			this.measureName = itemOrSource.measureName;
			this.measureQuantity = itemOrSource.measureQuantity;
			this.weightG = itemOrSource.weightG;
			this.kcal = itemOrSource.kcal;
			this.nutritionPer100g = itemOrSource.nutritionPer100g;
			this.nutritionPerDefaultMeasure = itemOrSource.nutritionPerDefaultMeasure;
			this.verified = itemOrSource.verified;
			this.photoUrl = itemOrSource.photoUrl;
			this.matchScore = itemOrSource.matchScore;
			this.measures = itemOrSource.measures;
			return;
		}

		this.source = itemOrSource;
		this.foodId = requireFoodSearchValue(foodId, "foodId");
		this.foodType = requireFoodSearchValue(foodType, "foodType");
		this.name = requireFoodSearchValue(name, "name");
		this.brand = requireFoodSearchValue(brand, "brand");
		this.measureId = requireFoodSearchValue(measureId, "measureId");
		this.measureName = requireFoodSearchValue(measureName, "measureName");
		this.measureQuantity = requireFoodSearchValue(measureQuantity, "measureQuantity");
		this.weightG = requireFoodSearchValue(weightG, "weightG");
		this.kcal = requireFoodSearchValue(kcal, "kcal");
		this.nutritionPer100g = requireFoodSearchValue(nutritionPer100g, "nutritionPer100g");
		this.nutritionPerDefaultMeasure = requireFoodSearchValue(
			nutritionPerDefaultMeasure,
			"nutritionPerDefaultMeasure",
		);
		this.verified = requireFoodSearchValue(verified, "verified");
		this.photoUrl = requireFoodSearchValue(photoUrl, "photoUrl");
		this.matchScore = requireFoodSearchValue(matchScore, "matchScore");
		this.measures = requireFoodSearchValue(measures, "measures");
	}

	public withMatchScore(matchScore: number): NormalizedFoodSearchItem {
		return this.copy(this.nutritionPer100g, this.verified, this.photoUrl, matchScore, this.measures);
	}

	public withDetails(
		nutritionPer100g: FoodNutrition,
		verified: boolean | null,
		photoUrl: string | null,
		measures: readonly FoodMeasure[],
	): NormalizedFoodSearchItem {
		return this.copy(nutritionPer100g, verified, photoUrl, this.matchScore, measures);
	}

	private copy(
		nutritionPer100g: FoodNutrition,
		verified: boolean | null,
		photoUrl: string | null,
		matchScore: number,
		measures: readonly FoodMeasure[],
	): NormalizedFoodSearchItem {
		return new NormalizedFoodSearchItem(
			this.source,
			this.foodId,
			this.foodType,
			this.name,
			this.brand,
			this.measureId,
			this.measureName,
			this.measureQuantity,
			this.weightG,
			this.kcal,
			nutritionPer100g,
			this.nutritionPerDefaultMeasure,
			verified,
			photoUrl,
			matchScore,
			measures,
		);
	}
}

function requireFoodSearchValue<T>(value: T | undefined, field: string): T {
	if (value === undefined) {
		throw new Error(`Normalized food search item constructor requires ${field}`);
	}
	return value;
}
