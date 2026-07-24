import { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import type { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeDeleteResult } from "../../api/recipes/RecipeDeleteResult.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import { RecipeError } from "../../api/recipes/RecipeError.ts";
import type { RecipeReplaceResult } from "../../api/recipes/RecipeReplaceResult.ts";
import type { RecipeSearchOptions } from "../../api/recipes/RecipeSearchOptions.ts";
import type { RecipeSearchResult } from "../../api/recipes/RecipeSearchResult.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import type { RecipeWarning } from "../../api/recipes/RecipeWarning.ts";
import type { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import { StringUtils } from "../../shared/StringUtils.ts";

export interface RecipeProvider {
	createRecipe(input: RecipeWriteInput): Promise<RecipeCreateResult>;
	getRecipe(recipeId: string | number): Promise<RecipeDetails>;
	searchRecipes(options?: RecipeSearchOptions): Promise<RecipeSearchResult>;
	updateRecipe(recipeId: string | number, input: RecipeUpdateInput): Promise<RecipeReplaceResult>;
	deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult>;
}

export class RecipeService implements RecipeProvider {
	private readonly recipeClient: RecipeClient;

	public constructor(recipeClient: RecipeClient) {
		this.recipeClient = recipeClient;
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeCreateResult> {
		const result = await this.recipeClient.createRecipe(input);
		return { ...result, warnings: findDuplicateIngredientWarnings(input.ingredients) };
	}

	public getRecipe(recipeId: string | number): Promise<RecipeDetails> {
		return this.recipeClient.getRecipe(recipeId);
	}

	public searchRecipes(options: RecipeSearchOptions = {}): Promise<RecipeSearchResult> {
		return this.recipeClient.searchRecipes(options);
	}

	public async updateRecipe(recipeId: string | number, input: RecipeUpdateInput): Promise<RecipeReplaceResult> {
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);

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
		return { ...result, warnings: findDuplicateIngredientWarnings(replacement.ingredients) };
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeDeleteResult> {
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);
		if (expectedName !== current.name) {
			throw new RecipeError("Recipe name confirmation did not match", {
				code: "RECIPE_NAME_MISMATCH",
				parameter: "expectedName",
				retryable: false,
			});
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
			throw new RecipeError(`Recipe ${recipe.recipeId} is not owned by the authenticated user`, {
				code: "RECIPE_NOT_OWNED",
				parameter: "recipeId",
				retryable: false,
			});
		}
		if (!recipe.editable || recipe.deleted) {
			throw new RecipeError(`Recipe ${recipe.recipeId} is not editable`, {
				code: "RECIPE_NOT_EDITABLE",
				parameter: "recipeId",
				retryable: false,
			});
		}
	}
}

function findDuplicateIngredientWarnings(ingredients: RecipeWriteInput["ingredients"]): readonly RecipeWarning[] {
	const selections = new Map<
		string,
		{ readonly itemId: string; readonly measureId: string; readonly indexes: number[] }
	>();

	ingredients.forEach((ingredient, index) => {
		const itemId = String(ingredient.itemId);
		const measureId = String(ingredient.measureId);
		const key = `${ingredient.type}:${itemId}:${measureId}`;
		const selection = selections.get(key);
		if (selection) {
			selection.indexes.push(index);
			return;
		}
		selections.set(key, { itemId, measureId, indexes: [index] });
	});

	return [...selections.values()]
		.filter(({ indexes }) => indexes.length > 1)
		.map(({ itemId, measureId, indexes }) => ({
			code: "DUPLICATE_INGREDIENT_SELECTION",
			message: `Ingredient itemId ${itemId} with measureId ${measureId} appears more than once.`,
			itemId,
			measureId,
			indexes,
		}));
}
