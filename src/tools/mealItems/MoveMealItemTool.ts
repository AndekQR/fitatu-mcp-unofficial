import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	mealKeySchema,
	mealItemMutationOutputSchema,
	toMealItemMutationForMcp,
} from "./MealItemToolSupport.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

export class MoveMealItemTool {
	public static readonly toolName = "move_meal_item";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			MoveMealItemTool.toolName,
			{
				title: "Move Fitatu Meal Item",
				description:
					"Moves and confirms one existing Fitatu meal item in another meal or date. Provide at least one destination field: toDate, toMealKey, or both. Fitatu creates a new item id during the move. A successful accepted result means the old item is absent and the new item with preserved observable values is present at the destination.",
				inputSchema: z
					.object({
						fromDate: isoCalendarDateSchema("fromDate").describe(
							"Current day containing the item to move, in YYYY-MM-DD format.",
						),
						fromMealKey: mealKeySchema.describe(
							"Current meal key containing the item. Use mealKey values returned by get_day_plan_items.",
						),
						itemId: z
							.string()
							.min(1)
							.describe("Meal item id to move. Use itemId returned by get_day_plan_items."),
						toDate: isoCalendarDateSchema("toDate")
							.optional()
							.describe(
								"Destination day in YYYY-MM-DD format. Omit when moving only to a different meal on the same date.",
							),
						toMealKey: mealKeySchema
							.optional()
							.describe(
								"Destination meal key. Omit only when moving to the same meal on a different date. Do not omit both toDate and toMealKey.",
							),
					})
					.strict(),
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
					const result = await this.mealItemMutationService.moveMealItem(
						new MoveMealItemOptions(fromDate, fromMealKey, itemId, toDate, toMealKey),
					);
					return createTextResult(toMealItemMutationForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(
						MoveMealItemTool.toolName,
						"Unable to move Fitatu meal item.",
						error,
					);
				}
			},
		);
	}
}
