import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createSafeMealItemErrorResult, mealItemMutationOutputSchema } from "./MealItemToolSupport.ts";

export class MoveMealItemTool {
	public readonly name = "move_meal_item";

	private readonly dayPlanClient: DayPlanClient;

	public constructor(dayPlanClient: DayPlanClient = DayPlanClient.getInstance()) {
		this.dayPlanClient = dayPlanClient;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Move Fitatu Meal Item",
				description:
					"Moves one existing Fitatu meal item to another meal or date. Fitatu may create a new item id during the move and applies this mutation asynchronously; an immediate get_day_plan_items call may still return the previous day plan state.",
				inputSchema: {
					fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must use YYYY-MM-DD format"),
					fromMealKey: z.string().min(1),
					itemId: z.string().min(1),
					toDate: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must use YYYY-MM-DD format")
						.optional(),
					toMealKey: z.string().min(1).optional(),
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
					const result = await this.dayPlanClient.moveMealItem({
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
