import { describe, expect, it } from "vitest";
import { MealItemMutationService } from "../../../../src/api/dayPlan/MealItemMutationService.ts";
import type { DaySyncPayload, DayPlanSyncProvider } from "../../../../src/api/dayPlan/DayPlanSyncService.ts";

describe("MealItemMutationService.removeMealItems", () => {
	it("removes multiple product items across meals in a single day sync", async () => {
		const payload = createPayload({
			breakfast: [
				createProductItem({ itemId: "breakfast-1", productId: 101 }),
				createProductItem({ itemId: "breakfast-2", productId: 303, deletedAt: "2026-07-01 10:00:00" }),
			],
			lunch: [
				createProductItem({ itemId: "lunch-1", productId: 202 }),
				createRecipeItem({ itemId: "recipe-1", recipeId: 101 }),
			],
		});
		const syncService = new FakeDayPlanSyncService(payload);
		const service = new MealItemMutationService(syncService);

		const result = await service.removeMealItems({
			userId: "user-1",
			date: "2026-07-01",
			productIds: [101, 202, 303],
		});

		expect(result.operation).toBe("remove");
		expect(result.mealKey).toBeNull();
		expect(result.operationCount).toBe(2);
		expect(result.deletedItemIds).toEqual(["breakfast-1", "lunch-1"]);
		expect(result.acceptedItems).toMatchObject([
			{ itemId: "breakfast-1", productId: 101, foodType: "PRODUCT", mealKey: "breakfast" },
			{ itemId: "lunch-1", productId: 202, foodType: "PRODUCT", mealKey: "lunch" },
		]);
		expect(syncService.syncCalls).toHaveLength(1);
		expect(syncService.syncCalls[0]).toMatchObject({ userId: "user-1", date: "2026-07-01" });
		expect(syncService.item("breakfast", "breakfast-1")?.deletedAt).toBeTruthy();
		expect(syncService.item("lunch", "lunch-1")?.deletedAt).toBeTruthy();
		expect(syncService.item("breakfast", "breakfast-2")?.deletedAt).toBe("2026-07-01 10:00:00");
	});

	it("removes every active occurrence of a duplicated product id", async () => {
		const payload = createPayload({
			breakfast: [
				createProductItem({ itemId: "breakfast-1", productId: 101 }),
				createProductItem({ itemId: "breakfast-2", productId: 101 }),
			],
			lunch: [createProductItem({ itemId: "lunch-1", productId: 101 })],
		});
		const syncService = new FakeDayPlanSyncService(payload);
		const service = new MealItemMutationService(syncService);

		const result = await service.removeMealItems({
			userId: "user-1",
			date: "2026-07-01",
			productIds: [101],
		});

		expect(result.operationCount).toBe(3);
		expect(result.deletedItemIds).toEqual(["breakfast-1", "breakfast-2", "lunch-1"]);
		expect(syncService.syncCalls).toHaveLength(1);
	});

	it("fails when no active product id matches", async () => {
		const payload = createPayload({
			breakfast: [createProductItem({ itemId: "breakfast-1", productId: 101 })],
			lunch: [createProductItem({ itemId: "lunch-1", productId: 202, deletedAt: "2026-07-01 10:00:00" })],
		});
		const syncService = new FakeDayPlanSyncService(payload);
		const service = new MealItemMutationService(syncService);

		await expect(
			service.removeMealItems({
				userId: "user-1",
				date: "2026-07-01",
				productIds: [202, 303],
			}),
		).rejects.toThrow("Meal item not found");
		expect(syncService.syncCalls).toHaveLength(0);
	});
});

describe("MealItemMutationService.moveMealItem", () => {
	it("moves an item between days in one multi-day synchronization", async () => {
		const syncService = new MultiDaySyncService({
			"2026-07-01": createPayload({ breakfast: [createProductItem({ itemId: "item-1", productId: 101 })] }),
			"2026-07-02": createPayload({ lunch: [] }),
		});
		const service = new MealItemMutationService(syncService);

		const result = await service.moveMealItem({
			userId: "user-1",
			fromDate: "2026-07-01",
			fromMealKey: "breakfast",
			itemId: "item-1",
			toDate: "2026-07-02",
			toMealKey: "lunch",
		});

		expect(result.oldItemId).toBe("item-1");
		expect(result.newItemId).not.toBe("item-1");
		expect(syncService.syncDaysCalls).toHaveLength(1);
		expect(syncService.syncDaysCalls[0]?.userId).toBe("user-1");
		expect(Object.keys(syncService.syncDaysCalls[0]?.daysPayload ?? {})).toEqual(["2026-07-01", "2026-07-02"]);
		const syncedDays = syncService.syncDaysCalls[0]?.daysPayload as Record<string, DaySyncPayload>;
		expect(mealItems(syncedDays["2026-07-01"], "breakfast")[0]).toMatchObject({
			planDayDietItemId: "item-1",
			productId: 101,
		});
		expect(mealItems(syncedDays["2026-07-01"], "breakfast")[0]?.deletedAt).toBeTruthy();
		expect(mealItems(syncedDays["2026-07-02"], "lunch")[0]).toMatchObject({
			planDayDietItemId: result.newItemId,
			productId: 101,
		});
	});
});

class FakeDayPlanSyncService implements DayPlanSyncProvider {
	public readonly syncCalls: { readonly userId: string; readonly date: string; readonly payload: DaySyncPayload }[] =
		[];

	private payload: DaySyncPayload;

	public constructor(payload: DaySyncPayload) {
		this.payload = payload;
	}

	public async getDaySyncPayload(): Promise<DaySyncPayload> {
		return this.payload;
	}

	public async syncSingleDay(userId: string, date: string, payload: DaySyncPayload): Promise<void> {
		this.payload = payload;
		this.syncCalls.push({ userId, date, payload });
	}

	public async syncDays(): Promise<void> {
		throw new Error("Unexpected syncDays call");
	}

	public item(mealKey: string, itemId: string): Record<string, unknown> | null {
		const meal = this.payload.dietPlan[mealKey];
		if (!isRecord(meal) || !Array.isArray(meal.items)) {
			return null;
		}

		return meal.items.find((item) => isRecord(item) && item.planDayDietItemId === itemId) ?? null;
	}
}

class MultiDaySyncService implements DayPlanSyncProvider {
	public readonly syncDaysCalls: { userId: string; daysPayload: Record<string, unknown> }[] = [];

	public constructor(private readonly payloads: Record<string, DaySyncPayload>) {}

	public async getDaySyncPayload(_userId: string, date: string): Promise<DaySyncPayload> {
		const payload = this.payloads[date];
		if (!payload) throw new Error(`Missing payload for ${date}`);
		return payload;
	}

	public async syncSingleDay(): Promise<void> {
		throw new Error("Unexpected syncSingleDay call");
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<void> {
		this.syncDaysCalls.push({ userId, daysPayload });
	}
}

function createPayload(meals: Record<string, readonly Record<string, unknown>[]>): DaySyncPayload {
	return {
		dietPlan: Object.fromEntries(Object.entries(meals).map(([mealKey, items]) => [mealKey, { items: [...items] }])),
		toiletItems: [],
		note: null,
		tagsIds: [],
	};
}

function createProductItem(options: {
	readonly itemId: string;
	readonly productId: number;
	readonly deletedAt?: string;
}): Record<string, unknown> {
	return {
		planDayDietItemId: options.itemId,
		foodType: "PRODUCT",
		productId: options.productId,
		measureId: 1,
		measureQuantity: 100,
		deletedAt: options.deletedAt ?? null,
	};
}

function createRecipeItem(options: { readonly itemId: string; readonly recipeId: number }): Record<string, unknown> {
	return {
		planDayDietItemId: options.itemId,
		foodType: "RECIPE",
		productId: null,
		recipeId: options.recipeId,
		measureId: 1,
		measureQuantity: 1,
		deletedAt: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mealItems(payload: DaySyncPayload | undefined, mealKey: string): Record<string, unknown>[] {
	const meal = payload?.dietPlan[mealKey];
	return isRecord(meal) && Array.isArray(meal.items) ? meal.items.filter(isRecord) : [];
}
