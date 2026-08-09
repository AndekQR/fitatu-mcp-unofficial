import { DateUtils } from "../../shared/DateUtils.ts";
import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import type { AddMealItemsOptions } from "./AddMealItemsOptions.ts";
import { DayItemPayload } from "./DayItemPayload.ts";
import { DayPlanDietPlan } from "./DayPlanDietPlan.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import { normalizeMealKey } from "./DayPlanValidators.ts";
import { FoundDietItem } from "./FoundDietItem.ts";
import { MealItemRemovalTarget } from "./MealItemRemovalTarget.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "./MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "./RemoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "./RemoveMealItemsOptions.ts";
import type { DayPlanSyncProvider } from "./DayPlanSyncProvider.ts";
import type { UpdateMealItemOptions } from "./UpdateMealItemOptions.ts";

export class MealItemMutationCoordinator {
	private readonly dayPlanSyncProvider: DayPlanSyncProvider;

	public constructor(dayPlanSyncProvider: DayPlanSyncProvider) {
		this.dayPlanSyncProvider = dayPlanSyncProvider;
	}

	public async addMealItems(options: AddMealItemsOptions): Promise<MealItemMutationResult> {
		const userId = requireUserId(options.userId, FITATU_CLIENT_OPERATIONS.dayPlanAddItems);
		const { date, mealKey, acceptedItems } = normalizeMutationInput(
			FITATU_CLIENT_OPERATIONS.dayPlanAddItems,
			() => {
				const normalizedDate = DateUtils.validateIsoDate(options.date);
				const normalizedMealKey = normalizeMealKey(options.mealKey, FITATU_CLIENT_OPERATIONS.dayPlanAddItems);
				if (options.items.length === 0) {
					throw invalidMutation("items must not be empty", FITATU_CLIENT_OPERATIONS.dayPlanAddItems);
				}
				return {
					date: normalizedDate,
					mealKey: normalizedMealKey,
					acceptedItems: options.items.map((item, index) =>
						DayItemPayload.from(item, normalizedMealKey, index),
					),
				};
			},
		);
		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(userId, date);
		new DayPlanDietPlan(dayPayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanAddItems)
			.getMealItems(mealKey)
			.push(...acceptedItems.map(({ payload }) => payload));

		const dayRevisions = await this.dayPlanSyncProvider.syncSingleDay(userId, date, dayPayload);

		return MealItemMutationResult.acceptedAdd(
			date,
			mealKey,
			acceptedItems.map(({ summary }) => summary),
			dayRevisions,
		);
	}

	public async updateMealItem(options: UpdateMealItemOptions): Promise<MealItemMutationResult> {
		const userId = requireUserId(options.userId, FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem);
		const { date, mealKey, itemId, measureQuantity, measureId, name, nutrition } = normalizeMutationInput(
			FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem,
			() => {
				if (
					options.measureQuantity === undefined &&
					options.measureId === undefined &&
					options.eaten === undefined &&
					options.name === undefined &&
					options.energyKcal === undefined &&
					options.proteinG === undefined &&
					options.fatG === undefined &&
					options.carbohydrateG === undefined
				) {
					throw invalidMutation(
						"Provide at least one update field",
						FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem,
					);
				}
				return {
					date: DateUtils.validateIsoDate(options.date),
					mealKey: normalizeMealKey(options.mealKey, FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem),
					itemId: StringUtils.parseNonEmptyString(options.itemId, "itemId is required"),
					measureQuantity:
						options.measureQuantity === undefined
							? undefined
							: NumberUtils.parsePositiveFiniteNumber(
									options.measureQuantity,
									"measureQuantity must be > 0",
								),
					measureId:
						options.measureId === undefined
							? undefined
							: StringUtils.parseStringOrSafeInteger(options.measureId, "measureId is required"),
					name:
						options.name === undefined
							? undefined
							: StringUtils.parseNonEmptyString(options.name, "name must not be empty"),
					nutrition: {
						energy:
							options.energyKcal === undefined
								? undefined
								: NumberUtils.parseNonNegativeFiniteNumber(
										options.energyKcal,
										"energyKcal must be a non-negative finite number",
									),
						protein:
							options.proteinG === undefined
								? undefined
								: NumberUtils.parseNonNegativeFiniteNumber(
										options.proteinG,
										"proteinG must be a non-negative finite number",
									),
						fat:
							options.fatG === undefined
								? undefined
								: NumberUtils.parseNonNegativeFiniteNumber(
										options.fatG,
										"fatG must be a non-negative finite number",
									),
						carbohydrate:
							options.carbohydrateG === undefined
								? undefined
								: NumberUtils.parseNonNegativeFiniteNumber(
										options.carbohydrateG,
										"carbohydrateG must be a non-negative finite number",
									),
					},
				};
			},
		);

		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(userId, date);
		const target = new DayPlanDietPlan(dayPayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem).findItem(
			mealKey,
			itemId,
			false,
		);
		if (!target) {
			throw invalidMutation("Meal item not found", FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem);
		}
		const hasCustomItemUpdate = name !== undefined || Object.values(nutrition).some((value) => value !== undefined);
		const targetFoodType =
			typeof target.item.foodType === "string" ? target.item.foodType.trim().toUpperCase() : "";
		if (hasCustomItemUpdate && targetFoodType !== "CUSTOM_ITEM") {
			throw invalidMutation(
				"Custom name and nutrition fields can only be updated for CUSTOM_ITEM",
				FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem,
			);
		}

		if (measureQuantity !== undefined) {
			target.item.measureQuantity = measureQuantity;
		}
		if (measureId !== undefined) {
			target.item.measureId = measureId;
		}
		if (options.eaten !== undefined) {
			target.item.eaten = options.eaten;
		}
		if (name !== undefined) {
			target.item.name = name;
		}
		for (const [field, value] of Object.entries(nutrition)) {
			if (value !== undefined) {
				target.item[field] = value;
			}
		}
		target.item.updatedAt = nowTimestamp();

		const dayRevisions = await this.dayPlanSyncProvider.syncSingleDay(userId, date, dayPayload);

		return MealItemMutationResult.acceptedUpdate(date, target.toOperationSummary(0, itemId), dayRevisions);
	}

	public async removeMealItem(options: RemoveMealItemOptions): Promise<MealItemMutationResult> {
		const userId = requireUserId(options.userId, FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem);
		const target = normalizeMutationInput(FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem, () => {
			const mealKey = normalizeMealKey(options.mealKey, FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem);
			const itemId = StringUtils.parseNonEmptyString(options.itemId, "itemId is required");
			return new MealItemRemovalTarget(mealKey, itemId);
		});
		const result = await this.removeMealItems(new RemoveMealItemsOptions(options.date, [target], userId));
		return MealItemMutationResult.acceptedRemove(
			result.targetDate,
			result.acceptedItems,
			result.acceptedItems[0]?.mealKey ?? null,
			result.dayRevisions,
		);
	}

	public async removeMealItems(options: RemoveMealItemsOptions): Promise<MealItemMutationResult> {
		const userId = requireUserId(options.userId, FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems);
		const { date, items } = normalizeMutationInput(FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems, () => ({
			date: DateUtils.validateIsoDate(options.date),
			items: normalizeRemovalTargets(options.items),
		}));
		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(userId, date);
		const targets = new DayPlanDietPlan(
			dayPayload.dietPlan,
			FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
		).findActiveItems(items);

		if (targets.length !== items.length) {
			throw invalidMutation(
				"Active meal items were not found in every requested meal context",
				FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
			);
		}

		const deletedAt = nowTimestamp();
		for (const target of targets) {
			target.item.deletedAt = deletedAt;
		}

		const dayRevisions = await this.dayPlanSyncProvider.syncSingleDay(userId, date, dayPayload);

		const acceptedItems = targets.map((target, index) =>
			target.toOperationSummary(index, getRequiredItemId(target.item)),
		);

		return MealItemMutationResult.acceptedRemove(date, acceptedItems, null, dayRevisions);
	}

	public async moveMealItem(options: MoveMealItemOptions): Promise<MealItemMutationResult> {
		const userId = requireUserId(options.userId, FITATU_CLIENT_OPERATIONS.dayPlanMoveItem);
		const { fromDate, toDate, fromMealKey, toMealKey, itemId } = normalizeMutationInput(
			FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
			() => {
				const fromDate = DateUtils.validateIsoDate(options.fromDate);
				const toDate = DateUtils.validateIsoDate(options.toDate ?? options.fromDate);
				const fromMealKey = normalizeMealKey(options.fromMealKey, FITATU_CLIENT_OPERATIONS.dayPlanMoveItem);
				const toMealKey = normalizeMealKey(
					options.toMealKey ?? options.fromMealKey,
					FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
				);
				if (fromDate === toDate && fromMealKey === toMealKey) {
					throw invalidMutation(
						"Move destination must differ from its source",
						FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
					);
				}
				return {
					fromDate,
					toDate,
					fromMealKey,
					toMealKey,
					itemId: StringUtils.parseNonEmptyString(options.itemId, "itemId is required"),
				};
			},
		);
		const sourcePayload = await this.dayPlanSyncProvider.getDaySyncPayload(userId, fromDate);
		const sourceDietPlan = new DayPlanDietPlan(sourcePayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanMoveItem);
		const source = sourceDietPlan.findItem(fromMealKey, itemId, false);

		if (!source) {
			throw invalidMutation("Meal item not found", FITATU_CLIENT_OPERATIONS.dayPlanMoveItem);
		}

		const newItemId = createPlanDayDietItemId();
		const newItem: Record<string, unknown> = {
			...source.item,
			planDayDietItemId: newItemId,
			mealType: toMealKey,
			updatedAt: nowTimestamp(),
		};
		delete newItem.deletedAt;

		const deleteMarker = source.createDeletedMarker();
		const daysPayload: Record<string, unknown> = {};
		let destinationItems: Record<string, unknown>[];

		if (toDate === fromDate) {
			source.items.splice(source.index, 1, deleteMarker);
			destinationItems = sourceDietPlan.getMealItems(toMealKey);
			destinationItems.push(newItem);
			daysPayload[fromDate] = sourcePayload;
		} else {
			source.items.splice(source.index, 1, deleteMarker);
			daysPayload[fromDate] = sourcePayload;

			const targetPayload = await this.dayPlanSyncProvider.getDaySyncPayload(userId, toDate);
			destinationItems = new DayPlanDietPlan(
				targetPayload.dietPlan,
				FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
			).getMealItems(toMealKey);
			destinationItems.push(newItem);
			daysPayload[toDate] = targetPayload;
		}

		const dayRevisions = await this.dayPlanSyncProvider.syncDays(userId, daysPayload);

		const acceptedItem = new FoundDietItem(
			toMealKey,
			newItem,
			destinationItems,
			destinationItems.length - 1,
		).toOperationSummary(0, newItemId);
		return MealItemMutationResult.acceptedMove(fromDate, fromMealKey, itemId, acceptedItem, dayRevisions);
	}
}

function normalizeRemovalTargets(items: readonly MealItemRemovalTarget[]): readonly MealItemRemovalTarget[] {
	if (items.length === 0) {
		throw invalidMutation("items must not be empty", FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems);
	}
	const normalized = items.map(
		(item) =>
			new MealItemRemovalTarget(
				normalizeMealKey(item.mealKey, FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems),
				StringUtils.parseNonEmptyString(item.itemId, "itemId is required"),
			),
	);
	const unique = new Set(normalized.map((item) => `${item.mealKey}\u0000${item.itemId}`));
	if (unique.size !== normalized.length) {
		throw invalidMutation("items must not contain duplicate targets", FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems);
	}
	return normalized;
}

function getRequiredItemId(item: Record<string, unknown>): string {
	const itemId = item.planDayDietItemId;
	if (typeof itemId === "string" && itemId.trim()) {
		return itemId;
	}

	throw FitatuClientError.invalidResponse({
		operation: FITATU_CLIENT_OPERATIONS.dayPlanSync,
		message: "Meal item id was not available",
		method: "GET",
		endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
	});
}

function requireUserId(
	userId: string | undefined,
	operation:
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanAddItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
): string {
	const normalizedUserId = StringUtils.stringOrNull(userId);
	if (normalizedUserId === null) {
		throw invalidMutation("userId is required", operation);
	}
	return normalizedUserId;
}

function invalidMutation(
	message: string,
	operation:
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanAddItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
): FitatuClientError {
	return FitatuClientError.invalidRequest({ operation, message });
}

function normalizeMutationInput<T>(
	operation:
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanAddItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems
		| typeof FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
	normalize: () => T,
): T {
	try {
		return normalize();
	} catch (error) {
		if (error instanceof FitatuClientError) {
			throw error;
		}
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw invalidMutation(error.message, operation);
	}
}
