import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import type { RecipeTag } from "../../api/recipes/RecipeTag.ts";
import type { RecipeWriteInput } from "../../api/recipes/RecipeWriteInput.ts";
import { BoundedPoller } from "../../shared/BoundedPoller.ts";
import { CreateRecipeTool } from "../../tools/recipes/CreateRecipeTool.ts";
import { DeleteRecipeTool } from "../../tools/recipes/DeleteRecipeTool.ts";
import { GetRecipeTool } from "../../tools/recipes/GetRecipeTool.ts";
import { UpdateRecipeTool } from "../../tools/recipes/UpdateRecipeTool.ts";
import { MutationConfirmationContext } from "../MutationConfirmationContext.ts";
import { MutationConfirmationSupport } from "../MutationConfirmationSupport.ts";
import { MutationConfirmationValues } from "../MutationConfirmationValues.ts";

const CREATE_CONFIRMATION = new MutationConfirmationContext(CreateRecipeTool.toolName, GetRecipeTool.toolName);
const UPDATE_CONFIRMATION = new MutationConfirmationContext(UpdateRecipeTool.toolName, GetRecipeTool.toolName);
const DELETE_CONFIRMATION = new MutationConfirmationContext(DeleteRecipeTool.toolName, GetRecipeTool.toolName);

interface RecipeStateProvider {
	getRecipe(recipeId: string | number): Promise<RecipeDetails>;
}

export class RecipeMutationConfirmer {
	private readonly recipeStateProvider: RecipeStateProvider;
	private readonly confirmation: MutationConfirmationSupport;

	public constructor(recipeStateProvider: RecipeStateProvider, poller = new BoundedPoller()) {
		this.recipeStateProvider = recipeStateProvider;
		this.confirmation = new MutationConfirmationSupport(poller);
	}

	public async confirmCreated(recipeId: string, expected: RecipeWriteInput): Promise<RecipeDetails> {
		return this.confirmRecipe(CREATE_CONFIRMATION, recipeId, expected);
	}

	public async confirmReplaced(
		previousRecipeId: string,
		recipeId: string,
		expected: RecipeWriteInput,
	): Promise<RecipeDetails> {
		if (previousRecipeId === recipeId) {
			return this.confirmRecipe(UPDATE_CONFIRMATION, recipeId, expected);
		}

		let confirmed: RecipeDetails | undefined;
		await this.confirmation.confirm(UPDATE_CONFIRMATION, async () => {
			try {
				const recipe = await this.recipeStateProvider.getRecipe(recipeId);
				if (recipe.deleted || !matchesRecipe(recipe, expected)) {
					return false;
				}
				const previousDeleted = await this.isRecipeDeleted(previousRecipeId);
				if (!previousDeleted) {
					return false;
				}
				confirmed = recipe;
				return true;
			} catch (error) {
				if (isMissingRecipeError(error)) {
					return false;
				}
				throw error;
			}
		});
		if (!confirmed) {
			throw new Error("Recipe confirmation completed without recipe details");
		}
		return confirmed;
	}

	public async confirmDeleted(recipeId: string): Promise<void> {
		await this.confirmation.confirm(DELETE_CONFIRMATION, () => this.isRecipeDeleted(recipeId));
	}

	private async confirmRecipe(
		context: MutationConfirmationContext,
		recipeId: string,
		expected: RecipeWriteInput,
	): Promise<RecipeDetails> {
		let confirmed: RecipeDetails | undefined;
		await this.confirmation.confirm(context, async () => {
			try {
				const recipe = await this.recipeStateProvider.getRecipe(recipeId);
				if (!recipe.deleted && matchesRecipe(recipe, expected)) {
					confirmed = recipe;
					return true;
				}
				return false;
			} catch (error) {
				if (isMissingRecipeError(error)) {
					return false;
				}
				throw error;
			}
		});
		if (!confirmed) {
			throw new Error("Recipe confirmation completed without recipe details");
		}
		return confirmed;
	}

	private async isRecipeDeleted(recipeId: string): Promise<boolean> {
		try {
			return (await this.recipeStateProvider.getRecipe(recipeId)).deleted;
		} catch (error) {
			if (isMissingRecipeError(error)) {
				return true;
			}
			throw error;
		}
	}
}

function matchesRecipe(actual: RecipeDetails, expected: RecipeWriteInput): boolean {
	return (
		actual.name === expected.name &&
		actual.servings === expected.servings &&
		actual.shared === expected.shared &&
		actual.description === expected.description &&
		actual.cookingTimeMinutes === expected.cookingTimeMinutes &&
		actual.preparationTimeMinutes === expected.preparationTimeMinutes &&
		sameStrings(actual.mealSchema, expected.mealSchema) &&
		sameTags(actual.tags, expected.tags) &&
		actual.ingredients.length === expected.ingredients.length &&
		actual.ingredients.every((ingredient, index) => {
			const expectedIngredient = expected.ingredients[index];
			return (
				expectedIngredient !== undefined &&
				String(ingredient.itemId) === String(expectedIngredient.itemId) &&
				String(ingredient.measureId) === String(expectedIngredient.measureId) &&
				MutationConfirmationValues.sameNumber(ingredient.measureQuantity, expectedIngredient.measureQuantity)
			);
		})
	);
}

function sameStrings(actual: readonly string[], expected: readonly string[]): boolean {
	return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameTags(actual: readonly RecipeTag[], expected: readonly RecipeTag[]): boolean {
	return (
		actual.length === expected.length &&
		actual.every((tag, index) => {
			const expectedTag = expected[index];
			if (!expectedTag || tag.category !== expectedTag.category) {
				return false;
			}
			const caseInsensitive = tag.category === "RECIPE_TAG_USERS_TYPE";
			return (
				sameText(tag.name, expectedTag.name, caseInsensitive) &&
				sameText(tag.translation, expectedTag.translation, caseInsensitive)
			);
		})
	);
}

function sameText(actual: string, expected: string, caseInsensitive: boolean): boolean {
	return caseInsensitive ? actual.toLocaleLowerCase() === expected.toLocaleLowerCase() : actual === expected;
}

function isMissingRecipeError(error: unknown): boolean {
	return error instanceof FitatuClientError && error.failure.kind === "http" && error.failure.statusCode === 404;
}
