import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { MealItemMutationConfirmer } from "../../../src/services/dayPlan/MealItemMutationConfirmer.ts";
import { MealItemMutationService } from "../../../src/services/dayPlan/MealItemMutationService.ts";
import { FoodSearchService } from "../../../src/services/foodSearch/FoodSearchService.ts";
import { CleanupTracker, CleanupTrackingMealItemMutationConfirmer } from "../helpers/cleanupTracker.ts";
import { expectMealItem, expectNoMealItem } from "../helpers/dayPlanAssertions.ts";
import { selectProductsByMeasure } from "../helpers/productSelection.ts";
import { addDays, getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const foodSearchClient = new FoodSearchClient();
const foodSearchService = new FoodSearchService(foodSearchClient);
const cleanup = new CleanupTracker(dayPlanClient);
const mealItemMutationService = new MealItemMutationService(
	dayPlanClient,
	foodSearchService,
	new RecipeClient(),
	new CleanupTrackingMealItemMutationConfirmer(new MealItemMutationConfirmer(dayPlanClient), cleanup),
);
const MEAL_KEY = "breakfast";
const REPLACEMENT_MEAL_KEY = "supper";

describe.sequential("Fitatu sequential meal-item removal integration", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("removes batch-added breakfast products in one accepted day sync", async () => {
		const date = getIntegrationTestDate();
		const products = await selectProductsByMeasure({ foodSearchService: foodSearchService, date });
		const items = [products.fallbackProduct, products.gramProduct, products.packageProduct].map((product) => ({
			productId: product.productId,
			foodType: "PRODUCT" as const,
			measureId: product.measure.measureId,
			measureQuantity: 1,
			eaten: true,
		}));
		await cleanup.prepareMealAddition(date, MEAL_KEY, items.length);
		const addResult = await mealItemMutationService.addMealItems({
			date,
			mealKey: MEAL_KEY,
			items,
		});

		expect(addResult.status).toBe("accepted");
		expect(addResult.operation).toBe("add");
		expect(addResult.operationCount).toBe(items.length);
		expect(addResult.provisionalItemIds).toHaveLength(items.length);

		const persistedItemIds = addResult.provisionalItemIds;
		const afterAdd = await dayPlanClient.getDayPlan({ date });
		for (const itemId of persistedItemIds) {
			expectMealItem(afterAdd, MEAL_KEY, itemId);
		}
		for (const itemId of persistedItemIds) {
			cleanup.track(date, MEAL_KEY, itemId);
		}

		const removeResult = await mealItemMutationService.removeMealItems({
			date,
			items: persistedItemIds.map((itemId) => ({ mealKey: MEAL_KEY, itemId })),
		});

		expect(removeResult.status).toBe("accepted");
		expect(removeResult.operation).toBe("remove");
		expect(removeResult.operationCount).toBe(items.length);
		expect(removeResult.deletedItemIds).toEqual(persistedItemIds);
		const afterRemoval = await dayPlanClient.getDayPlan({ date });
		for (const itemId of persistedItemIds) {
			expectNoMealItem(afterRemoval, MEAL_KEY, itemId);
			cleanup.untrack(date, MEAL_KEY, itemId);
		}
	}, 180_000);

	it("removes a catalog item before adding its custom replacement", async () => {
		const date = addDays(getIntegrationTestDate(), 3);
		const products = await selectProductsByMeasure({ foodSearchService: foodSearchService, date });
		await cleanup.prepareMealAddition(date, REPLACEMENT_MEAL_KEY, 1);
		const addCatalogResult = await mealItemMutationService.addMealItems({
			date,
			mealKey: REPLACEMENT_MEAL_KEY,
			items: [
				{
					productId: products.gramProduct.productId,
					foodType: "PRODUCT",
					measureId: products.gramProduct.measure.measureId,
					measureQuantity: 250,
					eaten: true,
				},
			],
		});
		const provisionalCatalogItemId = requireItemId(addCatalogResult.provisionalItemIds[0] ?? null);
		cleanup.track(date, REPLACEMENT_MEAL_KEY, provisionalCatalogItemId);

		const catalogItemId = provisionalCatalogItemId;
		expectMealItem(await dayPlanClient.getDayPlan({ date }), REPLACEMENT_MEAL_KEY, catalogItemId);

		const removeResult = await mealItemMutationService.removeMealItems({
			date,
			items: [{ mealKey: REPLACEMENT_MEAL_KEY, itemId: catalogItemId }],
		});
		expect(removeResult).toMatchObject({
			status: "accepted",
			operation: "remove",
			deletedItemIds: [catalogItemId],
		});

		const replacementName = `Fitatu MCP custom replacement ${Date.now()}`;
		await cleanup.prepareMealAddition(date, REPLACEMENT_MEAL_KEY, 1);
		const addCustomResult = await mealItemMutationService.addMealItems({
			date,
			mealKey: REPLACEMENT_MEAL_KEY,
			items: [
				{
					foodType: "CUSTOM_ITEM",
					name: replacementName,
					energyKcal: 330,
					proteinG: 32,
					fatG: 22,
					carbohydrateG: 0,
					eaten: true,
				},
			],
		});
		const customItemId = requireItemId(addCustomResult.provisionalItemIds[0] ?? null);
		cleanup.track(date, REPLACEMENT_MEAL_KEY, customItemId);

		const finalItems =
			(await dayPlanClient.getDayPlan({ date })).meals.find((meal) => meal.mealKey === REPLACEMENT_MEAL_KEY)
				?.items ?? [];
		expect(finalItems.some((item) => item.itemId === catalogItemId)).toBe(false);
		expect(finalItems.find((item) => item.itemId === customItemId)).toMatchObject({
			name: replacementName,
			foodType: "CUSTOM_ITEM",
			energy: 330,
			protein: 32,
			fat: 22,
			carbohydrate: 0,
			eaten: true,
		});
		cleanup.untrack(date, REPLACEMENT_MEAL_KEY, catalogItemId);
	}, 180_000);
});

function requireItemId(value: string | null): string {
	if (!value) {
		throw new Error("Expected Fitatu to return a meal item id");
	}

	return value;
}
