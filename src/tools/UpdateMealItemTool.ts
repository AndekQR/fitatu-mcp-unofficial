import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createSafeMealItemErrorResult, mealItemMutationOutputSchema } from "./MealItemToolSupport.ts";

const idSchema = z.union([z.string().min(1), z.number().finite()]);

export class UpdateMealItemTool {
	public readonly name = "update_meal_item";

	private readonly dayPlanClient: DayPlanClient;

	public constructor(dayPlanClient: DayPlanClient = DayPlanClient.getInstance()) {
		this.dayPlanClient = dayPlanClient;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Update Fitatu Meal Item",
				description:
					"Updates one existing Fitatu meal item quantity, measure, or eaten flag for a YYYY-MM-DD date. Fitatu applies this mutation asynchronously; an immediate get_day_plan_items call may still return the previous day plan state.",
				inputSchema: {
					date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format"),
					mealKey: z.string().min(1),
					itemId: z.string().min(1),
					measureQuantity: z.number().positive().optional(),
					measureId: idSchema.optional(),
					eaten: z.boolean().optional(),
				},
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Update Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, mealKey, itemId, measureQuantity, measureId, eaten }) => {
				try {
					const result = await this.dayPlanClient.updateMealItem({
						date,
						mealKey,
						itemId,
						measureQuantity,
						measureId,
						eaten,
					});
					return createTextResult(result);
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to update Fitatu meal item.", error);
				}
			},
		);
	}
}
