import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import { createSafeMealItemErrorResult, mealItemMutationOutputSchema } from "./MealItemToolSupport.ts";

export class MoveMealItemTool {
	public readonly name = "move_meal_item";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Move Fitatu Meal Item",
				description:
					"Moves one existing Fitatu meal item to another meal or date. Provide at least one destination field: toDate, toMealKey, or both. Fitatu may create a new item id during the move and applies this mutation asynchronously; an immediate get_day_plan_items call may still return the previous day plan state.",
				inputSchema: {
					fromDate: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must use YYYY-MM-DD format")
						.describe("Current day containing the item to move, in YYYY-MM-DD format."),
					fromMealKey: z
						.string()
						.min(1)
						.describe(
							"Current meal key containing the item. Use mealKey values returned by get_day_plan_items.",
						),
					itemId: z
						.string()
						.min(1)
						.describe("Meal item id to move. Use itemId returned by get_day_plan_items."),
					toDate: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must use YYYY-MM-DD format")
						.optional()
						.describe(
							"Destination day in YYYY-MM-DD format. Omit when moving only to a different meal on the same date.",
						),
					toMealKey: z
						.string()
						.min(1)
						.optional()
						.describe(
							"Destination meal key. Omit only when moving to the same meal on a different date. Do not omit both toDate and toMealKey.",
						),
				},
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Move Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ fromDate, fromMealKey, itemId, toDate, toMealKey }) => {
				try {
					const result = await this.mealItemMutationService.moveMealItem({
						fromDate,
						fromMealKey,
						itemId,
						toDate,
						toMealKey,
					});
					return createTextResult(result);
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to move Fitatu meal item.", error);
				}
			},
		);
	}
}
