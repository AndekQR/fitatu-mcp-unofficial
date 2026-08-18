import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import { FoodSearchClient } from "../../../src/api/foodSearch/FoodSearchClient.ts";
import { RecipeClient } from "../../../src/api/recipes/RecipeClient.ts";
import { MealItemMutationConfirmer } from "../../../src/services/dayPlan/MealItemMutationConfirmer.ts";
import { MealItemMutationService } from "../../../src/services/dayPlan/MealItemMutationService.ts";
import { FoodSearchService } from "../../../src/services/foodSearch/FoodSearchService.ts";
import { ApplicationServices } from "../../../src/services/ApplicationServices.ts";
import type { DayPlan } from "../../../src/api/dayPlan/DayPlan.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import { CleanupTracker, CleanupTrackingMealItemMutationConfirmer } from "../helpers/cleanupTracker.ts";
import { expectMealItem, expectNoMealItem } from "../helpers/dayPlanAssertions.ts";
import {
	searchMultipleQueries,
	selectProductDifferentFrom,
	selectProductsByMeasure,
} from "../helpers/productSelection.ts";
import { addDays, getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const foodSearchClient = new FoodSearchClient();
const foodSearchService = new FoodSearchService(foodSearchClient);
const cleanup = new CleanupTracker(dayPlanClient);
const dietSummaryService = new ApplicationServices().dietSummaryService;
const mealItemMutationService = new MealItemMutationService(
	dayPlanClient,
	foodSearchService,
	new RecipeClient(),
	new CleanupTrackingMealItemMutationConfirmer(new MealItemMutationConfirmer(dayPlanClient), cleanup),
);

describe.sequential("Fitatu day plan integration workflow", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("searches products, adds them with multiple measures, updates, moves, and removes them", async () => {
		const date = getIntegrationTestDate();
		const nextDate = addDays(date, 1);
		const initialPlan = await dayPlanClient.getDayPlan({ date, withRating: true });
		const [sourceMealKey, targetMealKey] = selectTwoMealKeys(initialPlan);
		await searchMultipleQueries({ foodSearchService: foodSearchService, date });
		const products = await selectProductsByMeasure({ foodSearchService: foodSearchService, date });
		const measureProduct = [products.fallbackProduct, products.gramProduct, products.packageProduct].find(
			(product) => product.availableMeasures.some((measure) => measure.measureId !== product.measure.measureId),
		);
		if (!measureProduct) {
			throw new Error("Expected a product with at least two measures for the measure update workflow");
		}
		const alternateMeasure = measureProduct.availableMeasures.find(
			(measure) => measure.measureId !== measureProduct.measure.measureId,
		);
		if (!alternateMeasure) {
			throw new Error("Expected an alternate measure for the measure update workflow");
		}

		await cleanup.prepareMealAddition(date, sourceMealKey, 3);
		const addResult = await mealItemMutationService.addMealItems({
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
					productId: measureProduct.productId,
					foodType: "PRODUCT",
					measureId: measureProduct.measure.measureId,
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

		const persistedItems = await getItems({
			date,
			mealKey: sourceMealKey,
			itemIds: addResult.provisionalItemIds,
		});
		const [quantityItem, measureItem, combinedItem] = persistedItems;
		const quantityItemId = requireItemId(quantityItem?.itemId ?? null);
		const measureItemId = requireItemId(measureItem?.itemId ?? null);
		const combinedItemId = requireItemId(combinedItem?.itemId ?? null);

		const quantityUpdate = await mealItemMutationService.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: quantityItemId,
			measureQuantity: 3,
		});
		expect(quantityUpdate.updatedItemIds).toEqual([quantityItemId]);
		expect(
			(
				await getItemMatching({
					date,
					mealKey: sourceMealKey,
					itemId: quantityItemId,
					matches: (item) => item.measureQuantity === 3,
				})
			).measureQuantity,
		).toBe(3);

		const measureUpdate = await mealItemMutationService.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: measureItemId,
			measureId: alternateMeasure.measureId,
		});
		expect(measureUpdate.updatedItemIds).toEqual([measureItemId]);
		expect(
			(
				await getItemMatching({
					date,
					mealKey: sourceMealKey,
					itemId: measureItemId,
					matches: (item) => String(item.measureId) === alternateMeasure.measureId,
				})
			).measureId,
		).toBe(Number(alternateMeasure.measureId));

		const combinedUpdate = await mealItemMutationService.updateMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			measureQuantity: 1.5,
			eaten: true,
		});
		expect(combinedUpdate.updatedItemIds).toEqual([combinedItemId]);
		const afterCombinedUpdate = await getItemMatching({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			matches: (item) => item.measureQuantity === 1.5 && item.eaten === true,
		});
		expect(afterCombinedUpdate.measureQuantity).toBe(1.5);
		expect(afterCombinedUpdate.eaten).toBe(true);
		const replacementProduct = await selectProductDifferentFrom({
			foodSearchService: foodSearchService,
			date,
			excludedProductId: products.packageProduct.productId,
		});
		const replaceResult = await mealItemMutationService.replaceMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: combinedItemId,
			replacement: {
				foodType: "PRODUCT",
				productId: replacementProduct.productId,
				measureId: replacementProduct.measure.measureId,
				measureQuantity: 0.5,
			},
		});
		expect(replaceResult).toMatchObject({
			operation: "replace",
			oldItemId: combinedItemId,
			deletedItemIds: [combinedItemId],
			itemIdChanged: true,
		});
		const replacementItemId = requireItemId(replaceResult.newItemId);
		await expectMissingItem({ date, mealKey: sourceMealKey, itemId: combinedItemId });
		const replacementItem = await getItem({
			date,
			mealKey: sourceMealKey,
			itemId: replacementItemId,
		});
		expect(String(replacementItem.productId)).toBe(replacementProduct.productId);
		expect(replacementItem.measureQuantity).toBe(0.5);
		expect(replacementItem.eaten).toBe(true);
		const sameDayMove = await mealItemMutationService.moveMealItem({
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

		const sameDayMovedItem = await getItem({
			date,
			mealKey: targetMealKey,
			itemId: requireItemId(sameDayMove.newItemId),
		});
		expect(sameDayMovedItem.measureQuantity).toBe(3);

		const crossDayMove = await mealItemMutationService.moveMealItem({
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

		const crossDayMovedItem = await getItem({
			date: nextDate,
			mealKey: targetMealKey,
			itemId: requireItemId(crossDayMove.newItemId),
		});
		expect(crossDayMovedItem.measureId).toBe(Number(alternateMeasure.measureId));

		const removeResult = await mealItemMutationService.removeMealItem({
			date,
			mealKey: sourceMealKey,
			itemId: replacementItemId,
		});
		expect(removeResult.operation).toBe("remove");
		expect(removeResult.deletedItemIds).toEqual([replacementItemId]);
		cleanup.untrack(date, sourceMealKey, replacementItemId);

		await expectMissingItem({
			date,
			mealKey: sourceMealKey,
			itemId: replacementItemId,
		});
	});

	it("creates, updates in place, reads, and removes a custom item by its day-plan itemId", async () => {
		const date = getIntegrationTestDate();
		const dayPlan = await dayPlanClient.getDayPlan({ date });
		const [mealKey] = selectTwoMealKeys(dayPlan);
		const name = `Fitatu MCP custom ${Date.now()}`;

		await cleanup.prepareMealAddition(date, mealKey, 1);
		const addResult = await mealItemMutationService.addMealItems({
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

		const item = await getItemMatching({
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

		const updatedName = `${name} corrected`;
		const updates = [
			{ options: { energyKcal: 333 }, expected: { energy: 333 } },
			{ options: { proteinG: 13 }, expected: { protein: 13 } },
			{ options: { fatG: 10 }, expected: { fat: 10 } },
			{ options: { carbohydrateG: 44 }, expected: { carbohydrate: 44 } },
			{ options: { name: updatedName }, expected: { name: updatedName } },
		] as const;
		const expectedState: Record<string, string | number> = {
			name,
			energy: 321,
			protein: 12,
			fat: 9,
			carbohydrate: 42,
		};

		for (const update of updates) {
			const updateResult = await mealItemMutationService.updateMealItem({
				date,
				mealKey,
				itemId,
				...update.options,
			});
			Object.assign(expectedState, update.expected);
			expect(updateResult).toMatchObject({
				operation: "update",
				updatedItemIds: [itemId],
				itemIdChanged: false,
			});
			const updatedItem = await getItemMatching({
				date,
				mealKey,
				itemId,
				matches: (candidate) => matchesExpectedCustomState(candidate, expectedState),
			});
			expect(updatedItem).toMatchObject({ itemId, foodType: "CUSTOM_ITEM", ...expectedState });
			if (!("name" in update.options)) {
				await expectDietSummary(date, expectedState);
			}
		}

		const removeResult = await mealItemMutationService.removeMealItem({
			date,
			mealKey,
			itemId,
		});
		expect(removeResult.deletedItemIds).toEqual([itemId]);
		cleanup.untrack(date, mealKey, itemId);
		await expectMissingItem({ date, mealKey, itemId });
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

async function getItem(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}): Promise<DayPlanItem> {
	return getItemMatching({
		...options,
		matches: () => true,
	});
}

async function getItemMatching(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
	readonly matches: (item: DayPlanItem) => boolean;
}): Promise<DayPlanItem> {
	const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
	const item = expectMealItem(dayPlan, options.mealKey, options.itemId);
	if (!options.matches(item)) {
		throw new Error(`Meal item ${options.itemId} did not match the expected confirmed state`);
	}
	return item;
}

async function getItems(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemIds: readonly string[];
}): Promise<readonly DayPlanItem[]> {
	const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
	return options.itemIds.map((itemId) => expectMealItem(dayPlan, options.mealKey, itemId));
}

async function expectMissingItem(options: {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
}): Promise<void> {
	const dayPlan = await dayPlanClient.getDayPlan({ date: options.date });
	expectNoMealItem(dayPlan, options.mealKey, options.itemId);
}

function requireItemId(value: string | null): string {
	if (!value) {
		throw new Error("Expected Fitatu to return a meal item id");
	}

	return value;
}

function matchesExpectedCustomState(item: DayPlanItem, expected: Record<string, string | number>): boolean {
	return Object.entries(expected).every(([field, value]) => item[field as keyof DayPlanItem] === value);
}

async function expectDietSummary(date: string, expected: Record<string, string | number>): Promise<void> {
	let lastObserved: Record<string, number | null> = {};
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const summary = await dietSummaryService.getDietSummary({ fromDate: date, toDate: date });
		lastObserved = {
			energy: summary.energy.loggedTotal,
			protein: summary.allNutrients.find(({ key }) => key === "protein")?.current ?? null,
			fat: summary.allNutrients.find(({ key }) => key === "fat")?.current ?? null,
			carbohydrate: summary.allNutrients.find(({ key }) => key === "carbohydrate")?.current ?? null,
		};
		if (
			lastObserved.energy === expected.energy &&
			lastObserved.protein === expected.protein &&
			lastObserved.fat === expected.fat &&
			lastObserved.carbohydrate === expected.carbohydrate
		) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}
	throw new Error(`Diet summary did not reflect the custom-item update: ${JSON.stringify(lastObserved)}`);
}
