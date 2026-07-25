import { DateUtils } from "../../shared/DateUtils.ts";
import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { AddMealItemsOptions } from "./AddMealItemsOptions.ts";
import { DayItemPayload } from "./DayItemPayload.ts";
import { DayPlanDietPlan } from "./DayPlanDietPlan.ts";
import { DayPlanError } from "./DayPlanError.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import { normalizeItemKind, normalizeMealKey } from "./DayPlanValidators.ts";
import { FoundDietItem } from "./FoundDietItem.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MoveMealItemOptions } from "./MoveMealItemOptions.ts";
import type { RemoveMealItemOptions } from "./RemoveMealItemOptions.ts";
import type { RemoveMealItemsOptions } from "./RemoveMealItemsOptions.ts";
import type { DayPlanSyncProvider } from "./DayPlanSyncService.ts";
import type { UpdateMealItemOptions } from "./UpdateMealItemOptions.ts";

export class MealItemMutationService {
	private readonly dayPlanSyncService: DayPlanSyncProvider;

	public constructor(dayPlanSyncService: DayPlanSyncProvider) {
		this.dayPlanSyncService = dayPlanSyncService;
	}

	public async addMealItems(
		options: AddMealItemsOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const date = DateUtils.validateIsoDate(options.date);
		const mealKey = normalizeMealKey(options.mealKey);

		if (options.items.length === 0) {
			throw new DayPlanError("items must not be empty");
		}

		const acceptedItems = options.items.map((item, index) => DayItemPayload.from(item, mealKey, index));
		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		new DayPlanDietPlan(dayPayload.dietPlan)
			.getMealItems(mealKey)
			.push(...acceptedItems.map(({ payload }) => payload));

		await this.dayPlanSyncService.syncSingleDay(options.userId, date, dayPayload);

		return MealItemMutationResult.acceptedAdd(
			date,
			mealKey,
			acceptedItems.map(({ summary }) => summary),
		);
	}

	public async updateMealItem(
		options: UpdateMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const date = DateUtils.validateIsoDate(options.date);
		const mealKey = normalizeMealKey(options.mealKey);
		const itemId = StringUtils.parseNonEmptyString(options.itemId, "itemId is required");

		if (options.measureQuantity === undefined && options.measureId === undefined && options.eaten === undefined) {
			throw new DayPlanError("Provide at least one update field");
		}

		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		const target = new DayPlanDietPlan(dayPayload.dietPlan).findItem(mealKey, itemId, true);
		if (!target) {
			throw new DayPlanError("Meal item not found");
		}

		if (options.measureQuantity !== undefined) {
			target.item.measureQuantity = NumberUtils.parsePositiveFiniteNumber(
				options.measureQuantity,
				"measureQuantity must be > 0",
			);
		}
		if (options.measureId !== undefined) {
			target.item.measureId = StringUtils.parseStringOrSafeInteger(options.measureId, "measureId is required");
		}
		if (options.eaten !== undefined) {
			target.item.eaten = options.eaten;
		}
		target.item.updatedAt = nowTimestamp();

		await this.dayPlanSyncService.syncSingleDay(options.userId, date, dayPayload);

		return MealItemMutationResult.acceptedUpdate(date, target.toOperationSummary(0, itemId));
	}

	public async removeMealItem(
		options: RemoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		normalizeMealKey(options.mealKey);
		normalizeItemKind(options.itemKind ?? "auto");
		const result = await this.removeMealItems({
			date: options.date,
			itemIds: [StringUtils.parseNonEmptyString(options.itemId, "itemId is required")],
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
		const date = DateUtils.validateIsoDate(options.date);
		const itemIds = normalizeItemIds(options.itemIds);
		const dayPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, date);
		const targets = new DayPlanDietPlan(dayPayload.dietPlan).findActiveItems(itemIds);

		const foundIds = new Set(targets.map(({ item }) => getRequiredItemId(item)));
		const missingIds = [...itemIds].filter((itemId) => !foundIds.has(itemId));
		if (missingIds.length > 0) {
			throw new DayPlanError(`Active meal items were not found: ${missingIds.join(", ")}`);
		}

		const deletedAt = nowTimestamp();
		for (const target of targets) {
			target.item.deletedAt = deletedAt;
			target.item.updatedAt = deletedAt;
			target.item.measureQuantity = 0.01;
			const targetId = getRequiredItemId(target.item);
			const requestedKind = normalizeItemKind(options.itemKinds?.[targetId] ?? "auto");
			const resolvedKind = requestedKind === "auto" ? target.resolveKind() : requestedKind;
			if (resolvedKind === "custom_recipe_item") {
				target.item.visible = false;
			}
		}

		await this.dayPlanSyncService.syncSingleDay(options.userId, date, dayPayload);

		const acceptedItems = targets.map((target, index) =>
			target.toOperationSummary(index, getRequiredItemId(target.item)),
		);

		return MealItemMutationResult.acceptedRemove(date, acceptedItems);
	}

	public async moveMealItem(
		options: MoveMealItemOptions & { readonly userId: string },
	): Promise<MealItemMutationResult> {
		const fromDate = DateUtils.validateIsoDate(options.fromDate);
		const toDate = DateUtils.validateIsoDate(options.toDate ?? options.fromDate);
		const fromMealKey = normalizeMealKey(options.fromMealKey);
		const toMealKey = normalizeMealKey(options.toMealKey ?? options.fromMealKey);
		const itemId = StringUtils.parseNonEmptyString(options.itemId, "itemId is required");
		const sourcePayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, fromDate);
		const sourceDietPlan = new DayPlanDietPlan(sourcePayload.dietPlan);
		const source = sourceDietPlan.findItem(fromMealKey, itemId, true);

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

			const targetPayload = await this.dayPlanSyncService.getDaySyncPayload(options.userId, toDate);
			destinationItems = new DayPlanDietPlan(targetPayload.dietPlan).getMealItems(toMealKey);
			destinationItems.push(newItem);
			daysPayload[toDate] = targetPayload;
		}

		await this.dayPlanSyncService.syncDays(options.userId, daysPayload);

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
		throw new DayPlanError("itemIds must not be empty");
	}
	const normalized = itemIds.map((itemId) => StringUtils.parseNonEmptyString(itemId, "itemId is required"));
	const unique = new Set(normalized);
	if (unique.size !== normalized.length) {
		throw new DayPlanError("itemIds must not contain duplicates");
	}
	return unique;
}

function getRequiredItemId(item: Record<string, unknown>): string {
	const itemId = item.planDayDietItemId;
	if (typeof itemId === "string" && itemId.trim()) {
		return itemId;
	}

	throw new DayPlanError("Meal item id was not available");
}
