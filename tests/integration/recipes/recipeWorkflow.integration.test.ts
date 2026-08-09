import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { FitatuClientError } from "../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import type { RecipeDetails } from "../../../src/api/recipes/RecipeDetails.ts";
import type { RecipeSearchResult } from "../../../src/api/recipes/RecipeSearchResult.ts";
import { DetailedRecipeSearchItem } from "../../../src/services/recipes/DetailedRecipeSearchItem.ts";
import { MealItemMutationConfirmer } from "../../../src/services/dayPlan/MealItemMutationConfirmer.ts";
import { MealItemMutationService } from "../../../src/services/dayPlan/MealItemMutationService.ts";
import { RecipeMutationConfirmer } from "../../../src/services/recipes/RecipeMutationConfirmer.ts";
import { RecipeService } from "../../../src/services/recipes/RecipeService.ts";
import {
	CleanupTracker,
	CleanupTrackingMealItemMutationConfirmer,
	CleanupTrackingRecipeMutationConfirmer,
} from "../helpers/cleanupTracker.ts";
import { findMealItem } from "../helpers/dayPlanAssertions.ts";
import { selectProductsByMeasure } from "../helpers/productSelection.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const recipeClient = new RecipeClient();
const foodSearchClient = new FoodSearchClient();
const dayPlanClient = new DayPlanClient();
const cleanup = new CleanupTracker(dayPlanClient, recipeClient);
const recipeService = new RecipeService(
	recipeClient,
	foodSearchClient,
	new CleanupTrackingRecipeMutationConfirmer(new RecipeMutationConfirmer(recipeClient), cleanup),
);
const mealItemMutationService = new MealItemMutationService(
	dayPlanClient,
	foodSearchClient,
	recipeClient,
	new CleanupTrackingMealItemMutationConfirmer(new MealItemMutationConfirmer(dayPlanClient), cleanup),
);

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
		expect(created.status).toBe("accepted");
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
		expect(created.details.measures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ measureId: "1" }),
				expect.objectContaining({ measureId: "39" }),
			]),
		);
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

		const detailedSearch = await waitForRecipeSearch(uniqueName, created.recipeId, true);
		const detailedRecipe = detailedSearch?.items.find((item) => item.recipeId === created.recipeId);
		if (!(detailedRecipe instanceof DetailedRecipeSearchItem)) {
			throw new Error("Expected recipe search to include canonical details and measures");
		}
		const detailedRecipeDetails = detailedRecipe.details;
		expect(detailedRecipe).toMatchObject({
			recipeId: created.recipeId,
			name: uniqueName,
		});
		expect(detailedRecipeDetails).toMatchObject({
			recipeId: created.recipeId,
			name: uniqueName,
			servings: 2,
			nutritionPerServing: {
				energyKcal: expect.any(Number),
			},
		});
		expect(detailedRecipeDetails.measures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ measureId: "1" }),
				expect.objectContaining({ measureId: "39" }),
			]),
		);
		const servingMeasure = detailedRecipeDetails.measures.find((measure) => measure.measureId === "39");
		if (!servingMeasure?.measureId) {
			throw new Error("Expected detailed recipe search to expose Fitatu's serving measure");
		}

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

		await cleanup.prepareMealAddition(date, "supper", 1);
		const addResult = await mealItemMutationService.addMealItems({
			date,
			mealKey: "supper",
			items: [
				{
					recipeId: created.recipeId,
					foodType: "RECIPE",
					measureId: servingMeasure.measureId,
					measureQuantity: 1,
					ingredientsServing: detailedRecipeDetails.servings,
					eaten: false,
				},
			],
		});
		const provisionalMealItemId = requireItemId(addResult.provisionalItemIds[0]);
		cleanup.track(date, "supper", provisionalMealItemId);
		expect(addResult).toMatchObject({
			status: "accepted",
			operation: "add",
			acceptedItems: [
				{
					itemId: provisionalMealItemId,
					foodType: "RECIPE",
					productId: null,
					recipeId: created.recipeId,
					mealKey: "supper",
				},
			],
		});

		const recipeMealItem = await getRecipeMealItem(date, "supper", created.recipeId);
		const mealItemId = requireItemId(recipeMealItem.itemId);
		cleanup.untrack(date, "supper", provisionalMealItemId);
		cleanup.track(date, "supper", mealItemId);
		expect(recipeMealItem.foodType).toBe("RECIPE");
		expect(String(recipeMealItem.recipeId)).toBe(created.recipeId);
		expect(recipeMealItem.productId).toBeNull();

		await mealItemMutationService.removeMealItems({
			date,
			items: [{ mealKey: "supper", itemId: mealItemId }],
		});
		expect(findMealItem(await dayPlanClient.getDayPlan({ date }), "supper", mealItemId)).toBeNull();
		cleanup.untrack(date, "supper", mealItemId);

		const secondIngredient = [products.gramProduct, products.packageProduct].find(
			(product) =>
				product.productId !== products.fallbackProduct.productId ||
				product.measure.measureId !== products.fallbackProduct.measure.measureId,
		);
		if (!secondIngredient) {
			throw new Error("Expected a second unique product/measure selection for recipe update");
		}

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
					itemId: secondIngredient.productId,
					measureId: secondIngredient.measure.measureId,
					measureQuantity: 2,
					type: "PRODUCT",
				},
			],
		});
		expect(updated.status).toBe("accepted");
		cleanup.trackRecipe(updated.recipeId);

		expect(updated.previousRecipeId).toBe(created.recipeId);
		expect(updated.recipeId).not.toBe(created.recipeId);
		expect(updated.identityChanged).toBe(true);
		expect(updated.details).toMatchObject({ name: updatedName, servings: 3 });
		expect(updated.details.ingredients).toHaveLength(2);
		expect(updated.warnings).toEqual([]);

		const previousState = await getRecipeOrMissing(created.recipeId);
		if (previousState) {
			expect(previousState.recipeId).toBe(created.recipeId);
			expect(previousState.deleted).toBe(true);
		}

		await expect(recipeService.deleteRecipe(updated.recipeId, updatedName)).resolves.toEqual({
			status: "accepted",
			recipeId: updated.recipeId,
			name: updatedName,
			deleted: true,
		});
		cleanup.untrackRecipe(updated.recipeId);

		await expectRecipeUnavailableOrDeleted(updated.recipeId);
	});
});

async function waitForRecipeSearch(
	query: string,
	recipeId: string,
	includeDetails = false,
): Promise<RecipeSearchResult | null> {
	for (let attempt = 0; attempt < 15; attempt += 1) {
		const result = await recipeService.searchRecipes({
			query,
			scope: "mine",
			page: 1,
			limit: 20,
			includeDetails,
		});
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
		if (
			error instanceof FitatuClientError &&
			error.failure.kind === "http" &&
			(error.failure.statusCode === 404 || error.failure.statusCode === 410)
		) {
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

async function getRecipeMealItem(date: string, mealKey: string, recipeId: string): Promise<DayPlanItem> {
	const item = (await dayPlanClient.getDayPlan({ date })).meals
		.find((meal) => meal.mealKey === mealKey)
		?.items.find((candidate) => String(candidate.recipeId) === recipeId);
	if (!item) {
		throw new Error(`Recipe ${recipeId} was not visible in ${mealKey} on ${date} after confirmation`);
	}
	return item;
}

function requireItemId(value: string | null | undefined): string {
	if (!value) {
		throw new Error("Expected Fitatu to return a meal item id");
	}
	return value;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
