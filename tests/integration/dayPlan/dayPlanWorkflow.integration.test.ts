import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import type { DayPlan } from "../../../src/api/dayPlan/DayPlan.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { CleanupTracker } from "../helpers/cleanupTracker.ts";
import { expectMealItem, expectNoMealItem, findMealItem } from "../helpers/dayPlanAssertions.ts";
import { searchMultipleQueries, selectProductsByMeasure } from "../helpers/productSelection.ts";
import { addDays, getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const foodSearchClient = new FoodSearchClient();
const cleanup = new CleanupTracker(dayPlanClient);
const READ_AFTER_WRITE_ATTEMPTS = 20;

describe.sequential("Fitatu day plan integration workflow", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("searches products, adds them with multiple measures, updates, moves, and removes them", async () => {
		const date = getIntegrationTestDate();
		const nextDate = addDays(date, 1);
		const initialPlan = await dayPlanClient.getDayPlan({ date, withRating: true });
		const [sourceMealKey, targetMealKey] = selectTwoMealKeys(initialPlan);
		const initialSourceItemIds = new Set(
			initialPlan.meals
				.find((meal) => meal.mealKey === sourceMealKey)
				?.items.flatMap((item) => (item.itemId ? [item.itemId] : [])) ?? [],
		);

		await searchMultipleQueries({ foodSearchClient, date });
		const products = await selectProductsByMeasure({ foodSearchClient, date });

		const addResult = await dayPlanClient.addMealItems({
			date,
			mealKey: sourceMealKey,
			items: [
				{
					productId: products.fallbackProduct.productId,
					foodType: "PRODUCT",
					measureId: products.fallbackProduct.measure.measureId,
					measureQuantity: 1,
					eaten: false,
				},
				{
					productId: products.gramProduct.productId,
					foodType: "PRODUCT",
					measureId: products.gramProduct.measure.measureId,
					measureQuantity: 100,
					eaten: false,
				},
				{
					productId: products.packageProduct.productId,
					foodType: "PRODUCT",
					measureId: products.packageProduct.measure.measureId,
					measureQuantity: 2,
					eaten: false,
				},
			],
		});

		expect(addResult.status).toBe("accepted");
		expect(addResult.operation).toBe("add");
		expect(addResult.operationCount).toBe(3);
		expect(addResult.provisionalItemIds).toHaveLength(3);
		for (const provisionalItemId of addResult.provisionalItemIds) {
			cleanup.track(date, sourceMealKey, provisionalItemId);
		}

		const persistedItems = await waitForNewMealItems({
			date,
			mealKey: sourceMealKey,
			initialItemIds: initialSourceItemIds,
			expectedCount: 3,
		});
		const [quantityItem, measureItem, combinedItem] = persistedItems;
		const quantityItemId = requireItemId(quantityItem?.itemId ?? null);
		const measureItemId = requireItemId(measureItem?.itemId ?? null);
		const combinedItemId = requireItemId(combinedItem?.itemId ?? null);

		for (const provisionalItemId of addResult.provisionalItemIds) {
			cleanup.untrack(date, sourceMealKey, provisionalItemId);
		}
		for (const itemId of [quantityItemId, measureItemId, combinedItemId]) {
			cleanup.track(date, sourceMealKey, itemId);
		}

		const quantityUpdate = await dayPlanClient.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: quantityItemId,
			measureQuantity: 3,
		});
		expect(quantityUpdate.updatedItemIds).toEqual([quantityItemId]);
		expect(
			(
				await waitForItemMatching({
					date,
					mealKey: sourceMealKey,
					itemId: quantityItemId,
					matches: (item) => item.measureQuantity === 3,
				})
			).measureQuantity,
		).toBe(3);

		const measureUpdate = await dayPlanClient.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: measureItemId,
			measureId: products.packageProduct.measure.measureId,
		});
		expect(measureUpdate.updatedItemIds).toEqual([measureItemId]);
		expect(
			(
				await waitForItemMatching({
					date,
					mealKey: sourceMealKey,
					itemId: measureItemId,
					matches: (item) => String(item.measureId) === products.packageProduct.measure.measureId,
				})
			).measureId,
		).toBe(Number(products.packageProduct.measure.measureId));

		const combinedUpdate = await dayPlanClient.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			measureQuantity: 1.5,
			eaten: true,
		});
		expect(combinedUpdate.updatedItemIds).toEqual([combinedItemId]);
		const afterCombinedUpdate = await waitForItemMatching({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			matches: (item) => item.measureQuantity === 1.5 && item.eaten === true,
		});
		expect(afterCombinedUpdate.measureQuantity).toBe(1.5);
		expect(afterCombinedUpdate.eaten).toBe(true);

		const sameDayMove = await dayPlanClient.moveMealItem({
			fromDate: date,
			fromMealKey: sourceMealKey,
			itemId: quantityItemId,
			toMealKey: targetMealKey,
		});
		expect(sameDayMove.operation).toBe("move");
		expect(sameDayMove.oldItemId).toBe(quantityItemId);
		expect(sameDayMove.newItemId).toBeTruthy();
		expect(sameDayMove.itemIdChanged).toBe(true);
		cleanup.move({
			fromDate: date,
			fromMealKey: sourceMealKey,
			oldItemId: quantityItemId,
			toDate: date,
			toMealKey: targetMealKey,
			newItemId: sameDayMove.newItemId,
		});

		const sameDayMovedItem = await waitForItem({
			date,
			mealKey: targetMealKey,
			itemId: requireItemId(sameDayMove.newItemId),
		});
		expect(sameDayMovedItem.measureQuantity).toBe(3);

		const crossDayMove = await dayPlanClient.moveMealItem({
			fromDate: date,
			fromMealKey: sourceMealKey,
			itemId: measureItemId,
			toDate: nextDate,
			toMealKey: targetMealKey,
		});
		expect(crossDayMove.operation).toBe("move");
		expect(crossDayMove.oldItemId).toBe(measureItemId);
		expect(crossDayMove.newItemId).toBeTruthy();
		expect(crossDayMove.itemIdChanged).toBe(true);
		cleanup.move({
			fromDate: date,
			fromMealKey: sourceMealKey,
			oldItemId: measureItemId,
			toDate: nextDate,
			toMealKey: targetMealKey,
			newItemId: crossDayMove.newItemId,
		});

		const crossDayMovedItem = await waitForItem({
			date: nextDate,
			mealKey: targetMealKey,
			itemId: requireItemId(crossDayMove.newItemId),
		});
		expect(crossDayMovedItem.measureId).toBe(Number(products.packageProduct.measure.measureId));

		const removeResult = await dayPlanClient.removeMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			itemKind: "auto",
		});
		expect(removeResult.operation).toBe("remove");
		expect(removeResult.deletedItemIds).toEqual([combinedItemId]);
		cleanup.untrack(date, sourceMealKey, combinedItemId);

		await waitForMissingItem({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
		});
	});

	it("creates, reads, and removes a custom item by its day-plan itemId", async () => {
		const date = getIntegrationTestDate();
		const dayPlan = await dayPlanClient.getDayPlan({ date });
		const [mealKey] = selectTwoMealKeys(dayPlan);
		const name = `Fitatu MCP custom ${Date.now()}`;

		const addResult = await dayPlanClient.addMealItems({
			date,
			mealKey,
			items: [
				{
					foodType: "CUSTOM_ITEM",
					name,
					energyKcal: 321,
					proteinG: 12,
					fatG: 9,
					carbohydrateG: 42,
					eaten: true,
				},
			],
		});

		expect(addResult).toMatchObject({
			status: "accepted",
			operation: "add",
			acceptedItems: [
				{
					foodType: "CUSTOM_ITEM",
					mealKey,
				},
			],
		});
		const itemId = requireItemId(addResult.provisionalItemIds[0] ?? null);
		cleanup.track(date, mealKey, itemId);

		const item = await waitForItemMatching({
			date,
			mealKey,
			itemId,
			matches: (candidate) => candidate.name === name,
		});
		expect(item).toMatchObject({
			itemId,
			name,
			foodType: "CUSTOM_ITEM",
			productId: null,
			recipeId: null,
			energy: 321,
			protein: 12,
			fat: 9,
			carbohydrate: 42,
			eaten: true,
		});

		const removeResult = await dayPlanClient.removeMealItem({
			date,
			mealKey,
			itemId,
			itemKind: "auto",
		});
		expect(removeResult.deletedItemIds).toEqual([itemId]);
		cleanup.untrack(date, mealKey, itemId);
		await waitForMissingItem({ date, mealKey, itemId });
	});
});

function selectTwoMealKeys(dayPlan: DayPlan): [string, string] {
	const mealKeys = dayPlan.meals.map((meal) => meal.mealKey).filter(Boolean);
	const [firstMealKey, secondMealKey] = mealKeys;
	if (!firstMealKey || !secondMealKey) {
		throw new Error(`Expected at least two meals in day plan ${dayPlan.date}, got: ${mealKeys.join(", ")}`);
	}

	return [firstMealKey, secondMealKey];
}

async function waitForItem(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}): Promise<DayPlanItem> {
	return waitForItemMatching({
		...options,
		matches: () => true,
	});
}

async function waitForItemMatching(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
	readonly matches: (item: DayPlanItem) => boolean;
}): Promise<DayPlanItem> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
		const item = findMealItem(dayPlan, options.mealKey, options.itemId);
		if (item && options.matches(item)) {
			return item;
		}
		await wait(1_000);
	}

	const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
	return expectMealItem(dayPlan, options.mealKey, options.itemId);
}

async function waitForNewMealItems(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly initialItemIds: ReadonlySet<string>;
	readonly expectedCount: number;
}): Promise<readonly DayPlanItem[]> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
		const newItems =
			dayPlan.meals
				.find((meal) => meal.mealKey === options.mealKey)
				?.items.filter((item) => item.itemId !== null && !options.initialItemIds.has(item.itemId)) ?? [];
		if (newItems.length >= options.expectedCount) {
			return newItems.slice(0, options.expectedCount);
		}
		await wait(1_000);
	}

	throw new Error(`${options.expectedCount} new items did not appear in ${options.mealKey} on ${options.date}`);
}

async function waitForMissingItem(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}): Promise<void> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
		if (!findMealItem(dayPlan, options.mealKey, options.itemId)) {
			return;
		}
		await wait(1_000);
	}

	const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
	expectNoMealItem(dayPlan, options.mealKey, options.itemId);
}

function requireItemId(value: string | null): string {
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
