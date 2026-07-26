import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import type { RecipeIngredient } from "./RecipeIngredient.ts";
import type { RecipeNutrition } from "./RecipeNutrition.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeDetails {
	declare public readonly recipeId: string;
	declare public readonly userId: string | null;
	declare public readonly name: string;
	declare public readonly servings: number;
	declare public readonly shared: boolean;
	declare public readonly editable: boolean;
	declare public readonly deleted: boolean;
	declare public readonly description: string | null;
	declare public readonly cookingTimeMinutes: number | null;
	declare public readonly preparationTimeMinutes: number | null;
	declare public readonly mealSchema: readonly string[];
	declare public readonly tags: readonly RecipeTag[];
	declare public readonly ingredients: readonly RecipeIngredient[];
	declare public readonly nutritionPerServing: RecipeNutrition;
	declare public readonly weightPerServingG: number | null;
	declare public readonly categories: unknown;

	private constructor(response: Record<string, unknown>) {
		this.recipeId = StringUtils.parseStringValue(response.id, "Recipe response id is required");
		this.userId = StringUtils.stringOrNull(response.userId);
		this.name = StringUtils.parseStringValue(response.name, "Recipe response name is required");
		this.servings = NumberUtils.parsePositiveInteger(
			response.serving,
			"Recipe response serving must be a positive integer",
		);
		this.shared = booleanOrDefault(response.shared, false);
		this.deleted = booleanOrDefault(response.deleted, false);
		this.editable = booleanOrDefault(response.editable, false) && !this.deleted;
		this.description = StringUtils.stringOrNull(response.recipeDescription);
		this.cookingTimeMinutes = optionalNonNegativeInteger(
			response.cookingTime,
			"Recipe response cookingTime must be a non-negative integer",
		);
		this.preparationTimeMinutes = optionalNonNegativeInteger(
			response.preparationTime,
			"Recipe response preparationTime must be a non-negative integer",
		);
		this.mealSchema = list(response.mealSchema).flatMap((value) => {
			const text = StringUtils.stringOrNull(value);
			return text ? [text] : [];
		});
		this.tags = mapTags(response.tags);
		this.ingredients = mapIngredients(response.items);
		this.nutritionPerServing = mapNutrition(response);
		this.weightPerServingG = optionalNonNegativeNumber(
			response.weight,
			"Recipe response weight must be a non-negative number",
		);
		this.categories = response.categories ?? null;
	}

	public static fromApiResponse(response: Record<string, unknown>): RecipeDetails {
		return new RecipeDetails(response);
	}
}

function mapNutrition(response: Record<string, unknown>): RecipeNutrition {
	return {
		energyKcal:
			NumberUtils.parseOptionalFiniteNumber(response.energyCalories) ??
			NumberUtils.parseOptionalFiniteNumber(response.energy),
		proteinG: NumberUtils.parseOptionalFiniteNumber(response.protein),
		fatG: NumberUtils.parseOptionalFiniteNumber(response.fat),
		carbohydrateG: NumberUtils.parseOptionalFiniteNumber(response.carbohydrate),
	};
}

function mapTags(value: unknown): readonly RecipeTag[] {
	return list(value).flatMap((item) => {
		if (!ObjectUtils.isRecord(item)) {
			return [];
		}
		const name = StringUtils.stringOrNull(item.name);
		const category = StringUtils.stringOrNull(item.category);
		const translation = StringUtils.stringOrNull(item.translation);
		return name && category && translation ? [{ name, category, translation }] : [];
	});
}

function mapIngredients(value: unknown): readonly RecipeIngredient[] {
	return list(value).flatMap((item) => {
		if (!ObjectUtils.isRecord(item) || StringUtils.stringOrNull(item.type)?.toUpperCase() !== "PRODUCT") {
			return [];
		}
		const itemId = StringUtils.stringOrNull(item.itemId);
		const measureId = StringUtils.stringOrNull(item.measureId);
		const measureQuantity = NumberUtils.parseOptionalFiniteNumber(item.measureQuantity);
		if (!itemId || !measureId || measureQuantity === null || measureQuantity <= 0) {
			return [];
		}

		return [
			{
				itemId,
				productId: StringUtils.stringOrNull(item.productId),
				recipeId: StringUtils.stringOrNull(item.recipeId),
				name: StringUtils.stringOrNull(item.name),
				type: "PRODUCT" as const,
				measureId,
				measureQuantity,
				measureName: StringUtils.stringOrNull(item.measureName),
				measureWeightG: optionalNonNegativeNumber(
					item.measureWeight,
					"Recipe ingredient measureWeight must be a non-negative number",
				),
			},
		];
	});
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function optionalNonNegativeInteger(value: unknown, errorMessage: string): number | null {
	const parsed = NumberUtils.parseOptionalFiniteNumber(value, errorMessage);
	return parsed === null ? null : NumberUtils.parseNonNegativeInteger(parsed, errorMessage);
}

function optionalNonNegativeNumber(value: unknown, errorMessage: string): number | null {
	const parsed = NumberUtils.parseOptionalFiniteNumber(value, errorMessage);
	if (parsed !== null && parsed < 0) {
		throw new ValidationError(errorMessage);
	}
	return parsed;
}

function list(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}
