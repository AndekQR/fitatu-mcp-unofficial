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
import { normalizeItemKind, normalizeMealKey } from "./DayPlanValidators.ts";
import { FoundDietItem } from "./FoundDietItem.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "./MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "./RemoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "./RemoveMealItemsOptions.ts";
import type { DayPlanSyncProvider } from "./DayPlanSyncProvider.ts";
import type { UpdateMealItemOptions } from "./UpdateMealItemOptions.ts";

export class MealItemMutationCoordinator {
	private readonly dayPlanSyncProvider: DayPlanSyncProvider;

	public constructor(dayPlanSyncProvider: DayPlanSyncProvider) {
		this.dayPlanSyncProvider = dayPlanSyncProvider;
	}

	public async addMealItems(
		options: AddMealItemsOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
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
		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(options.userId, date);
		new DayPlanDietPlan(dayPayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanAddItems)
			.getMealItems(mealKey)
			.push(...acceptedItems.map(({ payload }) => payload));

		await this.dayPlanSyncProvider.syncSingleDay(options.userId, date, dayPayload);

		return MealItemMutationResult.acceptedAdd(
			date,
			mealKey,
			acceptedItems.map(({ summary }) => summary),
		);
	}

	public async updateMealItem(
		options: UpdateMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const { date, mealKey, itemId, measureQuantity, measureId } = normalizeMutationInput(
			FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem,
			() => {
				if (
					options.measureQuantity === undefined &&
					options.measureId === undefined &&
					options.eaten === undefined
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
				};
			},
		);

		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(options.userId, date);
		const target = new DayPlanDietPlan(dayPayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem).findItem(
			mealKey,
			itemId,
			true,
		);
		if (!target) {
			throw invalidMutation("Meal item not found", FITATU_CLIENT_OPERATIONS.dayPlanUpdateItem);
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
		target.item.updatedAt = nowTimestamp();

		await this.dayPlanSyncProvider.syncSingleDay(options.userId, date, dayPayload);

		return MealItemMutationResult.acceptedUpdate(date, target.toOperationSummary(0, itemId));
	}

	public async removeMealItem(
		options: RemoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const itemId = normalizeMutationInput(FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem, () => {
			normalizeMealKey(options.mealKey, FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem);
			normalizeItemKind(options.itemKind ?? "auto", FITATU_CLIENT_OPERATIONS.dayPlanRemoveItem);
			return StringUtils.parseNonEmptyString(options.itemId, "itemId is required");
		});
		const result = await this.removeMealItems({
			date: options.date,
			itemIds: [itemId],
			itemKinds: { [options.itemId]: options.itemKind ?? "auto" },
			userId: options.userId,
		});
		return MealItemMutationResult.acceptedRemove(
			result.targetDate,
			result.acceptedItems,
			result.acceptedItems[0]?.mealKey ?? null,
		);
	}

	public async removeMealItems(
		options: RemoveMealItemsOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const { date, itemIds } = normalizeMutationInput(FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems, () => ({
			date: DateUtils.validateIsoDate(options.date),
			itemIds: normalizeItemIds(options.itemIds),
		}));
		const dayPayload = await this.dayPlanSyncProvider.getDaySyncPayload(options.userId, date);
		const targets = new DayPlanDietPlan(
			dayPayload.dietPlan,
			FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
		).findActiveItems(itemIds);

		const foundIds = new Set(targets.map(({ item }) => getRequiredItemId(item)));
		const missingIds = [...itemIds].filter((itemId) => !foundIds.has(itemId));
		if (missingIds.length > 0) {
			throw invalidMutation(
				`Active meal items were not found: ${missingIds.join(", ")}`,
				FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
			);
		}

		const deletedAt = nowTimestamp();
		for (const target of targets) {
			target.item.deletedAt = deletedAt;
			target.item.updatedAt = deletedAt;
			target.item.measureQuantity = 0.01;
			const targetId = getRequiredItemId(target.item);
			const requestedKind = normalizeItemKind(
				options.itemKinds?.[targetId] ?? "auto",
				FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems,
			);
			const resolvedKind = requestedKind === "auto" ? target.resolveKind() : requestedKind;
			if (resolvedKind === "custom_recipe_item") {
				target.item.visible = false;
			}
		}

		await this.dayPlanSyncProvider.syncSingleDay(options.userId, date, dayPayload);

		const acceptedItems = targets.map((target, index) =>
			target.toOperationSummary(index, getRequiredItemId(target.item)),
		);

		return MealItemMutationResult.acceptedRemove(date, acceptedItems);
	}

	public async moveMealItem(
		options: MoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const { fromDate, toDate, fromMealKey, toMealKey, itemId } = normalizeMutationInput(
			FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
			() => ({
				fromDate: DateUtils.validateIsoDate(options.fromDate),
				toDate: DateUtils.validateIsoDate(options.toDate ?? options.fromDate),
				fromMealKey: normalizeMealKey(options.fromMealKey, FITATU_CLIENT_OPERATIONS.dayPlanMoveItem),
				toMealKey: normalizeMealKey(
					options.toMealKey ?? options.fromMealKey,
					FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
				),
				itemId: StringUtils.parseNonEmptyString(options.itemId, "itemId is required"),
			}),
		);
		const sourcePayload = await this.dayPlanSyncProvider.getDaySyncPayload(options.userId, fromDate);
		const sourceDietPlan = new DayPlanDietPlan(sourcePayload.dietPlan, FITATU_CLIENT_OPERATIONS.dayPlanMoveItem);
		const source = sourceDietPlan.findItem(fromMealKey, itemId, true);

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

			const targetPayload = await this.dayPlanSyncProvider.getDaySyncPayload(options.userId, toDate);
			destinationItems = new DayPlanDietPlan(
				targetPayload.dietPlan,
				FITATU_CLIENT_OPERATIONS.dayPlanMoveItem,
			).getMealItems(toMealKey);
			destinationItems.push(newItem);
			daysPayload[toDate] = targetPayload;
		}

		await this.dayPlanSyncProvider.syncDays(options.userId, daysPayload);

		const acceptedItem = new FoundDietItem(
			toMealKey,
			newItem,
			destinationItems,
			destinationItems.length - 1,
		).toOperationSummary(0, newItemId);
		return MealItemMutationResult.acceptedMove(fromDate, fromMealKey, itemId, acceptedItem);
	}
}

function normalizeItemIds(itemIds: readonly string[]): ReadonlySet<string> {
	if (itemIds.length === 0) {
		throw invalidMutation("itemIds must not be empty", FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems);
	}
	const normalized = itemIds.map((itemId) => StringUtils.parseNonEmptyString(itemId, "itemId is required"));
	const unique = new Set(normalized);
	if (unique.size !== normalized.length) {
		throw invalidMutation("itemIds must not contain duplicates", FITATU_CLIENT_OPERATIONS.dayPlanRemoveItems);
	}
	return unique;
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
