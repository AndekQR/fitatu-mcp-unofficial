import { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { RecipeDeleteResult } from "../../api/recipes/RecipeDeleteResult.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import type { RecipeSearchOptions } from "../../api/recipes/RecipeSearchOptions.ts";
import type { RecipeSearchResult } from "../../api/recipes/RecipeSearchResult.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import type { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import type {
	RecipeServiceCreateResult,
	RecipeServiceDetails,
	RecipeServiceReplaceResult,
} from "./RecipeServiceResult.ts";

const USER_TAG_CATEGORY = "RECIPE_TAG_USERS_TYPE";

interface FoodMeasureProvider {
	getAvailableMeasureIds(productId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>>;
	getAvailableMeasures(productId: string | number, foodType: FoodTypeName): Promise<readonly FoodMeasure[]>;
}

export interface RecipeProvider {
	createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult>;
	getRecipe(recipeId: string | number): Promise<RecipeServiceDetails>;
	searchRecipes(options?: RecipeSearchOptions): Promise<RecipeSearchResult>;
	updateRecipe(recipeId: string | number, input: RecipeUpdateInput): Promise<RecipeServiceReplaceResult>;
	deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult>;
}

export class RecipeService implements RecipeProvider {
	private readonly recipeClient: RecipeClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;

	public constructor(
		recipeClient: RecipeClient,
		foodMeasureProvider: Pick<FoodSearchClient, "getAvailableMeasureIds" | "getAvailableMeasures">,
	) {
		this.recipeClient = recipeClient;
		this.foodMeasureProvider = foodMeasureProvider;
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult> {
		this.assertUniqueIngredientSelections(input.ingredients);
		this.assertTagCategories(input.tags, new Set([USER_TAG_CATEGORY]));
		await this.validateIngredients(input.ingredients);
		const result = await this.recipeClient.createRecipe(input);
		return {
			...result,
			details: await this.withAvailableMeasures(result.details),
			warnings: [],
		};
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeServiceDetails> {
		const details = await this.recipeClient.getRecipe(recipeId);
		return this.withAvailableMeasures(details);
	}

	public searchRecipes(options: RecipeSearchOptions = {}): Promise<RecipeSearchResult> {
		return this.recipeClient.searchRecipes(options);
	}

	public async updateRecipe(
		recipeId: string | number,
		input: RecipeUpdateInput,
	): Promise<RecipeServiceReplaceResult> {
		if (input.ingredients !== undefined) {
			this.assertUniqueIngredientSelections(input.ingredients);
		}
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);
		if (input.tags !== undefined) {
			this.assertTagCategories(
				input.tags,
				new Set([USER_TAG_CATEGORY, ...current.tags.map((tag) => tag.category)]),
			);
		}
		if (input.ingredients !== undefined) {
			await this.validateIngredients(input.ingredients);
		}

		const replacement = {
			name: input.name ?? current.name,
			ingredients:
				input.ingredients ??
				current.ingredients.map((ingredient) => ({
					itemId: ingredient.itemId,
					measureId: ingredient.measureId,
					measureQuantity: ingredient.measureQuantity,
					type: ingredient.type,
				})),
			tags: input.tags ?? current.tags,
			servings: input.servings ?? current.servings,
			shared: input.shared ?? current.shared,
			description: input.description !== undefined ? input.description : current.description,
			cookingTimeMinutes:
				input.cookingTimeMinutes !== undefined ? input.cookingTimeMinutes : current.cookingTimeMinutes,
			preparationTimeMinutes:
				input.preparationTimeMinutes !== undefined
					? input.preparationTimeMinutes
					: current.preparationTimeMinutes,
			mealSchema: input.mealSchema ?? current.mealSchema,
			categories: current.categories,
		};
		const result = await this.recipeClient.replaceRecipe(current.recipeId, replacement);
		return {
			...result,
			details: await this.withAvailableMeasures(result.details),
			warnings: [],
		};
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult> {
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);
		if (expectedName !== current.name) {
			throw new ServiceError(
				"expectedName did not match the current recipe name",
				"conflict",
				SERVICE_ERROR_CODES.recipeNameMismatch,
			);
		}

		await this.recipeClient.deleteRecipe(current.recipeId);
		return {
			recipeId: current.recipeId,
			name: current.name,
			deleted: true,
		};
	}

	private async assertOwnedEditable(recipe: RecipeDetails): Promise<void> {
		const currentUserId = StringUtils.firstNonEmptyString(await this.recipeClient.getContextUserId());
		if (!currentUserId) {
			throw new ServiceError(
				"Fitatu user id is required",
				"authenticationRequired",
				SERVICE_ERROR_CODES.authenticationRequired,
			);
		}
		if (recipe.userId !== currentUserId) {
			throw new ServiceError(
				`Recipe ${recipe.recipeId} is not owned by the authenticated user`,
				"forbidden",
				SERVICE_ERROR_CODES.recipeNotOwned,
			);
		}
		if (!recipe.editable || recipe.deleted) {
			throw new ServiceError(
				`Recipe ${recipe.recipeId} is not editable`,
				"conflict",
				SERVICE_ERROR_CODES.recipeNotEditable,
			);
		}
	}

	private assertTagCategories(tags: RecipeWriteInput["tags"], allowedCategories: ReadonlySet<string>): void {
		tags.forEach((tag, index) => {
			if (!allowedCategories.has(tag.category)) {
				throw new ServiceError(
					`Unsupported tags[${index}].category. Use RECIPE_TAG_USERS_TYPE for a custom tag or preserve a category returned by get_recipe.`,
					"invalidInput",
					SERVICE_ERROR_CODES.invalidRecipeTagCategory,
				);
			}
		});
	}

	private assertUniqueIngredientSelections(ingredients: RecipeWriteInput["ingredients"]): void {
		const firstIndexBySelection = new Map<string, number>();
		ingredients.forEach((ingredient, index) => {
			const selection = `${String(ingredient.itemId)}:${String(ingredient.measureId)}`;
			const firstIndex = firstIndexBySelection.get(selection);
			if (firstIndex !== undefined) {
				throw new ServiceError(
					`Ingredient productId ${ingredient.itemId} with measureId ${ingredient.measureId} at ingredients[${index}] duplicates ingredients[${firstIndex}].`,
					"invalidInput",
					SERVICE_ERROR_CODES.duplicateIngredientSelection,
				);
			}
			firstIndexBySelection.set(selection, index);
		});
	}

	private async validateIngredients(ingredients: RecipeWriteInput["ingredients"]): Promise<void> {
		const cachedMeasures = new Map<string, ReadonlySet<string>>();
		for (const [index, ingredient] of ingredients.entries()) {
			const itemId = String(ingredient.itemId);
			let measureIds = cachedMeasures.get(itemId);
			if (!measureIds) {
				measureIds = await this.foodMeasureProvider.getAvailableMeasureIds(itemId, "PRODUCT");
				cachedMeasures.set(itemId, measureIds);
			}

			if (!measureIds.has(String(ingredient.measureId))) {
				throw new ServiceError(
					`Measure at ingredients[${index}].measureId does not belong to the selected ingredient product.`,
					"invalidInput",
					SERVICE_ERROR_CODES.invalidIngredientMeasure,
				);
			}
		}
	}

	private async withAvailableMeasures(details: RecipeDetails): Promise<RecipeServiceDetails> {
		const measures = await this.foodMeasureProvider.getAvailableMeasures(details.recipeId, "RECIPE");
		return { ...details, measures };
	}
}
