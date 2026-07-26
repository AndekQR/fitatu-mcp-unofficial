import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { CleanupTracker } from "../helpers/cleanupTracker.ts";
import { selectProductsByMeasure } from "../helpers/productSelection.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const foodSearchClient = new FoodSearchClient();
const cleanup = new CleanupTracker(dayPlanClient);
const READ_AFTER_WRITE_ATTEMPTS = 20;
const MEAL_KEY = "breakfast";

describe.sequential("Fitatu sequential meal-item removal integration", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("removes batch-added breakfast products in one accepted day sync", async () => {
		const date = getIntegrationTestDate();
		const initialPlan = await dayPlanClient.getDayPlan({ date });
		const initialItemIds = new Set(
			initialPlan.meals
				.find((meal) => meal.mealKey === MEAL_KEY)
				?.items.flatMap((item) => (item.itemId ? [item.itemId] : [])) ?? [],
		);
		const products = await selectProductsByMeasure({ foodSearchClient, date });
		const items = [products.fallbackProduct, products.gramProduct, products.packageProduct].map((product) => ({
			productId: product.productId,
			foodType: "PRODUCT" as const,
			measureId: product.measure.measureId,
			measureQuantity: 1,
			eaten: true,
		}));
		const addResult = await dayPlanClient.addMealItems({
			date,
			mealKey: MEAL_KEY,
			items,
		});

		expect(addResult.status).toBe("accepted");
		expect(addResult.operation).toBe("add");
		expect(addResult.operationCount).toBe(items.length);
		expect(addResult.provisionalItemIds).toHaveLength(items.length);

		const persistedItems = await waitForNewMealItems(date, MEAL_KEY, initialItemIds, items.length);
		const persistedItemIds = persistedItems.flatMap((item) => (item.itemId ? [item.itemId] : []));
		expect(persistedItemIds).toHaveLength(items.length);
		for (const itemId of persistedItemIds) {
			cleanup.track(date, MEAL_KEY, itemId);
		}

		const removeResult = await dayPlanClient.removeMealItems({
			date,
			itemIds: persistedItemIds,
		});

		expect(removeResult.status).toBe("accepted");
		expect(removeResult.operation).toBe("remove");
		expect(removeResult.operationCount).toBe(items.length);
		expect(removeResult.deletedItemIds).toEqual(persistedItemIds);
	}, 180_000);
});

async function waitForNewMealItems(
	date: string,
	mealKey: string,
	initialItemIds: ReadonlySet<string>,
	expectedCount: number,
): Promise<readonly DayPlanItem[]> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date });
		const items =
			dayPlan.meals
				.find((meal) => meal.mealKey === mealKey)
				?.items.filter((item) => item.itemId !== null && !initialItemIds.has(item.itemId)) ?? [];
		if (items.length >= expectedCount) {
			return items.slice(0, expectedCount);
		}
		await wait(1_000);
	}

	throw new Error(`${expectedCount} new meal items did not appear in ${mealKey} on ${date}`);
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
