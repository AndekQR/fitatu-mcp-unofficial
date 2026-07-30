import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RemoveMealItemsOptions } from "../../api/dayPlan/RemoveMealItemsOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	mealItemMutationOutputSchema,
	toMealItemMutationForMcp,
} from "./MealItemToolSupport.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

export class RemoveMealItemsTool {
	public readonly name = "remove_meal_items";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "removeMealItems">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "removeMealItems">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Remove Fitatu Meal Items",
				description:
					"Atomically removes exact Fitatu day-plan entries of any food type. Copy itemId UUID values from get_day_plan_items; do not pass productId or recipeId. mealKey is unnecessary because each itemId identifies one concrete entry. If any requested active item is missing, nothing is synchronized. This operation is destructive and must be verified with get_day_plan_items.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe("Day containing the exact meal items to remove."),
						itemIds: z
							.array(z.string().uuid())
							.min(1)
							.refine((itemIds) => new Set(itemIds).size === itemIds.length, {
								message: "itemIds must contain unique UUID values",
							})
							.describe(
								"Unique itemId UUID values copied from get_day_plan_items. Each identifies one exact PRODUCT, RECIPE, or CUSTOM_ITEM entry; productId and recipeId are not accepted.",
							),
					})
					.strict(),
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Remove Fitatu Meal Items",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, itemIds }) => {
				try {
					const result = await this.mealItemMutationService.removeMealItems(
						new RemoveMealItemsOptions(date, itemIds),
					);
					return createTextResult(toMealItemMutationForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to remove Fitatu meal items.", error);
				}
			},
		);
	}
}
