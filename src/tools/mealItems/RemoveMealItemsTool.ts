import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import { MealItemRemovalTarget } from "../../api/dayPlan/MealItemRemovalTarget.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	removeMealItemsOutputSchema,
	toRemoveMealItemsForMcp,
} from "./MealItemToolSupport.ts";
import { isoCalendarDateSchema, nonEmptyStringSchema } from "../shared/ToolSchemas.ts";

export class RemoveMealItemsTool {
	public static readonly toolName = "remove_meal_items";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "removeMealItems">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "removeMealItems">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			RemoveMealItemsTool.toolName,
			{
				title: "Remove Fitatu Meal Items",
				description:
					"Atomically removes and confirms exact Fitatu day-plan entries of any food type. Copy each mealKey and itemId pair from get_day_plan_items; do not pass productId or recipeId. If any requested active item is missing from its declared meal context, nothing is synchronized. Returns { status: 'confirmed', date, removedItems: [{ inputIndex, mealKey, itemId }] } after every selected item is absent from the persisted active day plan.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe("Day containing the exact meal items to remove."),
						items: z
							.array(
								z
									.object({
										mealKey: z.string().trim().min(1),
										itemId: nonEmptyStringSchema("itemId"),
									})
									.strict(),
							)
							.min(1)
							.refine(
								(items) =>
									new Set(items.map((item) => `${item.mealKey}\u0000${item.itemId}`)).size ===
									items.length,
								{
									message: "items must contain unique mealKey and itemId pairs",
								},
							)
							.describe(
								"Unique mealKey and itemId pairs copied from get_day_plan_items. Each identifies one exact PRODUCT, RECIPE, or CUSTOM_ITEM entry; productId and recipeId are not accepted.",
							),
					})
					.strict(),
				outputSchema: removeMealItemsOutputSchema,
				annotations: {
					title: "Remove Fitatu Meal Items",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, items }) => {
				try {
					const result = await this.mealItemMutationService.removeMealItems(
						new RemoveMealItemsOptions(
							date,
							items.map((item) => new MealItemRemovalTarget(item.mealKey, item.itemId)),
						),
					);
					return createTextResult(toRemoveMealItemsForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(
						RemoveMealItemsTool.toolName,
						"Unable to remove Fitatu meal items.",
						error,
					);
				}
			},
		);
	}
}
