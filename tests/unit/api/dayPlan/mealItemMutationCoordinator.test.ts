import { describe, expect, it } from "vitest";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import { MealItemMutationCoordinator } from "../../../../src/api/dayPlan/MealItemMutationCoordinator.ts";
import type { MealItemInput } from "../../../../src/api/dayPlan/MealItemInput.ts";
import type { DayPlanSyncProvider } from "../../../../src/api/dayPlan/DayPlanSyncProvider.ts";
import type { DaySyncPayload } from "../../../../src/api/dayPlan/DaySyncPayload.ts";

describe("MealItemMutationCoordinator single-day mutations", () => {
	it("adds a product item and synchronizes the changed day", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ breakfast: [] }));
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.addMealItems({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "breakfast",
			items: [{ productId: "101", foodType: "PRODUCT", measureId: "1", measureQuantity: 2, eaten: true }],
		});

		expect(result).toMatchObject({ operation: "add", operationCount: 1, itemIdChanged: false });
		expect(result.dayRevisions).toBeInstanceOf(DayRevisions);
		expect(result.dayRevisions.toRecord()).toEqual({ "2026-07-01": "revision-2026-07-01" });
		expect(result.provisionalItemIds).toHaveLength(1);
		expect(syncService.syncCalls).toHaveLength(1);
		expect(mealItems(syncService.currentPayload, "breakfast")[0]).toMatchObject({
			productId: 101,
			measureId: 1,
			measureQuantity: 2,
			eaten: true,
		});
	});

	it("adds an item to the exact trimmed custom meal key", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ Dinner: [] }));
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.addMealItems({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "  Dinner  ",
			items: [{ productId: "101", foodType: "PRODUCT", measureId: "1" }],
		});

		expect(result).toMatchObject({ operation: "add", operationCount: 1, mealKey: "Dinner" });
		expect(mealItems(syncService.currentPayload, "Dinner")[0]).toMatchObject({ productId: 101 });
	});

	it("rejects a blank meal key before reading or synchronizing the day plan", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ breakfast: [] }));
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.addMealItems({
				userId: "user-1",
				date: "2026-07-01",
				mealKey: "   ",
				items: [{ productId: "101", foodType: "PRODUCT", measureId: "1" }],
			}),
		).rejects.toMatchObject({
			message: "mealKey is required",
			failure: { kind: "invalidRequest" },
		});
		expect(syncService.getPayloadCalls).toHaveLength(0);
		expect(syncService.syncCalls).toHaveLength(0);
		expect(syncService.syncDaysCalls).toHaveLength(0);
	});

	it("rejects a recipe item without recipeId instead of aliasing productId", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ supper: [] }));
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.addMealItems({
				userId: "user-1",
				date: "2026-07-01",
				mealKey: "supper",
				items: [{ productId: "101", foodType: "RECIPE", measureId: "39" } as unknown as MealItemInput],
			}),
		).rejects.toThrow("recipeId is required");
		expect(syncService.syncCalls).toHaveLength(0);
	});

	it("adds a custom item with hidden Fitatu measure fields", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ supper: [] }));
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.addMealItems({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "supper",
			items: [
				{
					foodType: "CUSTOM_ITEM",
					name: "Kanapka na oko",
					energyKcal: 450,
					proteinG: 25,
					fatG: 18,
					carbohydrateG: 45,
					eaten: true,
				},
			],
		});

		expect(result.acceptedItems).toMatchObject([
			{
				productId: null,
				recipeId: null,
				foodType: "CUSTOM_ITEM",
				mealKey: "supper",
			},
		]);
		expect(mealItems(syncService.currentPayload, "supper")[0]).toMatchObject({
			foodType: "CUSTOM_ITEM",
			name: "Kanapka na oko",
			energy: 450,
			protein: 25,
			fat: 18,
			carbohydrate: 45,
			measureId: 1,
			measureQuantity: 100,
			measureWeight: 100,
			measureCapacity: 0,
			source: "API",
			eaten: true,
		});
		expect(mealItems(syncService.currentPayload, "supper")[0]).not.toHaveProperty("productId");
		expect(mealItems(syncService.currentPayload, "supper")[0]).not.toHaveProperty("recipeId");
	});

	it("updates only the requested fields of an active item", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(
			createPayload({ breakfast: [createProductItem({ itemId: "item-1", productId: 101 })] }),
		);
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.updateMealItem({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "breakfast",
			itemId: "item-1",
			measureQuantity: 2.5,
			eaten: true,
		});

		expect(result.updatedItemIds).toEqual(["item-1"]);
		expect(syncService.item("breakfast", "item-1")).toMatchObject({
			productId: 101,
			measureId: 1,
			measureQuantity: 2.5,
			eaten: true,
		});
	});

	it("updates only requested custom-item fields while preserving its identity and remaining row", async () => {
		const customItem = createCustomItem({ itemId: "custom-1" });
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ supper: [customItem] }));
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.updateMealItem({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "supper",
			itemId: "custom-1",
			name: " Corrected snack ",
			energyKcal: 0,
			proteinG: 13,
		});

		expect(result).toMatchObject({ updatedItemIds: ["custom-1"], itemIdChanged: false });
		expect(syncService.item("supper", "custom-1")).toMatchObject({
			...customItem,
			name: "Corrected snack",
			energy: 0,
			protein: 13,
			fat: 9,
			carbohydrate: 42,
			updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /),
		});
	});

	it.each([
		{ foodType: "PRODUCT", item: createProductItem({ itemId: "item-1", productId: 101 }) },
		{ foodType: "RECIPE", item: createRecipeItem({ itemId: "item-1", recipeId: 501 }) },
	])("rejects custom nutrition updates for a $foodType item before synchronizing", async ({ item }) => {
		const syncService = new RecordingDayPlanSyncCoordinator(createPayload({ breakfast: [item] }));
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.updateMealItem({
				userId: "user-1",
				date: "2026-07-01",
				mealKey: "breakfast",
				itemId: "item-1",
				energyKcal: 250,
			}),
		).rejects.toThrow("Custom name and nutrition fields can only be updated for CUSTOM_ITEM");
		expect(syncService.syncCalls).toHaveLength(0);
	});

	it("removes a recipe by adding only the current Fitatu deletedAt marker", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(
			createPayload({ breakfast: [createRecipeItem({ itemId: "recipe-1", recipeId: 501 })] }),
		);
		const service = new MealItemMutationCoordinator(syncService);
		const itemBefore = structuredClone(syncService.item("breakfast", "recipe-1"));

		const result = await service.removeMealItem({
			userId: "user-1",
			date: "2026-07-01",
			mealKey: "breakfast",
			itemId: "recipe-1",
		});

		expect(result.deletedItemIds).toEqual(["recipe-1"]);
		const itemAfter = syncService.item("breakfast", "recipe-1");
		expect(itemAfter?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		expect(itemAfter).toEqual({ ...itemBefore, deletedAt: itemAfter?.deletedAt });
		expect(itemAfter).not.toHaveProperty("updatedAt");
		expect(itemAfter).not.toHaveProperty("visible");
		expect(result.dayRevisions).toBeInstanceOf(DayRevisions);
		expect(result.dayRevisions.toRecord()).toEqual({ "2026-07-01": "revision-2026-07-01" });
	});

	it("rejects an update without changes before synchronizing", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(
			createPayload({ breakfast: [createProductItem({ itemId: "item-1", productId: 101 })] }),
		);
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.updateMealItem({
				userId: "user-1",
				date: "2026-07-01",
				mealKey: "breakfast",
				itemId: "item-1",
			}),
		).rejects.toThrow("Provide at least one update field");
		expect(syncService.syncCalls).toHaveLength(0);
	});

	it("does not resolve an item by its productId", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(
			createPayload({ breakfast: [createProductItem({ itemId: "item-1", productId: 101 })] }),
		);
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.updateMealItem({
				date: "2026-07-01",
				mealKey: "breakfast",
				itemId: "101",
				eaten: true,
				userId: "user-1",
			}),
		).rejects.toThrow("Meal item not found");
		expect(syncService.syncCalls).toHaveLength(0);
	});

	it("does not resolve an item outside the exact meal context", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator(
			createPayload({
				breakfast: [],
				second_breakfast: [createProductItem({ itemId: "item-1", productId: 101 })],
			}),
		);
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.updateMealItem({
				date: "2026-07-01",
				mealKey: "breakfast",
				itemId: "item-1",
				eaten: true,
				userId: "user-1",
			}),
		).rejects.toThrow("Meal item not found");
		expect(syncService.item("second_breakfast", "item-1")).toMatchObject({ eaten: false });
		expect(syncService.syncCalls).toHaveLength(0);
	});
});

describe("MealItemMutationCoordinator.removeMealItems", () => {
	it("removes exact product and recipe items across meals in a single day sync", async () => {
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
		const syncService = new RecordingDayPlanSyncCoordinator(payload, 60);
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.removeMealItems({
			userId: "user-1",
			date: "2026-07-01",
			items: [
				{ mealKey: "breakfast", itemId: "breakfast-1" },
				{ mealKey: "lunch", itemId: "lunch-1" },
				{ mealKey: "lunch", itemId: "recipe-1" },
			],
		});
		expect(result).toMatchObject({
			operation: "remove",
			operationCount: 3,
		});

		expect(result.operation).toBe("remove");
		expect(result.mealKey).toBeNull();
		expect(result.operationCount).toBe(3);
		expect(result.deletedItemIds).toEqual(["breakfast-1", "lunch-1", "recipe-1"]);
		expect(result.acceptedItems).toMatchObject([
			{ itemId: "breakfast-1", productId: 101, foodType: "PRODUCT", mealKey: "breakfast" },
			{ itemId: "lunch-1", productId: 202, foodType: "PRODUCT", mealKey: "lunch" },
			{ itemId: "recipe-1", recipeId: 101, foodType: "RECIPE", mealKey: "lunch" },
		]);
		expect(syncService.syncCalls).toHaveLength(1);
		expect(syncService.syncCalls[0]).toMatchObject({ userId: "user-1", date: "2026-07-01" });
		expect(syncService.getPayloadCalls).toHaveLength(1);
		expect(syncService.item("breakfast", "breakfast-1")?.deletedAt).toBeTruthy();
		expect(syncService.item("lunch", "lunch-1")?.deletedAt).toBeTruthy();
		expect(syncService.item("breakfast", "breakfast-2")?.deletedAt).toBe("2026-07-01 10:00:00");
	});

	it("removes only the exact selected duplicate entries", async () => {
		const payload = createPayload({
			breakfast: [
				createProductItem({ itemId: "breakfast-1", productId: 101 }),
				createProductItem({ itemId: "breakfast-2", productId: 101 }),
			],
			lunch: [createProductItem({ itemId: "lunch-1", productId: 101 })],
		});
		const syncService = new RecordingDayPlanSyncCoordinator(payload);
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.removeMealItems({
			userId: "user-1",
			date: "2026-07-01",
			items: [{ mealKey: "breakfast", itemId: "breakfast-2" }],
		});

		expect(result.operationCount).toBe(1);
		expect(result.deletedItemIds).toEqual(["breakfast-2"]);
		expect(syncService.syncCalls).toHaveLength(1);
	});

	it("fails atomically when any requested item is missing, inactive, or outside its meal context", async () => {
		const payload = createPayload({
			breakfast: [createProductItem({ itemId: "breakfast-1", productId: 101 })],
			lunch: [createProductItem({ itemId: "lunch-1", productId: 202, deletedAt: "2026-07-01 10:00:00" })],
		});
		const syncService = new RecordingDayPlanSyncCoordinator(payload);
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.removeMealItems({
				userId: "user-1",
				date: "2026-07-01",
				items: [
					{ mealKey: "breakfast", itemId: "breakfast-1" },
					{ mealKey: "breakfast", itemId: "lunch-1" },
					{ mealKey: "lunch", itemId: "missing-1" },
				],
			}),
		).rejects.toThrow("Active meal items were not found");
		expect(syncService.item("breakfast", "breakfast-1")?.deletedAt).toBeNull();
		expect(syncService.syncCalls).toHaveLength(0);
	});
});

describe("MealItemMutationCoordinator.moveMealItem", () => {
	it("moves an item between meals in one day payload", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator({
			"2026-07-01": createPayload({
				breakfast: [createProductItem({ itemId: "item-1", productId: 101 })],
				lunch: [],
			}),
		});
		const service = new MealItemMutationCoordinator(syncService);

		const result = await service.moveMealItem({
			userId: "user-1",
			fromDate: "2026-07-01",
			fromMealKey: "breakfast",
			itemId: "item-1",
			toMealKey: "lunch",
		});

		const syncedDay = syncService.syncDaysCalls[0]?.daysPayload["2026-07-01"] as DaySyncPayload;
		expect(Object.keys(syncService.syncDaysCalls[0]?.daysPayload ?? {})).toEqual(["2026-07-01"]);
		expect(mealItems(syncedDay, "breakfast")[0]).toMatchObject({ planDayDietItemId: "item-1" });
		expect(mealItems(syncedDay, "breakfast")[0]?.deletedAt).toBeTruthy();
		expect(mealItems(syncedDay, "lunch")[0]).toMatchObject({
			planDayDietItemId: result.newItemId,
			productId: 101,
			mealType: "lunch",
		});
	});

	it("moves an item between days in one multi-day synchronization", async () => {
		const syncService = new RecordingDayPlanSyncCoordinator({
			"2026-07-01": createPayload({ breakfast: [createProductItem({ itemId: "item-1", productId: 101 })] }),
			"2026-07-02": createPayload({ lunch: [] }),
		});
		const service = new MealItemMutationCoordinator(syncService);

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
			mealType: "lunch",
		});
	});

	it.each([
		{ name: "without a destination", options: {} },
		{ name: "to the same date", options: { toDate: "2026-07-01" } },
		{ name: "to the same meal", options: { toMealKey: "breakfast" } },
	])("rejects a move $name without replacing the item", async ({ options }) => {
		const syncService = new RecordingDayPlanSyncCoordinator({
			"2026-07-01": createPayload({
				breakfast: [createProductItem({ itemId: "item-1", productId: 101 })],
			}),
		});
		const service = new MealItemMutationCoordinator(syncService);

		await expect(
			service.moveMealItem({
				userId: "user-1",
				fromDate: "2026-07-01",
				fromMealKey: "breakfast",
				itemId: "item-1",
				...options,
			}),
		).rejects.toThrow("Move destination must differ from its source");
		expect(syncService.item("breakfast", "item-1")?.deletedAt).toBeNull();
		expect(syncService.getPayloadCalls).toHaveLength(0);
		expect(syncService.syncDaysCalls).toHaveLength(0);
	});
});

class RecordingDayPlanSyncCoordinator implements DayPlanSyncProvider {
	public readonly syncCalls: { readonly userId: string; readonly date: string; readonly payload: DaySyncPayload }[] =
		[];
	public readonly syncDaysCalls: { readonly userId: string; readonly daysPayload: Record<string, unknown> }[] = [];
	public readonly getPayloadCalls: { readonly userId: string; readonly date: string }[] = [];

	private readonly payloads: Record<string, DaySyncPayload>;
	private stalePayload: DaySyncPayload | null = null;
	private staleReadsRemaining: number;

	public constructor(payload: DaySyncPayload | Record<string, DaySyncPayload>, staleReadsAfterSync = 0) {
		this.payloads = isDaySyncPayload(payload) ? { "2026-07-01": payload } : payload;
		this.staleReadsRemaining = staleReadsAfterSync;
	}

	public get currentPayload(): DaySyncPayload {
		return this.getPayload("2026-07-01");
	}

	public async getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload> {
		this.getPayloadCalls.push({ userId, date });
		if (this.stalePayload && this.staleReadsRemaining > 0) {
			this.staleReadsRemaining -= 1;
			return structuredClone(this.stalePayload);
		}
		return structuredClone(this.getPayload(date));
	}

	public async syncSingleDay(userId: string, date: string, payload: DaySyncPayload): Promise<DayRevisions> {
		this.stalePayload = structuredClone(this.getPayload(date));
		this.payloads[date] = payload;
		this.syncCalls.push({ userId, date, payload });
		return DayRevisions.fromRecord({ [date]: `revision-${date}` });
	}

	public async syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<DayRevisions> {
		this.syncDaysCalls.push({ userId, daysPayload });
		for (const [date, payload] of Object.entries(daysPayload)) {
			if (isDaySyncPayload(payload)) {
				this.payloads[date] = payload;
			}
		}
		return DayRevisions.fromRecord(
			Object.fromEntries(Object.keys(daysPayload).map((date) => [date, `revision-${date}`])),
		);
	}

	public item(mealKey: string, itemId: string, date = "2026-07-01"): Record<string, unknown> | null {
		const meal = this.getPayload(date).dietPlan[mealKey];
		if (!isRecord(meal) || !Array.isArray(meal.items)) {
			return null;
		}

		return meal.items.find((item) => isRecord(item) && item.planDayDietItemId === itemId) ?? null;
	}

	private getPayload(date: string): DaySyncPayload {
		const payload = this.payloads[date];
		if (!payload) {
			throw new Error(`Missing payload for ${date}`);
		}
		return payload;
	}
}

function createPayload(meals: Record<string, readonly Record<string, unknown>[]>): DaySyncPayload {
	return {
		planDayRevisions: [],
		activities: [],
		dietPlan: Object.fromEntries(Object.entries(meals).map(([mealKey, items]) => [mealKey, { items: [...items] }])),
		toilet: [],
		water: { waterConsumption: 0 },
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
		eaten: false,
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

function createCustomItem(options: { readonly itemId: string }): Record<string, unknown> {
	return {
		planDayDietItemId: options.itemId,
		foodType: "CUSTOM_ITEM",
		name: "Own snack",
		energy: 321,
		protein: 12,
		fat: 9,
		carbohydrate: 42,
		measureId: 1,
		measureQuantity: 100,
		measureWeight: 100,
		measureCapacity: 0,
		source: "API",
		eaten: true,
		deletedAt: null,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDaySyncPayload(value: unknown): value is DaySyncPayload {
	return isRecord(value) && isRecord(value.dietPlan);
}

function mealItems(payload: DaySyncPayload | undefined, mealKey: string): Record<string, unknown>[] {
	const meal = payload?.dietPlan[mealKey];
	return isRecord(meal) && Array.isArray(meal.items) ? meal.items.filter(isRecord) : [];
}
