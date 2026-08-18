import { FoodType, type FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { FoodDetailsApiResponse } from "../../api/foodSearch/FoodDetailsApiResponse.ts";
import { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { FoodNutrition } from "../../api/foodSearch/FoodNutrition.ts";
import { FoodSearchItem } from "../../api/foodSearch/FoodSearchItem.ts";
import type { FoodSearchApiResponse } from "../../api/foodSearch/FoodSearchApiResponse.ts";
import type { FoodSearchQueryResult } from "../../api/foodSearch/FoodSearchQueryResult.ts";
import type { FoodSearchSource } from "../../api/foodSearch/FoodSearchSource.ts";
import { NormalizedFoodSearchItem } from "../../api/foodSearch/NormalizedFoodSearchItem.ts";

export class FoodSearchResponseMapper {
	public mapSearchItems(
		response: FoodSearchApiResponse,
		source: FoodSearchSource,
	): readonly NormalizedFoodSearchItem[] {
		return response.items.flatMap((item) => {
			if (!item.foodId) {
				return [];
			}

			return [
				new NormalizedFoodSearchItem(
					source,
					item.foodId,
					FoodType.fromUpstream(item.rawFoodType, "PRODUCT"),
					item.name,
					item.brand,
					item.measureId,
					item.measureName,
					item.measureQuantity,
					item.measureWeight,
					item.measureEnergy,
					new FoodNutrition(
						item.energy,
						item.protein,
						item.fat,
						item.carbohydrate,
						item.fiber,
						item.sugars,
						item.salt,
						item.saturatedFat,
					),
					new FoodNutrition(item.measureEnergy, null, null, null, null, null, null, null),
					item.verified,
					item.photoUrl,
					[],
				),
			];
		});
	}

	public mergeDetails(item: NormalizedFoodSearchItem, response: FoodDetailsApiResponse): NormalizedFoodSearchItem {
		return item.withDetails(
			mergeNutrition(
				item.nutritionPer100g,
				new FoodNutrition(
					response.energy,
					response.protein,
					response.fat,
					response.carbohydrate,
					response.fiber,
					response.sugars,
					response.salt,
					response.saturatedFat,
				),
			),
			item.verified ?? response.verified,
			item.photoUrl ?? response.photoUrl,
			this.mapMeasures(response),
		);
	}

	public mapAvailableMeasures(response: FoodDetailsApiResponse): readonly FoodMeasure[] {
		const byId = new Map<string, FoodMeasure>();
		for (const measure of this.mapMeasures(response)) {
			if (measure.measureId === null) {
				continue;
			}
			const existing = byId.get(measure.measureId);
			byId.set(
				measure.measureId,
				new FoodMeasure(
					measure.measureId,
					existing?.measureName ?? measure.measureName,
					existing?.weightG ?? measure.weightG,
					existing?.unit ?? measure.unit,
					existing?.energyKcal ?? measure.energyKcal,
				),
			);
		}
		return [...byId.values()];
	}

	public toOutputItems(
		results: readonly FoodSearchQueryResult[],
		source: FoodSearchSource,
	): readonly FoodSearchItem[] {
		const output: FoodSearchItem[] = [];
		for (const [queryIndex, result] of results.entries()) {
			const items = source === "user" ? result.userItems : result.publicItems;
			for (const item of items) {
				output.push(new FoodSearchItem(item, output.length, queryIndex, result.query, displayName(item)));
			}
		}
		return output;
	}

	public resolveDetailsFoodType(foodType: FoodTypeName): FoodTypeName {
		return foodType === "RECIPE" ? "RECIPE" : "PRODUCT";
	}

	private mapMeasures(response: FoodDetailsApiResponse): readonly FoodMeasure[] {
		return deduplicateMeasures(
			response.measures.map(
				(measure) =>
					new FoodMeasure(
						measure.measureId,
						measure.measureName,
						measure.weight,
						measure.unit,
						measure.energy,
					),
			),
		);
	}
}

function deduplicateMeasures(measures: readonly FoodMeasure[]): readonly FoodMeasure[] {
	const seen = new Set<string>();
	return measures.filter((measure) => {
		const key = `${measure.measureId ?? ""}:${measure.measureName ?? ""}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function mergeNutrition(primary: FoodNutrition, fallback: FoodNutrition): FoodNutrition {
	return new FoodNutrition(
		primary.energyKcal ?? fallback.energyKcal,
		primary.proteinG ?? fallback.proteinG,
		primary.fatG ?? fallback.fatG,
		primary.carbsG ?? fallback.carbsG,
		primary.fiberG ?? fallback.fiberG,
		primary.sugarsG ?? fallback.sugarsG,
		primary.saltG ?? fallback.saltG,
		primary.saturatedFatG ?? fallback.saturatedFatG,
	);
}

function displayName(item: NormalizedFoodSearchItem): string {
	const parts: string[] = [];
	const name = item.name ?? item.foodId;
	const measure = formatMeasure(item);
	if (measure) parts.push(measure);
	if (item.weightG !== null && !measureAlreadyDescribesWeight(item)) parts.push(`${item.weightG} g`);
	if (item.kcal !== null) parts.push(`${item.kcal} kcal`);
	else if (item.nutritionPer100g.energyKcal !== null) parts.push(`${item.nutritionPer100g.energyKcal} kcal`);
	return parts.length > 0 ? `${name} - ${parts.join(", ")}` : name;
}

function formatMeasure(item: NormalizedFoodSearchItem): string | undefined {
	if (!item.measureName) return undefined;
	return item.measureQuantity === null ? item.measureName : `${item.measureQuantity} ${item.measureName}`;
}

function measureAlreadyDescribesWeight(item: NormalizedFoodSearchItem): boolean {
	if (item.measureQuantity === null || item.weightG === null || item.measureName === null) return false;
	return (
		["g", "gram", "grams", "gramy"].includes(item.measureName.toLowerCase()) &&
		item.measureQuantity === item.weightG
	);
}
