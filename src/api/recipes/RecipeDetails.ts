import { NumberUtils } from "../../shared/NumberUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { RecipeIngredient } from "./RecipeIngredient.ts";
import { RecipeNutrition } from "./RecipeNutrition.ts";
import { RecipeTag } from "./RecipeTag.ts";

export class RecipeDetails {
	public readonly recipeId: string;
	public readonly userId: string | null;
	public readonly name: string;
	public readonly servings: number;
	public readonly shared: boolean;
	public readonly editable: boolean;
	public readonly deleted: boolean;
	public readonly description: string | null;
	public readonly cookingTimeMinutes: number | null;
	public readonly preparationTimeMinutes: number | null;
	public readonly mealSchema: readonly string[];
	public readonly tags: readonly RecipeTag[];
	public readonly ingredients: readonly RecipeIngredient[];
	public readonly nutritionPerServing: RecipeNutrition;
	public readonly weightPerServingG: number | null;
	public readonly categories: unknown;

	protected constructor(details: RecipeDetails);
	protected constructor(
		recipeId: string,
		userId: string | null,
		name: string,
		servings: number,
		shared: boolean,
		editable: boolean,
		deleted: boolean,
		description: string | null,
		cookingTimeMinutes: number | null,
		preparationTimeMinutes: number | null,
		mealSchema: readonly string[],
		tags: readonly RecipeTag[],
		ingredients: readonly RecipeIngredient[],
		nutritionPerServing: RecipeNutrition,
		weightPerServingG: number | null,
		categories: unknown,
	);
	protected constructor(
		detailsOrRecipeId: RecipeDetails | string,
		userId?: string | null,
		name?: string,
		servings?: number,
		shared?: boolean,
		editable?: boolean,
		deleted?: boolean,
		description?: string | null,
		cookingTimeMinutes?: number | null,
		preparationTimeMinutes?: number | null,
		mealSchema?: readonly string[],
		tags?: readonly RecipeTag[],
		ingredients?: readonly RecipeIngredient[],
		nutritionPerServing?: RecipeNutrition,
		weightPerServingG?: number | null,
		categories?: unknown,
	) {
		if (detailsOrRecipeId instanceof RecipeDetails) {
			this.recipeId = detailsOrRecipeId.recipeId;
			this.userId = detailsOrRecipeId.userId;
			this.name = detailsOrRecipeId.name;
			this.servings = detailsOrRecipeId.servings;
			this.shared = detailsOrRecipeId.shared;
			this.editable = detailsOrRecipeId.editable;
			this.deleted = detailsOrRecipeId.deleted;
			this.description = detailsOrRecipeId.description;
			this.cookingTimeMinutes = detailsOrRecipeId.cookingTimeMinutes;
			this.preparationTimeMinutes = detailsOrRecipeId.preparationTimeMinutes;
			this.mealSchema = detailsOrRecipeId.mealSchema;
			this.tags = detailsOrRecipeId.tags;
			this.ingredients = detailsOrRecipeId.ingredients;
			this.nutritionPerServing = detailsOrRecipeId.nutritionPerServing;
			this.weightPerServingG = detailsOrRecipeId.weightPerServingG;
			this.categories = detailsOrRecipeId.categories;
			return;
		}

		this.recipeId = detailsOrRecipeId;
		this.userId = requireConstructorValue(userId, "userId");
		this.name = requireConstructorValue(name, "name");
		this.servings = requireConstructorValue(servings, "servings");
		this.shared = requireConstructorValue(shared, "shared");
		this.editable = requireConstructorValue(editable, "editable");
		this.deleted = requireConstructorValue(deleted, "deleted");
		this.description = requireConstructorValue(description, "description");
		this.cookingTimeMinutes = requireConstructorValue(cookingTimeMinutes, "cookingTimeMinutes");
		this.preparationTimeMinutes = requireConstructorValue(preparationTimeMinutes, "preparationTimeMinutes");
		this.mealSchema = requireConstructorValue(mealSchema, "mealSchema");
		this.tags = requireConstructorValue(tags, "tags");
		this.ingredients = requireConstructorValue(ingredients, "ingredients");
		this.nutritionPerServing = requireConstructorValue(nutritionPerServing, "nutritionPerServing");
		this.weightPerServingG = requireConstructorValue(weightPerServingG, "weightPerServingG");
		this.categories = categories;
	}

	public static fromApiResponse(response: Record<string, unknown>): RecipeDetails {
		const deleted = booleanOrDefault(response.deleted, false);
		const mealSchema = list(response.mealSchema).flatMap((value) => {
			const text = StringUtils.stringOrNull(value);
			return text ? [text] : [];
		});
		return new RecipeDetails(
			StringUtils.parseStringValue(response.id, "Recipe response id is required"),
			StringUtils.stringOrNull(response.userId),
			StringUtils.parseStringValue(response.name, "Recipe response name is required"),
			NumberUtils.parsePositiveInteger(response.serving, "Recipe response serving must be a positive integer"),
			booleanOrDefault(response.shared, false),
			booleanOrDefault(response.editable, false) && !deleted,
			deleted,
			StringUtils.stringOrNull(response.recipeDescription),
			optionalNonNegativeInteger(
				response.cookingTime,
				"Recipe response cookingTime must be a non-negative integer",
			),
			optionalNonNegativeInteger(
				response.preparationTime,
				"Recipe response preparationTime must be a non-negative integer",
			),
			mealSchema,
			mapTags(response.tags),
			mapIngredients(response.items),
			mapNutrition(response),
			optionalNonNegativeNumber(response.weight, "Recipe response weight must be a non-negative number"),
			response.categories ?? null,
		);
	}
}

function requireConstructorValue<T>(value: T | undefined, field: string): T {
	if (value === undefined) {
		throw new ValidationError(`Recipe details constructor requires ${field}`);
	}
	return value;
}

function mapNutrition(response: Record<string, unknown>): RecipeNutrition {
	return new RecipeNutrition(
		NumberUtils.parseOptionalFiniteNumber(response.energyCalories) ??
			NumberUtils.parseOptionalFiniteNumber(response.energy),
		NumberUtils.parseOptionalFiniteNumber(response.protein),
		NumberUtils.parseOptionalFiniteNumber(response.fat),
		NumberUtils.parseOptionalFiniteNumber(response.carbohydrate),
	);
}

function mapTags(value: unknown): readonly RecipeTag[] {
	return list(value).flatMap((item) => {
		if (!ObjectUtils.isRecord(item)) {
			return [];
		}
		const name = StringUtils.stringOrNull(item.name);
		const category = StringUtils.stringOrNull(item.category);
		const translation = StringUtils.stringOrNull(item.translation);
		return name && category && translation ? [new RecipeTag(name, category, translation)] : [];
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
			new RecipeIngredient(
				itemId,
				StringUtils.stringOrNull(item.productId),
				StringUtils.stringOrNull(item.recipeId),
				StringUtils.stringOrNull(item.name),
				measureId,
				measureQuantity,
				StringUtils.stringOrNull(item.measureName),
				optionalNonNegativeNumber(
					item.measureWeight,
					"Recipe ingredient measureWeight must be a non-negative number",
				),
			),
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
