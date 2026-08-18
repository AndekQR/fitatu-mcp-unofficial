import { describe, expect, it } from "vitest";
import { AddMealItemsOptions } from "../../../../src/api/dayPlan/AddMealItemsOptions.ts";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import { MealItemMutationResult } from "../../../../src/api/dayPlan/MealItemMutationResult.ts";
import { MealItemOperationSummary } from "../../../../src/api/dayPlan/MealItemOperationSummary.ts";
import { MoveMealItemOptions } from "../../../../src/api/dayPlan/MoveMealItemOptions.ts";
import { RemoveMealItemsOptions } from "../../../../src/api/dayPlan/RemoveMealItemsOptions.ts";
import { MealItemRemovalTarget } from "../../../../src/api/dayPlan/MealItemRemovalTarget.ts";
import { UpdateMealItemOptions } from "../../../../src/api/dayPlan/UpdateMealItemOptions.ts";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import { BoundedPoller } from "../../../../src/shared/BoundedPoller.ts";
import { MealItemMutationConfirmer } from "../../../../src/services/dayPlan/MealItemMutationConfirmer.ts";
import { SERVICE_ERROR_CODES } from "../../../../src/services/ServiceErrorCode.ts";
import { AddMealItemsTool } from "../../../../src/tools/addMealItems/AddMealItemsTool.ts";
import { GetDayPlanItemsTool } from "../../../../src/tools/dayPlanItems/GetDayPlanItemsTool.ts";
import { ProductMealItemInput } from "../../../../src/api/dayPlan/ProductMealItemInput.ts";
import { ReplaceMealItemOptions } from "../../../../src/api/dayPlan/ReplaceMealItemOptions.ts";

describe("MealItemMutationConfirmer", () => {
	it("confirms a batch only after every submitted item is visible by its exact itemId and values", async () => {
		const plans = [
			dayPlan({ breakfast: [] }),
			dayPlan({
				breakfast: [
					{
						planDayDietItemId: "item-1",
						foodType: "PRODUCT",
						productId: 101,
						measureId: 2,
						measureQuantity: 1.78,
						eaten: true,
					},
				],
			}),
			dayPlan({
				breakfast: [
					{
						planDayDietItemId: "item-1",
						foodType: "PRODUCT",
						productId: 101,
						measureId: 2,
						measureQuantity: 1.78,
						eaten: true,
					},
					{
						planDayDietItemId: "item-2",
						foodType: "PRODUCT",
						productId: 202,
						measureId: 3,
						measureQuantity: 2,
						eaten: false,
					},
				],
			}),
		];
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{
				getDayPlan: async () => plans[Math.min(reads++, plans.length - 1)]!,
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new AddMealItemsOptions("2026-07-30", "breakfast", [
			{
				foodType: "PRODUCT",
				productId: "101",
				measureId: "2",
				measureQuantity: 1.777777,
				eaten: true,
			},
			{
				foodType: "PRODUCT",
				productId: "202",
				measureId: "3",
				measureQuantity: 2,
				eaten: false,
			},
		]);
		const result = MealItemMutationResult.acceptedAdd(
			"2026-07-30",
			"breakfast",
			[
				new MealItemOperationSummary(0, "item-1", "101", null, "PRODUCT", "breakfast"),
				new MealItemOperationSummary(1, "item-2", "202", null, "PRODUCT", "breakfast"),
			],
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmAdded(options, result)).resolves.toBeUndefined();
		expect(reads).toBe(3);
	});

	it("confirms an update only when every requested field is visible", async () => {
		const plans = [
			dayPlan({
				breakfast: [
					{
						planDayDietItemId: "item-1",
						foodType: "CUSTOM_ITEM",
						name: "Own snack",
						energy: 300,
						protein: 10,
						fat: 8,
						carbohydrate: 40,
					},
				],
			}),
			dayPlan({
				breakfast: [
					{
						planDayDietItemId: "item-1",
						foodType: "CUSTOM_ITEM",
						name: "Corrected snack",
						energy: 321,
						protein: 12.345,
						fat: 9,
						carbohydrate: 42,
					},
				],
			}),
		];
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{ getDayPlan: async () => plans[Math.min(reads++, plans.length - 1)]! },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await confirmer.confirmUpdated(
			new UpdateMealItemOptions(
				"2026-07-30",
				"breakfast",
				"item-1",
				undefined,
				undefined,
				undefined,
				undefined,
				" Corrected snack ",
				321.004,
				12.35,
				9,
				42,
			),
		);

		expect(reads).toBe(2);
	});

	it("confirms recipe and custom additions from all user-controlled fields", async () => {
		const confirmer = new MealItemMutationConfirmer(
			{
				getDayPlan: async () =>
					dayPlan({
						supper: [
							{
								planDayDietItemId: "recipe-item",
								foodType: "RECIPE",
								recipeId: 300,
								measureId: 39,
								measureQuantity: 1.25,
								eaten: false,
							},
							{
								planDayDietItemId: "custom-item",
								foodType: "CUSTOM_ITEM",
								name: "Own snack",
								energy: 321,
								protein: 12.345,
								fat: 9,
								carbohydrate: 42,
								eaten: true,
							},
						],
					}),
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new AddMealItemsOptions("2026-07-30", "supper", [
			{
				foodType: "RECIPE",
				recipeId: "300",
				measureId: "39",
				measureQuantity: 1.25,
				eaten: false,
			},
			{
				foodType: "CUSTOM_ITEM",
				name: "Own snack",
				energyKcal: 321,
				proteinG: 12.35,
				fatG: 9,
				carbohydrateG: 42,
				eaten: true,
			},
		]);
		const result = MealItemMutationResult.acceptedAdd(
			"2026-07-30",
			"supper",
			[
				new MealItemOperationSummary(0, "recipe-item", null, "300", "RECIPE", "supper"),
				new MealItemOperationSummary(1, "custom-item", null, null, "CUSTOM_ITEM", "supper"),
			],
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmAdded(options, result)).resolves.toBeUndefined();
	});

	it("confirms removal only after every selected item is absent from active meals", async () => {
		const plans = [
			dayPlan({
				breakfast: [{ planDayDietItemId: "item-1", foodType: "PRODUCT" }],
				lunch: [{ planDayDietItemId: "item-2", foodType: "PRODUCT" }],
			}),
			dayPlan({ breakfast: [], lunch: [] }),
		];
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{ getDayPlan: async () => plans[Math.min(reads++, plans.length - 1)]! },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);

		await confirmer.confirmRemoved(
			new RemoveMealItemsOptions("2026-07-30", [
				new MealItemRemovalTarget("breakfast", "item-1"),
				new MealItemRemovalTarget("lunch", "item-2"),
			]),
		);

		expect(reads).toBe(2);
	});

	it("confirms replacement when the old item is absent and the new item matches regardless of order", async () => {
		const plans = [
			dayPlan({
				dinner: [
					{ planDayDietItemId: "before", foodType: "PRODUCT", productId: 100, measureId: 1 },
					{ planDayDietItemId: "old-item", foodType: "PRODUCT", productId: 101, measureId: 1 },
					{ planDayDietItemId: "after", foodType: "PRODUCT", productId: 102, measureId: 1 },
				],
			}),
			dayPlan({
				dinner: [
					{
						planDayDietItemId: "new-item",
						foodType: "PRODUCT",
						productId: 202,
						measureId: 2,
						measureQuantity: 0.5,
						eaten: true,
					},
					{ planDayDietItemId: "before", foodType: "PRODUCT", productId: 100, measureId: 1 },
					{ planDayDietItemId: "after", foodType: "PRODUCT", productId: 102, measureId: 1 },
				],
			}),
		];
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{ getDayPlan: async () => plans[Math.min(reads++, plans.length - 1)]! },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new ReplaceMealItemOptions(
			"2026-07-30",
			"dinner",
			"old-item",
			new ProductMealItemInput("202", "2", 0.5),
		);
		const result = MealItemMutationResult.acceptedReplace(
			"2026-07-30",
			"dinner",
			"old-item",
			new MealItemOperationSummary(0, "new-item", "202", null, "PRODUCT", "dinner"),
			DayRevisions.empty(),
			true,
		);

		await expect(confirmer.confirmReplaced(options, result)).resolves.toBeUndefined();
		expect(reads).toBe(2);
	});

	it("confirms a cross-day move only when the source is absent and the destination preserves its values", async () => {
		const before = dayPlan({
			breakfast: [
				{
					planDayDietItemId: "old-item",
					foodType: "PRODUCT",
					productId: 101,
					measureId: 2,
					measureQuantity: 1.5,
					eaten: true,
				},
			],
		});
		const afterSource = dayPlan({ breakfast: [] });
		const afterTarget = dayPlan(
			{
				lunch: [
					{
						planDayDietItemId: "new-item",
						foodType: "PRODUCT",
						productId: "101",
						measureId: "2",
						measureQuantity: 1.5,
						eaten: true,
					},
				],
			},
			"2026-07-31",
		);
		let mutationSubmitted = false;
		const confirmer = new MealItemMutationConfirmer(
			{
				getDayPlan: async ({ date }) => {
					if (!mutationSubmitted) {
						return before;
					}
					return date === "2026-07-30" ? afterSource : afterTarget;
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new MoveMealItemOptions("2026-07-30", "breakfast", "old-item", "2026-07-31", "lunch");
		const source = await confirmer.getMoveSource(options);
		mutationSubmitted = true;
		const result = MealItemMutationResult.acceptedMove(
			"2026-07-30",
			"breakfast",
			"old-item",
			new MealItemOperationSummary(0, "new-item", 101, null, "PRODUCT", "lunch"),
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmMoved(options, result, source)).resolves.toBeUndefined();
	});

	it("confirms a same-day move from one meal to another", async () => {
		const before = dayPlan({
			breakfast: [
				{
					planDayDietItemId: "old-item",
					foodType: "PRODUCT",
					productId: 101,
					measureId: 2,
					measureQuantity: 1.5,
					eaten: false,
				},
			],
			lunch: [],
		});
		const after = dayPlan({
			breakfast: [],
			lunch: [
				{
					planDayDietItemId: "new-item",
					foodType: "PRODUCT",
					productId: "101",
					measureId: "2",
					measureQuantity: 1.5,
					eaten: false,
				},
			],
		});
		let mutationSubmitted = false;
		const confirmer = new MealItemMutationConfirmer(
			{ getDayPlan: async () => (mutationSubmitted ? after : before) },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new MoveMealItemOptions("2026-07-30", "breakfast", "old-item", undefined, "lunch");
		const source = await confirmer.getMoveSource(options);
		mutationSubmitted = true;
		const result = MealItemMutationResult.acceptedMove(
			"2026-07-30",
			"breakfast",
			"old-item",
			new MealItemOperationSummary(0, "new-item", "101", null, "PRODUCT", "lunch"),
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmMoved(options, result, source)).resolves.toBeUndefined();
	});

	it("reports an accepted write as unconfirmed when the confirmation deadline elapses", async () => {
		const confirmer = new MealItemMutationConfirmer(
			{ getDayPlan: async () => dayPlan({ breakfast: [] }) },
			new BoundedPoller({ intervalMs: 1, timeoutMs: 5 }),
		);
		const options = new AddMealItemsOptions("2026-07-30", "breakfast", [
			{ foodType: "PRODUCT", productId: "101", measureId: "2" },
		]);
		const result = MealItemMutationResult.acceptedAdd(
			"2026-07-30",
			"breakfast",
			[new MealItemOperationSummary(0, "item-1", "101", null, "PRODUCT", "breakfast")],
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmAdded(options, result)).rejects.toMatchObject({
			kind: "unconfirmed",
			code: SERVICE_ERROR_CODES.mutationConfirmationTimeout,
			message: expect.stringMatching(
				new RegExp(
					`accepted the ${AddMealItemsTool.toolName}.*could not be confirmed.*${GetDayPlanItemsTool.toolName}`,
					"i",
				),
			),
		});
	});

	it("retries a transient confirmation read failure within the same polling budget", async () => {
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{
				getDayPlan: async () => {
					reads += 1;
					if (reads === 1) {
						throw FitatuClientError.transport({
							operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
							message: "temporary network failure",
							method: "GET",
							endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
							error: new TypeError("fetch failed"),
						});
					}
					return dayPlan({
						breakfast: [
							{
								planDayDietItemId: "item-1",
								foodType: "PRODUCT",
								productId: 101,
								measureId: 2,
								measureQuantity: 1,
								eaten: false,
							},
						],
					});
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new AddMealItemsOptions("2026-07-30", "breakfast", [
			{ foodType: "PRODUCT", productId: "101", measureId: "2" },
		]);
		const result = MealItemMutationResult.acceptedAdd(
			"2026-07-30",
			"breakfast",
			[new MealItemOperationSummary(0, "item-1", "101", null, "PRODUCT", "breakfast")],
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmAdded(options, result)).resolves.toBeUndefined();
		expect(reads).toBe(2);
	});

	it("stops immediately and reports a terminal confirmation read failure", async () => {
		let reads = 0;
		const confirmer = new MealItemMutationConfirmer(
			{
				getDayPlan: async () => {
					reads += 1;
					throw FitatuClientError.invalidResponse({
						operation: FITATU_CLIENT_OPERATIONS.dayPlanGet,
						message: "unexpected day-plan response",
						method: "GET",
						endpointTemplate: "/diet-and-activity-plan/:userId/day/:date",
					});
				},
			},
			new BoundedPoller({ intervalMs: 1, timeoutMs: 50 }),
		);
		const options = new AddMealItemsOptions("2026-07-30", "breakfast", [
			{ foodType: "PRODUCT", productId: "101", measureId: "2" },
		]);
		const result = MealItemMutationResult.acceptedAdd(
			"2026-07-30",
			"breakfast",
			[new MealItemOperationSummary(0, "item-1", "101", null, "PRODUCT", "breakfast")],
			DayRevisions.empty(),
		);

		await expect(confirmer.confirmAdded(options, result)).rejects.toMatchObject({
			kind: "unconfirmed",
			code: SERVICE_ERROR_CODES.mutationConfirmationReadFailed,
			message: expect.stringMatching(/accepted.*confirmation read failed.*do not retry automatically/i),
		});
		expect(reads).toBe(1);
	});
});

function dayPlan(meals: Record<string, readonly Record<string, unknown>[]>, date = "2026-07-30"): DayPlan {
	return DayPlan.fromApiResponse({
		date,
		userId: "user-1",
		data: {
			dietPlan: Object.fromEntries(
				Object.entries(meals).map(([mealKey, items]) => [mealKey, { mealName: mealKey, items }]),
			),
		},
	});
}
