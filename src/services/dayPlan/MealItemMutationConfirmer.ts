import type { AddMealItemsOptions } from "../../api/dayPlan/AddMealItemsOptions.ts";
import type { DayPlan } from "../../api/dayPlan/DayPlan.ts";
import type { DayPlanItem } from "../../api/dayPlan/DayPlanItem.ts";
import type { GetDayPlanOptions } from "../../api/dayPlan/GetDayPlanOptions.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import type { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import { BoundedPoller } from "../../shared/BoundedPoller.ts";
import { AddMealItemsTool } from "../../tools/addMealItems/AddMealItemsTool.ts";
import { GetDayPlanItemsTool } from "../../tools/dayPlanItems/GetDayPlanItemsTool.ts";
import { MoveMealItemTool } from "../../tools/mealItems/MoveMealItemTool.ts";
import { RemoveMealItemsTool } from "../../tools/mealItems/RemoveMealItemsTool.ts";
import { UpdateMealItemTool } from "../../tools/mealItems/UpdateMealItemTool.ts";
import { MutationConfirmationContext } from "../MutationConfirmationContext.ts";
import { MutationConfirmationSupport } from "../MutationConfirmationSupport.ts";
import { MutationConfirmationValues } from "../MutationConfirmationValues.ts";

const ADD_CONFIRMATION = new MutationConfirmationContext(AddMealItemsTool.toolName, GetDayPlanItemsTool.toolName);
const UPDATE_CONFIRMATION = new MutationConfirmationContext(UpdateMealItemTool.toolName, GetDayPlanItemsTool.toolName);
const REMOVE_CONFIRMATION = new MutationConfirmationContext(RemoveMealItemsTool.toolName, GetDayPlanItemsTool.toolName);
const MOVE_CONFIRMATION = new MutationConfirmationContext(MoveMealItemTool.toolName, GetDayPlanItemsTool.toolName);

interface DayPlanProvider {
	getDayPlan(options: GetDayPlanOptions): Promise<DayPlan>;
}

export class MealItemMutationConfirmer {
	private readonly dayPlanProvider: DayPlanProvider;
	private readonly confirmation: MutationConfirmationSupport;

	public constructor(dayPlanProvider: DayPlanProvider, poller = new BoundedPoller()) {
		this.dayPlanProvider = dayPlanProvider;
		this.confirmation = new MutationConfirmationSupport(poller);
	}

	public async confirmAdded(options: AddMealItemsOptions, result: MealItemMutationResult): Promise<void> {
		await this.confirmation.confirm(ADD_CONFIRMATION, async () => {
			const dayPlan = await this.dayPlanProvider.getDayPlan({
				date: options.date,
				userId: options.userId,
			});
			const meal = dayPlan.meals.find(({ mealKey }) => mealKey === options.mealKey);
			if (!meal) {
				return false;
			}

			return result.acceptedItems.every((acceptedItem) => {
				const expected = options.items[acceptedItem.index];
				const actual = meal.items.find(({ itemId }) => itemId === acceptedItem.itemId);
				return expected !== undefined && actual !== undefined && matchesAddedItem(actual, expected);
			});
		});
	}

	public async confirmUpdated(options: UpdateMealItemOptions): Promise<void> {
		await this.confirmation.confirm(UPDATE_CONFIRMATION, async () => {
			const dayPlan = await this.dayPlanProvider.getDayPlan({
				date: options.date,
				userId: options.userId,
			});
			const actual = dayPlan.meals
				.find(({ mealKey }) => mealKey === options.mealKey)
				?.items.find(({ itemId }) => itemId === options.itemId);
			return (
				actual !== undefined &&
				(options.measureQuantity === undefined ||
					MutationConfirmationValues.sameNumber(actual.measureQuantity, options.measureQuantity)) &&
				(options.measureId === undefined ||
					MutationConfirmationValues.sameIdentifier(actual.measureId, options.measureId)) &&
				(options.eaten === undefined || actual.eaten === options.eaten) &&
				(options.name === undefined || actual.name === options.name.trim()) &&
				(options.energyKcal === undefined ||
					MutationConfirmationValues.sameNumber(actual.energy, options.energyKcal)) &&
				(options.proteinG === undefined ||
					MutationConfirmationValues.sameNumber(actual.protein, options.proteinG)) &&
				(options.fatG === undefined || MutationConfirmationValues.sameNumber(actual.fat, options.fatG)) &&
				(options.carbohydrateG === undefined ||
					MutationConfirmationValues.sameNumber(actual.carbohydrate, options.carbohydrateG))
			);
		});
	}

	public async confirmRemoved(options: RemoveMealItemsOptions): Promise<void> {
		const selectedIds = new Set(options.itemIds);
		await this.confirmation.confirm(REMOVE_CONFIRMATION, async () => {
			const dayPlan = await this.dayPlanProvider.getDayPlan({
				date: options.date,
				userId: options.userId,
			});
			return dayPlan.meals.every((meal) =>
				meal.items.every(({ itemId }) => itemId === null || !selectedIds.has(itemId)),
			);
		});
	}

	public async getMoveSource(options: MoveMealItemOptions): Promise<DayPlanItem> {
		const dayPlan = await this.dayPlanProvider.getDayPlan({
			date: options.fromDate,
			userId: options.userId,
		});
		const source = findItem(dayPlan, options.fromMealKey, options.itemId);
		if (!source) {
			throw new Error("Meal item not found");
		}
		return source;
	}

	public async confirmMoved(
		options: MoveMealItemOptions,
		result: MealItemMutationResult,
		source: DayPlanItem,
	): Promise<void> {
		const toDate = options.toDate ?? options.fromDate;
		const toMealKey = options.toMealKey ?? options.fromMealKey;
		const newItemId = result.newItemId;
		if (newItemId === null) {
			throw new Error("Moved meal item id was not available");
		}

		await this.confirmation.confirm(MOVE_CONFIRMATION, async () => {
			const sourcePlan = await this.dayPlanProvider.getDayPlan({
				date: options.fromDate,
				userId: options.userId,
			});
			const targetPlan =
				toDate === options.fromDate
					? sourcePlan
					: await this.dayPlanProvider.getDayPlan({ date: toDate, userId: options.userId });
			const oldItem = findItem(sourcePlan, options.fromMealKey, options.itemId);
			const newItem = findItem(targetPlan, toMealKey, newItemId);
			return oldItem === undefined && newItem !== undefined && matchesMovedItem(newItem, source);
		});
	}
}

function findItem(dayPlan: DayPlan, mealKey: string, itemId: string): DayPlanItem | undefined {
	return dayPlan.meals.find((meal) => meal.mealKey === mealKey)?.items.find((item) => item.itemId === itemId);
}

function matchesAddedItem(actual: DayPlanItem, expected: MealItemInput): boolean {
	if (actual.foodType !== expected.foodType || actual.eaten !== (expected.eaten ?? false)) {
		return false;
	}

	if (expected.foodType === "CUSTOM_ITEM") {
		return (
			actual.name === expected.name &&
			MutationConfirmationValues.sameNumber(actual.energy, expected.energyKcal) &&
			MutationConfirmationValues.sameNumber(actual.protein, expected.proteinG ?? 0) &&
			MutationConfirmationValues.sameNumber(actual.fat, expected.fatG ?? 0) &&
			MutationConfirmationValues.sameNumber(actual.carbohydrate, expected.carbohydrateG ?? 0)
		);
	}

	const definitionMatches =
		expected.foodType === "RECIPE"
			? MutationConfirmationValues.sameIdentifier(actual.recipeId, expected.recipeId)
			: MutationConfirmationValues.sameIdentifier(actual.productId, expected.productId);
	return (
		definitionMatches &&
		MutationConfirmationValues.sameIdentifier(actual.measureId, expected.measureId) &&
		MutationConfirmationValues.sameNumber(actual.measureQuantity, expected.measureQuantity ?? 1)
	);
}

function matchesMovedItem(actual: DayPlanItem, source: DayPlanItem): boolean {
	return (
		actual.foodType === source.foodType &&
		MutationConfirmationValues.sameNullableIdentifier(actual.productId, source.productId) &&
		MutationConfirmationValues.sameNullableIdentifier(actual.recipeId, source.recipeId) &&
		actual.name === source.name &&
		MutationConfirmationValues.sameNullableIdentifier(actual.measureId, source.measureId) &&
		MutationConfirmationValues.sameNullableNumber(actual.measureQuantity, source.measureQuantity) &&
		actual.eaten === source.eaten &&
		MutationConfirmationValues.sameNullableNumber(actual.energy, source.energy) &&
		MutationConfirmationValues.sameNullableNumber(actual.protein, source.protein) &&
		MutationConfirmationValues.sameNullableNumber(actual.fat, source.fat) &&
		MutationConfirmationValues.sameNullableNumber(actual.carbohydrate, source.carbohydrate)
	);
}
