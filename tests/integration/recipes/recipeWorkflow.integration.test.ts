import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { RecipeError } from "../../../src/api/recipes/RecipeError.ts";
import type { RecipeDetails } from "../../../src/api/recipes/RecipeDetails.ts";
import type { RecipeSearchResult } from "../../../src/api/recipes/RecipeSearchResult.ts";
import { RecipeService } from "../../../src/services/recipes/RecipeService.ts";
import { CleanupTracker } from "../helpers/cleanupTracker.ts";
import { findMealItem } from "../helpers/dayPlanAssertions.ts";
import { selectProductsByMeasure } from "../helpers/productSelection.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const recipeClient = new RecipeClient();
const recipeService = new RecipeService(recipeClient);
const foodSearchClient = new FoodSearchClient();
const dayPlanClient = new DayPlanClient();
const cleanup = new CleanupTracker(dayPlanClient, recipeClient);
const READ_AFTER_WRITE_ATTEMPTS = 20;

describe.sequential("Fitatu recipe integration workflow", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("creates, reads, discovers, replaces, and deletes an owned private recipe", async () => {
		const uniqueName = `__Fitatu_MCP_Recipe_${Date.now()}__`;
		const updatedName = `${uniqueName}_updated`;
		const date = getIntegrationTestDate();
		const products = await selectProductsByMeasure({
			foodSearchClient,
			date,
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
		expect(created.warnings).toEqual([]);

		const read = await recipeService.getRecipe(created.recipeId);
		expect(read.name).toBe(uniqueName);
		expect(read.nutritionPerServing.energyKcal).not.toBeNull();

		const exactSearch = await waitForRecipeSearch(uniqueName, created.recipeId);
		expect(exactSearch).not.toBeNull();
		expect(exactSearch?.items.some((item) => item.recipeId === created.recipeId)).toBe(true);
		expect(exactSearch?.items.every((item) => item.name.toLowerCase().includes(uniqueName.toLowerCase()))).toBe(
			true,
		);

		const caseInsensitiveSearch = await waitForRecipeSearch(uniqueName.toLowerCase(), created.recipeId);
		expect(caseInsensitiveSearch).not.toBeNull();
		expect(caseInsensitiveSearch?.items.every((item) => item.name.includes("Fitatu_MCP_Recipe"))).toBe(true);

		const partialSearch = await waitForRecipeSearch("mcp_recipe_", created.recipeId);
		expect(partialSearch).not.toBeNull();
		expect(partialSearch?.items.some((item) => item.recipeId === created.recipeId)).toBe(true);

		const missingSearch = await recipeService.searchRecipes({
			query: `${uniqueName}_definitely_missing`,
			scope: "mine",
			page: 1,
			limit: 20,
		});
		expect(missingSearch).toMatchObject({ count: 0, items: [] });

		const list = await recipeService.searchRecipes({ scope: "mine", page: 1, limit: 20 });
		expect(Array.isArray(list.items)).toBe(true);
		expect(list.items.every((item) => item.source === "mine")).toBe(true);

		const addResult = await dayPlanClient.addMealItems({
			date,
			mealKey: "supper",
			items: [
				{
					foodId: created.recipeId,
					foodType: "RECIPE",
					measureId: "39",
					measureQuantity: 1,
					ingredientsServing: 1,
					eaten: false,
				},
			],
		});
		const mealItemId = requireItemId(addResult.createdItemIds[0]);
		cleanup.track(date, "supper", mealItemId);
		expect(addResult).toMatchObject({
			status: "accepted",
			operation: "add",
			acceptedItems: [
				{
					itemId: mealItemId,
					foodType: "RECIPE",
					productId: null,
					recipeId: created.recipeId,
					mealKey: "supper",
				},
			],
		});

		const recipeMealItem = await waitForMealItem(date, "supper", mealItemId);
		expect(recipeMealItem.foodType).toBe("RECIPE");
		expect(String(recipeMealItem.recipeId)).toBe(created.recipeId);
		expect(recipeMealItem.productId).toBeNull();

		await dayPlanClient.removeMealItem({
			date,
			mealKey: "supper",
			itemId: mealItemId,
			itemKind: "auto",
		});
		await waitForMealItemAbsent(date, "supper", mealItemId);
		cleanup.untrack(date, "supper", mealItemId);

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
					itemId: products.fallbackProduct.productId,
					measureId: products.fallbackProduct.measure.measureId,
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
		expect(updated.warnings).toEqual([
			{
				code: "DUPLICATE_INGREDIENT_SELECTION",
				message: `Ingredient itemId ${products.fallbackProduct.productId} with measureId ${products.fallbackProduct.measure.measureId} appears more than once.`,
				itemId: products.fallbackProduct.productId,
				measureId: products.fallbackProduct.measure.measureId,
				indexes: [0, 1],
			},
		]);

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

async function waitForRecipeSearch(query: string, recipeId: string): Promise<RecipeSearchResult | null> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		const result = await recipeService.searchRecipes({ query, scope: "mine", page: 1, limit: 20 });
		if (result.items.some((item) => item.recipeId === recipeId)) {
			return result;
		}
		await wait(1_000);
	}
	return null;
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

async function waitForMealItem(date: string, mealKey: string, itemId: string): Promise<DayPlanItem> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const item = findMealItem(await dayPlanClient.getDayPlan({ date }), mealKey, itemId);
		if (item) {
			return item;
		}
		await wait(1_000);
	}

	throw new Error(`Recipe meal item ${itemId} did not appear in ${mealKey} on ${date}`);
}

async function waitForMealItemAbsent(date: string, mealKey: string, itemId: string): Promise<void> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const item = findMealItem(await dayPlanClient.getDayPlan({ date }), mealKey, itemId);
		if (!item) {
			return;
		}
		await wait(1_000);
	}

	throw new Error(`Recipe meal item ${itemId} remained in ${mealKey} on ${date}`);
}

function requireItemId(value: string | undefined): string {
	if (!value) {
		throw new Error("Expected Fitatu add operation to return a created item id");
	}
	return value;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
