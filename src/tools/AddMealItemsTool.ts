import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { createTextResult } from "../lib/utils.ts";
import {
	createSafeMealItemErrorResult,
	mealItemInputSchema,
	mealItemMutationOutputSchema,
	toMealItemInput,
} from "./MealItemToolSupport.ts";

export class AddMealItemsTool {
	public readonly name = "add_meal_items";

	private readonly dayPlanClient: DayPlanClient;

	public constructor(dayPlanClient: DayPlanClient = DayPlanClient.getInstance()) {
		this.dayPlanClient = dayPlanClient;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Add Fitatu Meal Items",
				description:
					"Adds one or more products or recipes to an existing Fitatu meal for a YYYY-MM-DD date. Requires productId/foodId or recipeId and measureId. Fitatu applies this mutation asynchronously; an immediate get_day_plan_items call may still return the previous day plan state.",
				inputSchema: {
					date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format"),
					mealKey: z.string().min(1),
					items: z.array(mealItemInputSchema).min(1),
				},
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Add Fitatu Meal Items",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, mealKey, items }) => {
				try {
					const result = await this.dayPlanClient.addMealItems({
						date,
						mealKey,
						items: items.map(toMealItemInput),
					});
					return createTextResult(result);
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to add Fitatu meal items.", error);
				}
			},
		);
	}
}
