import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { MealItemMutationConfirmer } from "../../../src/services/dayPlan/MealItemMutationConfirmer.ts";
import { MealItemMutationService } from "../../../src/services/dayPlan/MealItemMutationService.ts";
import { FoodSearchService } from "../../../src/services/foodSearch/FoodSearchService.ts";
import { CleanupTracker, CleanupTrackingMealItemMutationConfirmer } from "../helpers/cleanupTracker.ts";
import { findMealItem } from "../helpers/dayPlanAssertions.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const cleanup = new CleanupTracker(dayPlanClient);
const mealItemMutationService = new MealItemMutationService(
	dayPlanClient,
	new FoodSearchService(new FoodSearchClient()),
	new RecipeClient(),
	new CleanupTrackingMealItemMutationConfirmer(new MealItemMutationConfirmer(dayPlanClient), cleanup),
);
const READ_AFTER_WRITE_ATTEMPTS = 60;
const RECIPE_ID = "32519808";
const REPORTED_RECIPE_ID = "159408954";
const MEAL_KEY = "supper";

describe.sequential("Fitatu recipe meal-item integration", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("maps a raw recipeId to a visible recipe meal item", async () => {
		const date = getIntegrationTestDate();
		await cleanup.prepareMealAddition(date, MEAL_KEY, 1);
		const addResult = await mealItemMutationService.addMealItems({
			date,
			mealKey: MEAL_KEY,
			items: [
				{
					recipeId: RECIPE_ID,
					foodType: "RECIPE",
					measureId: "39",
					measureQuantity: 1.5,
					eaten: true,
				},
			],
		});

		expect(addResult.status).toBe("accepted");
		expect(addResult.operation).toBe("add");
		expect(addResult.acceptedItems).toMatchObject([
			{ foodType: "RECIPE", productId: null, recipeId: RECIPE_ID, mealKey: MEAL_KEY },
		]);

		const itemId = addResult.provisionalItemIds[0];
		expect(itemId).toBeTruthy();
		cleanup.track(date, MEAL_KEY, itemId);

		const item = await waitForItem(date, MEAL_KEY, requireItemId(itemId));
		expect(item.foodType).toBe("RECIPE");
		expect(String(item.recipeId)).toBe(RECIPE_ID);
		expect(item.productId).toBeNull();
		expect(String(item.measureId)).toBe("39");
		expect(item.measureQuantity).toBe(1.5);
		expect(item.eaten).toBe(true);
	});

	describe("reported recipe serving regression", () => {
		it.fails("persists the reported recipe serving after accepting the add request", async () => {
			const date = getIntegrationTestDate();
			await cleanup.prepareMealAddition(date, MEAL_KEY, 1);
			const addResult = await dayPlanClient.addMealItems({
				date,
				mealKey: MEAL_KEY,
				items: [
					{
						recipeId: REPORTED_RECIPE_ID,
						foodType: "RECIPE",
						measureId: "39",
						measureQuantity: 1.7777777778,
						ingredientsServing: 1.7777777778,
						eaten: true,
					},
				],
			});

			expect(addResult.status).toBe("accepted");
			expect(addResult.operation).toBe("add");
			expect(addResult.acceptedItems).toMatchObject([
				{
					foodType: "RECIPE",
					productId: null,
					recipeId: REPORTED_RECIPE_ID,
					mealKey: MEAL_KEY,
				},
			]);

			const itemId = requireItemId(addResult.provisionalItemIds[0]);
			cleanup.track(date, MEAL_KEY, itemId);

			const item = await waitForItem(date, MEAL_KEY, itemId);
			cleanup.confirmMealAddition(date, MEAL_KEY);
			expect(item.foodType).toBe("RECIPE");
			expect(String(item.recipeId)).toBe(REPORTED_RECIPE_ID);
			expect(item.productId).toBeNull();
			expect(String(item.measureId)).toBe("39");
			expect(item.measureQuantity).toBe(1.78);
			expect(item.eaten).toBe(true);
		});

		it("persists the reported recipe when ingredientsServing matches the recipe serving count", async () => {
			const date = getIntegrationTestDate();
			await cleanup.prepareMealAddition(date, MEAL_KEY, 1);
			const addResult = await dayPlanClient.addMealItems({
				date,
				mealKey: MEAL_KEY,
				items: [
					{
						recipeId: REPORTED_RECIPE_ID,
						foodType: "RECIPE",
						measureId: "39",
						measureQuantity: 1.7777777778,
						ingredientsServing: 8,
						eaten: true,
					},
				],
			});

			const itemId = requireItemId(addResult.provisionalItemIds[0]);
			cleanup.track(date, MEAL_KEY, itemId);

			const item = await waitForItem(date, MEAL_KEY, itemId);
			cleanup.confirmMealAddition(date, MEAL_KEY);
			expect(item.measureQuantity).toBe(1.78);
			expect(item.eaten).toBe(true);
		});
	});
});

async function waitForItem(date: string, mealKey: string, itemId: string): Promise<DayPlanItem> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date });
		const item = findMealItem(dayPlan, mealKey, itemId);
		if (item) {
			return item;
		}
		await wait(1_000);
	}

	throw new Error(`Recipe meal item ${itemId} did not appear in ${mealKey} on ${date}`);
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
