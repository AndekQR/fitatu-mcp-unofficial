import { describe, expect, it } from "vitest";
import { AddMealItemsOptions } from "../../../../src/api/dayPlan/AddMealItemsOptions.ts";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";
import type { DayPlanClient } from "../../../../src/api/dayPlan/DayPlanClient.ts";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import { MealItemMutationResult } from "../../../../src/api/dayPlan/MealItemMutationResult.ts";
import { MealItemOperationSummary } from "../../../../src/api/dayPlan/MealItemOperationSummary.ts";
import { MutationConfirmationContext } from "../../../../src/services/MutationConfirmationContext.ts";
import { MutationConfirmationError } from "../../../../src/services/MutationConfirmationError.ts";
import type { MealItemMutationConfirmationProvider } from "../../../../src/services/dayPlan/MealItemMutationService.ts";
import { AddMealItemsTool } from "../../../../src/tools/addMealItems/AddMealItemsTool.ts";
import { GetDayPlanItemsTool } from "../../../../src/tools/dayPlanItems/GetDayPlanItemsTool.ts";
import {
	CleanupTracker,
	CleanupTrackingMealItemMutationConfirmer,
} from "../../../integration/helpers/cleanupTracker.ts";

describe("CleanupTracker", () => {
	it("removes an added item discovered under a different itemId after confirmation fails", async () => {
		const date = "2026-07-30";
		const mealKey = "breakfast";
		const activeItemIds = new Set<string>();
		const removedItemIds: string[] = [];
		const dayPlanClient = {
			getDayPlan: async () => dayPlan(date, mealKey, [...activeItemIds]),
			removeMealItem: async ({ itemId }: { readonly itemId: string }) => {
				if (!activeItemIds.delete(itemId)) {
					throw new Error("item not found");
				}
				removedItemIds.push(itemId);
				return MealItemMutationResult.acceptedRemove(
					date,
					[new MealItemOperationSummary(0, itemId, null, null, "PRODUCT", mealKey)],
					mealKey,
				);
			},
		} as unknown as DayPlanClient;
		const cleanup = new CleanupTracker(dayPlanClient);
		const confirmer = new CleanupTrackingMealItemMutationConfirmer(failingConfirmationProvider(), cleanup);
		const options = new AddMealItemsOptions(date, mealKey, [
			{ foodType: "PRODUCT", productId: "101", measureId: "2" },
		]);
		const result = MealItemMutationResult.acceptedAdd(
			date,
			mealKey,
			[new MealItemOperationSummary(0, "submitted-item", "101", null, "PRODUCT", mealKey)],
			DayRevisions.empty(),
		);

		await cleanup.prepareMealAddition(date, mealKey, 1);
		activeItemIds.add("persisted-item");

		await expect(confirmer.confirmAdded(options, result)).rejects.toBeInstanceOf(MutationConfirmationError);
		await cleanup.cleanup();

		expect(removedItemIds).toEqual(["persisted-item"]);
		expect(activeItemIds).toEqual(new Set());
	});
});

function failingConfirmationProvider(): MealItemMutationConfirmationProvider {
	return {
		confirmAdded: async () => {
			throw MutationConfirmationError.timeout(
				new MutationConfirmationContext(AddMealItemsTool.toolName, GetDayPlanItemsTool.toolName),
			);
		},
		confirmUpdated: async () => undefined,
		confirmRemoved: async () => undefined,
		getMoveSource: async () => {
			throw new Error("not used");
		},
		confirmMoved: async () => undefined,
		confirmReplaced: async () => undefined,
	};
}

function dayPlan(date: string, mealKey: string, itemIds: readonly string[]): DayPlan {
	return DayPlan.fromApiResponse({
		date,
		userId: "user-1",
		data: {
			dietPlan: {
				[mealKey]: {
					mealName: mealKey,
					items: itemIds.map((itemId) => ({
						planDayDietItemId: itemId,
						foodType: "PRODUCT",
						productId: 101,
						measureId: 2,
						measureQuantity: 1,
						eaten: false,
					})),
				},
			},
		},
	});
}
