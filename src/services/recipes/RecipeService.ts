import { RecipeClient } from "../../api/recipes/RecipeClient.ts";
import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import type { FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import { RecipeIngredientInput } from "../../api/recipes/RecipeIngredientInput.ts";
import type { RecipeSearchItem } from "../../api/recipes/RecipeSearchItem.ts";
import { RecipeSearchOptions } from "../../api/recipes/RecipeSearchOptions.ts";
import { RecipeSearchResult } from "../../api/recipes/RecipeSearchResult.ts";
import { RecipeSearchWarning } from "../../api/recipes/RecipeSearchWarning.ts";
import { RecipeReplacementInput } from "../../api/recipes/RecipeReplacementInput.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import type { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";
import { DetailedRecipeSearchItem } from "./DetailedRecipeSearchItem.ts";
import { RecipeDetailsUnavailableWarning } from "./RecipeDetailsUnavailableWarning.ts";
import { RecipeServiceCreateResult } from "./RecipeServiceCreateResult.ts";
import { RecipeServiceDeleteResult } from "./RecipeServiceDeleteResult.ts";
import { RecipeServiceDetails } from "./RecipeServiceDetails.ts";
import { RecipeServiceReplaceResult } from "./RecipeServiceReplaceResult.ts";
import { RecipeMutationConfirmer } from "./RecipeMutationConfirmer.ts";

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
	deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeServiceDeleteResult>;
}

export interface RecipeMutationConfirmationProvider {
	confirmCreated(recipeId: string, expected: RecipeWriteInput): Promise<RecipeDetails>;
	confirmReplaced(
		previousRecipeId: string,
		recipeId: string,
		expected: RecipeReplacementInput,
	): Promise<RecipeDetails>;
	confirmDeleted(recipeId: string): Promise<void>;
}

export class RecipeService implements RecipeProvider {
	private readonly recipeClient: RecipeClient;
	private readonly foodMeasureProvider: FoodMeasureProvider;
	private readonly confirmer: RecipeMutationConfirmationProvider;

	public constructor(
		recipeClient: RecipeClient,
		foodMeasureProvider: FoodMeasureProvider,
		confirmer: RecipeMutationConfirmationProvider = new RecipeMutationConfirmer(recipeClient),
	) {
		this.recipeClient = recipeClient;
		this.foodMeasureProvider = foodMeasureProvider;
		this.confirmer = confirmer;
	}

	public async createRecipe(input: RecipeWriteInput): Promise<RecipeServiceCreateResult> {
		this.assertUniqueIngredientSelections(input.ingredients);
		this.assertTagCategories(input.tags, new Set([USER_TAG_CATEGORY]));
		await this.validateIngredients(input.ingredients);
		const result = await this.recipeClient.createRecipe(input);
		const confirmed = await this.confirmer.confirmCreated(result.recipeId, input);
		return new RecipeServiceCreateResult(result, await this.withAvailableMeasures(confirmed), []);
	}

	public async getRecipe(recipeId: string | number): Promise<RecipeServiceDetails> {
		const details = await this.recipeClient.getRecipe(recipeId);
		return this.withAvailableMeasures(details);
	}

	public async searchRecipes(options: RecipeSearchOptions = new RecipeSearchOptions()): Promise<RecipeSearchResult> {
		const { includeDetails = false, ...searchOptions } = options;
		const result = await this.recipeClient.searchRecipes(
			new RecipeSearchOptions(searchOptions.query, searchOptions.scope, searchOptions.page, searchOptions.limit),
		);
		if (!includeDetails) {
			return result;
		}

		const items: RecipeSearchItem[] = [];
		const warnings: RecipeSearchWarning[] = [...result.warnings];
		for (const item of result.items) {
			try {
				const details = await this.getRecipe(item.recipeId);
				items.push(new DetailedRecipeSearchItem(item, details));
			} catch (error) {
				if (!(error instanceof FitatuClientError)) {
					throw error;
				}
				items.push(item);
				warnings.push(
					new RecipeDetailsUnavailableWarning(
						new RecipeSearchWarning(
							"RECIPE_DETAILS_UNAVAILABLE",
							item.source,
							`Details for recipe ${item.recipeId} were unavailable; the result contains summary fields only.`,
							error,
						),
						item.recipeId,
					),
				);
			}
		}

		return new RecipeSearchResult(result.query, result.scope, result.page, result.limit, items, warnings);
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

		const replacement = new RecipeReplacementInput(
			input.name ?? current.name,
			input.ingredients ??
				current.ingredients.map(
					(ingredient) =>
						new RecipeIngredientInput(ingredient.itemId, ingredient.measureId, ingredient.measureQuantity),
				),
			input.tags ?? current.tags,
			input.servings ?? current.servings,
			input.shared ?? current.shared,
			input.description !== undefined ? input.description : current.description,
			input.cookingTimeMinutes !== undefined ? input.cookingTimeMinutes : current.cookingTimeMinutes,
			input.preparationTimeMinutes !== undefined ? input.preparationTimeMinutes : current.preparationTimeMinutes,
			input.mealSchema ?? current.mealSchema,
			current.categories,
		);
		const result = await this.recipeClient.replaceRecipe(current.recipeId, replacement);
		const confirmed = await this.confirmer.confirmReplaced(result.previousRecipeId, result.recipeId, replacement);
		return new RecipeServiceReplaceResult(result, await this.withAvailableMeasures(confirmed), []);
	}

	public async deleteRecipe(recipeId: string | number, expectedName: string): Promise<RecipeServiceDeleteResult> {
		const current = await this.recipeClient.getRecipe(recipeId);
		await this.assertOwnedEditable(current);
		if (expectedName !== current.name) {
			throw new ServiceError(
				"expectedName did not match the current recipe name",
				"conflict",
				SERVICE_ERROR_CODES.recipeNameMismatch,
			);
		}

		const deleted = await this.recipeClient.deleteRecipe(current.recipeId);
		await this.confirmer.confirmDeleted(deleted.recipeId);
		return new RecipeServiceDeleteResult(deleted, current.name);
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
		return new RecipeServiceDetails(details, measures);
	}
}
