import {
	createDeletedItemMarker,
	findItemInDietPlan,
	getMealItems,
	resolveItemKind,
	toOperationSummary,
} from "./DayPlanDietPlanMapper.ts";
import { DayPlanError } from "./DayPlanError.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import type {
	AddMealItemsOptions,
	MoveMealItemOptions,
	RemoveMealItemOptions,
	UpdateMealItemOptions,
} from "./DayPlanClientTypes.ts";
import {
	normalizeDate,
	normalizeId,
	normalizeItemKind,
	normalizeMealKey,
	normalizePositiveNumber,
	normalizeRequiredText,
} from "./DayPlanValidators.ts";
import type { MealItemMutationResult } from "./MealItemMutation.ts";
import { toDayItemPayload } from "./MealItemPayloadMapper.ts";
import type { DayPlanSyncService } from "./DayPlanSyncService.ts";

export class MealItemMutationService {
	private readonly dayPlanSyncService: DayPlanSyncService;

	public constructor(dayPlanSyncService: DayPlanSyncService) {
		this.dayPlanSyncService = dayPlanSyncService;
	}

	public async addMealItems(
		options: AddMealItemsOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const date = normalizeDate(options.date);
		const mealKey = normalizeMealKey(options.mealKey);

		if (options.items.length === 0) {
			throw new DayPlanError("items must not be empty");
		}

		const acceptedItems = options.items.map((item, index) => toDayItemPayload(item, mealKey, index));
		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		getMealItems(dayPayload.dietPlan, mealKey).push(...acceptedItems.map(({ payload }) => payload));

		await this.dayPlanSyncService.syncSingleDay(
			options.userId,
			date,
			dayPayload,
			"Fitatu add meal items request failed",
		);

		return {
			status: "accepted",
			operation: "add",
			message: "Meal item add request accepted by Fitatu.",
			targetDate: date,
			mealKey,
			operationCount: acceptedItems.length,
			acceptedItems: acceptedItems.map(({ summary }) => summary),
			createdItemIds: acceptedItems.map(({ summary }) => summary.itemId),
			updatedItemIds: [],
			deletedItemIds: [],
			oldItemId: null,
			newItemId: null,
			itemIdChanged: false,
		};
	}

	public async updateMealItem(
		options: UpdateMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const date = normalizeDate(options.date);
		const mealKey = normalizeMealKey(options.mealKey);
		const itemId = normalizeRequiredText(options.itemId, "itemId");

		if (options.measureQuantity === undefined && options.measureId === undefined && options.eaten === undefined) {
			throw new DayPlanError("Provide at least one update field");
		}

		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		const target = findItemInDietPlan(dayPayload.dietPlan, mealKey, itemId, true);
		if (!target) {
			throw new DayPlanError("Meal item not found");
		}

		if (options.measureQuantity !== undefined) {
			target.item.measureQuantity = normalizePositiveNumber(options.measureQuantity, "measureQuantity");
		}
		if (options.measureId !== undefined) {
			target.item.measureId = normalizeId(options.measureId, "measureId");
		}
		if (options.eaten !== undefined) {
			target.item.eaten = options.eaten;
		}
		target.item.updatedAt = nowTimestamp();

		await this.dayPlanSyncService.syncSingleDay(
			options.userId,
			date,
			dayPayload,
			"Fitatu update meal item request failed",
		);

		return {
			status: "accepted",
			operation: "update",
			message: "Meal item update request accepted by Fitatu.",
			targetDate: date,
			mealKey: target.mealKey,
			operationCount: 1,
			acceptedItems: [
				toOperationSummary({
					index: 0,
					item: target.item,
					itemId,
					mealKey: target.mealKey,
				}),
			],
			createdItemIds: [],
			updatedItemIds: [itemId],
			deletedItemIds: [],
			oldItemId: null,
			newItemId: null,
			itemIdChanged: false,
		};
	}

	public async removeMealItem(
		options: RemoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const date = normalizeDate(options.date);
		const mealKey = normalizeMealKey(options.mealKey);
		const itemId = normalizeRequiredText(options.itemId, "itemId");
		const itemKind = normalizeItemKind(options.itemKind ?? "auto");
		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		const target = findItemInDietPlan(dayPayload.dietPlan, mealKey, itemId, true);

		if (!target) {
			throw new DayPlanError("Meal item not found");
		}

		const resolvedKind = itemKind === "auto" ? resolveItemKind(target.item) : itemKind;
		target.item.deletedAt = nowTimestamp();
		target.item.updatedAt = nowTimestamp();
		target.item.measureQuantity = 0.01;
		if (resolvedKind === "custom_recipe_item") {
			target.item.visible = false;
		}

		await this.dayPlanSyncService.syncSingleDay(
			options.userId,
			date,
			dayPayload,
			"Fitatu remove meal item request failed",
		);

		return {
			status: "accepted",
			operation: "remove",
			message: "Meal item remove request accepted by Fitatu.",
			targetDate: date,
			mealKey: target.mealKey,
			operationCount: 1,
			acceptedItems: [
				toOperationSummary({
					index: 0,
					item: target.item,
					itemId,
					mealKey: target.mealKey,
				}),
			],
			createdItemIds: [],
			updatedItemIds: [],
			deletedItemIds: [itemId],
			oldItemId: null,
			newItemId: null,
			itemIdChanged: false,
		};
	}

	public async moveMealItem(
		options: MoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const fromDate = normalizeDate(options.fromDate);
		const toDate = normalizeDate(options.toDate ?? options.fromDate);
		const fromMealKey = normalizeMealKey(options.fromMealKey);
		const toMealKey = normalizeMealKey(options.toMealKey ?? options.fromMealKey);
		const itemId = normalizeRequiredText(options.itemId, "itemId");
		const sourcePayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, fromDate);
		const source = findItemInDietPlan(sourcePayload.dietPlan, fromMealKey, itemId, true);

		if (!source) {
			throw new DayPlanError("Meal item not found");
		}

		const newItemId = createPlanDayDietItemId();
		const newItem: Record<string, unknown> = {
			...source.item,
			planDayDietItemId: newItemId,
			updatedAt: nowTimestamp(),
		};
		delete newItem.deletedAt;

		const deleteMarker = createDeletedItemMarker(source.item);
		const daysPayload: Record<string, unknown> = {};

		if (toDate === fromDate) {
			source.items.splice(source.index, 1, deleteMarker);
			getMealItems(sourcePayload.dietPlan, toMealKey).push(newItem);
			daysPayload[fromDate] = sourcePayload;
		} else {
			source.items.splice(source.index, 1, deleteMarker);
			daysPayload[fromDate] = sourcePayload;

			const targetPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, toDate);
			getMealItems(targetPayload.dietPlan, toMealKey).push(newItem);
			daysPayload[toDate] = targetPayload;
		}

		await this.dayPlanSyncService.syncDays(options.userId, daysPayload, "Fitatu move meal item request failed");

		return {
			status: "accepted",
			operation: "move",
			message: "Meal item move request accepted by Fitatu.",
			targetDate: fromDate,
			mealKey: fromMealKey,
			operationCount: 1,
			acceptedItems: [
				toOperationSummary({
					index: 0,
					item: newItem,
					itemId: newItemId,
					mealKey: toMealKey,
				}),
			],
			createdItemIds: [newItemId],
			updatedItemIds: [],
			deletedItemIds: [itemId],
			oldItemId: itemId,
			newItemId,
			itemIdChanged: true,
		};
	}
}
