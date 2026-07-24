import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { RecipeError } from "../../../src/api/recipes/RecipeError.ts";
import type { RecipeDetails } from "../../../src/api/recipes/RecipeDetails.ts";
import { RecipeService } from "../../../src/services/recipes/RecipeService.ts";
import { CleanupTracker } from "../helpers/cleanupTracker.ts";
import { selectProductsByMeasure } from "../helpers/productSelection.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const recipeClient = new RecipeClient();
const recipeService = new RecipeService(recipeClient);
const foodSearchClient = new FoodSearchClient();
const cleanup = new CleanupTracker(new DayPlanClient(), recipeClient);

describe.sequential("Fitatu recipe integration workflow", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("creates, reads, discovers, replaces, and deletes an owned private recipe", async () => {
		const uniqueName = `__fitatu_mcp_recipe_${Date.now()}__`;
		const updatedName = `${uniqueName}_updated`;
		const products = await selectProductsByMeasure({
			foodSearchClient,
			date: getIntegrationTestDate(),
		});

		const created = await recipeService.createRecipe({
			name: uniqueName,
			ingredients: [
				{
					itemId: products.fallbackProduct.productId,
					measureId: products.fallbackProduct.measure.measureId,
					measureQuantity: 1,
					type: "PRODUCT",
				},
			],
			tags: [
				{
					name: "fitatu_mcp_test",
					category: "RECIPE_TAG_USERS_TYPE",
					translation: "fitatu_mcp_test",
				},
			],
			servings: 2,
			shared: false,
			description: "1. Integration test recipe",
			cookingTimeMinutes: 1,
			preparationTimeMinutes: null,
			mealSchema: ["breakfast"],
		});
		cleanup.trackRecipe(created.recipeId);

		expect(created.details).toMatchObject({
			recipeId: created.recipeId,
			name: uniqueName,
			servings: 2,
			shared: false,
			editable: true,
			deleted: false,
		});
		expect(created.details.ingredients).toHaveLength(1);

		const read = await recipeService.getRecipe(created.recipeId);
		expect(read.name).toBe(uniqueName);
		expect(read.nutritionPerServing.energyKcal).not.toBeNull();

		const exactSearch = await waitForRecipeSearch(uniqueName, created.recipeId);
		expect(exactSearch).toBe(true);

		const list = await recipeService.searchRecipes({ scope: "mine", page: 1, limit: 20 });
		expect(Array.isArray(list.items)).toBe(true);
		expect(list.items.every((item) => item.source === "mine")).toBe(true);

		const updated = await recipeService.updateRecipe(created.recipeId, {
			name: updatedName,
			servings: 3,
			ingredients: [
				{
					itemId: products.fallbackProduct.productId,
					measureId: products.fallbackProduct.measure.measureId,
					measureQuantity: 1,
					type: "PRODUCT",
				},
				{
					itemId: products.packageProduct.productId,
					measureId: products.packageProduct.measure.measureId,
					measureQuantity: 2,
					type: "PRODUCT",
				},
			],
		});
		cleanup.trackRecipe(updated.recipeId);

		expect(updated.previousRecipeId).toBe(created.recipeId);
		expect(updated.recipeId).not.toBe(created.recipeId);
		expect(updated.identityChanged).toBe(true);
		expect(updated.details).toMatchObject({ name: updatedName, servings: 3 });
		expect(updated.details.ingredients).toHaveLength(2);

		const previousState = await getRecipeOrMissing(created.recipeId);
		if (previousState) {
			expect(previousState.recipeId).toBe(created.recipeId);
			expect(previousState.deleted).toBe(true);
		}

		await expect(recipeService.deleteRecipe(updated.recipeId, updatedName)).resolves.toEqual({
			recipeId: updated.recipeId,
			name: updatedName,
			deleted: true,
		});
		cleanup.untrackRecipe(updated.recipeId);

		await expectRecipeUnavailableOrDeleted(updated.recipeId);
	});
});

async function waitForRecipeSearch(query: string, recipeId: string): Promise<boolean> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		const result = await recipeService.searchRecipes({ query, scope: "mine", page: 1, limit: 20 });
		if (result.items.some((item) => item.recipeId === recipeId)) {
			return true;
		}
		await wait(1_000);
	}
	return false;
}

async function getRecipeOrMissing(recipeId: string): Promise<RecipeDetails | null> {
	try {
		return await recipeService.getRecipe(recipeId);
	} catch (error) {
		if (error instanceof RecipeError && (error.statusCode === 404 || error.statusCode === 410)) {
			return null;
		}
		throw error;
	}
}

async function expectRecipeUnavailableOrDeleted(recipeId: string): Promise<void> {
	const recipe = await getRecipeOrMissing(recipeId);
	if (recipe) {
		expect(recipe.deleted).toBe(true);
	}
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
