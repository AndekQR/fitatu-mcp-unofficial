import { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { RecipeDeleteResult } from "../../api/recipes/RecipeDeleteResult.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import { RecipeError } from "../../api/recipes/RecipeError.ts";
import type { RecipeSearchOptions } from "../../api/recipes/RecipeSearchOptions.ts";
import type { RecipeSearchResult } from "../../api/recipes/RecipeSearchResult.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import type { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { RecipeServiceCreateResult, RecipeServiceReplaceResult } from "./RecipeServiceResult.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import { FoodSearchError } from "../../api/foodSearch/FoodSearchError.ts";

const USER_TAG_CATEGORY = "RECIPE_TAG_USERS_TYPE";

interface FoodMeasureProvider {
	getAvailableMeasureIds(foodId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>>;
}

export interface RecipeProvider {
	createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult>;
	getRecipe(recipeId: string | number): Promise<RecipeDetails>;
	searchRecipes(options?: RecipeSearchOptions): Promise<RecipeSearchResult>;
	updateRecipe(recipeId: string | number, input: RecipeUpdateInput): Promise<RecipeServiceReplaceResult>;
	deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult>;
}

export class RecipeService implements RecipeProvider {
	private readonly recipeClient: RecipeClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;

	public constructor(
		recipeClient: RecipeClient,
		foodMeasureProvider: Pick<FoodSearchClient, "getAvailableMeasureIds">,
	) {
		this.recipeClient = recipeClient;
		this.foodMeasureProvider = foodMeasureProvider;
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult> {
		this.assertUniqueIngredientSelections(input.ingredients);
		this.assertTagCategories(input.tags, new Set([USER_TAG_CATEGORY]));
		await this.validateIngredients(input.ingredients);
		const result = await this.recipeClient.createRecipe(input);
		return { ...result, warnings: [] };
	}

	public getRecipe(recipeId: string | number): Promise<RecipeDetails> {
		return this.recipeClient.getRecipe(recipeId);
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
		return { ...result, warnings: [] };
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult> {
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);
		if (expectedName !== current.name) {
			throw new RecipeError("expectedName did not match the current recipe name");
		}

		await this.recipeClient.deleteRecipe(current.recipeId);
		return {
			recipeId: current.recipeId,
			name: current.name,
			deleted: true,
		};
	}

	private async assertOwnedEditable(recipe: RecipeDetails): Promise<void> {
		const currentUserId = StringUtils.parseNonEmptyString(
			await this.recipeClient.getContextUserId(),
			"Fitatu user id is required",
		);
		if (recipe.userId !== currentUserId) {
			throw new RecipeError(`Recipe ${recipe.recipeId} is not owned by the authenticated user`);
		}
		if (!recipe.editable || recipe.deleted) {
			throw new RecipeError(`Recipe ${recipe.recipeId} is not editable`);
		}
	}

	private assertTagCategories(tags: RecipeWriteInput["tags"], allowedCategories: ReadonlySet<string>): void {
		tags.forEach((tag, index) => {
			if (!allowedCategories.has(tag.category)) {
				throw new RecipeError(
					`Unsupported tags[${index}].category. Use RECIPE_TAG_USERS_TYPE for a custom tag or preserve a category returned by get_recipe.`,
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
				throw new RecipeError(
					`Ingredient itemId ${ingredient.itemId} with measureId ${ingredient.measureId} at ingredients[${index}] duplicates ingredients[${firstIndex}].`,
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
				try {
					measureIds = await this.foodMeasureProvider.getAvailableMeasureIds(itemId, "PRODUCT");
				} catch (error) {
					if (error instanceof FoodSearchError && error.statusCode === 404) {
						throw new RecipeError(`Ingredient product at ingredients[${index}].itemId was not found.`);
					}
					throw error;
				}
				cachedMeasures.set(itemId, measureIds);
			}

			if (!measureIds.has(String(ingredient.measureId))) {
				throw new RecipeError(
					`Measure at ingredients[${index}].measureId does not belong to the selected ingredient product.`,
				);
			}
		}
	}
}
