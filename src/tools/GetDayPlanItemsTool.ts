import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const dayPlanItemSchema = z.object({
	itemId: z.string().nullable(),
	name: z.string().nullable(),
	foodType: z.string().nullable(),
	productId: z.union([z.number(), z.string()]).nullable(),
	recipeId: z.union([z.number(), z.string()]).nullable(),
	brand: z.string().nullable(),
	measureId: z.union([z.number(), z.string()]).nullable(),
	measureName: z.string().nullable(),
	measureQuantity: z.number().nullable(),
	weight: z.number().nullable(),
	capacity: z.number().nullable(),
	energy: z.number().nullable(),
	protein: z.number().nullable(),
	fat: z.number().nullable(),
	carbohydrate: z.number().nullable(),
	fiber: z.number().nullable(),
	sugars: z.number().nullable(),
	salt: z.number().nullable(),
	visible: z.boolean().nullable(),
	eaten: z.boolean().nullable(),
});

const dayPlanOutputSchema = {
	date: z.string(),
	meals: z.array(
		z.object({
			mealKey: z.string(),
			mealName: z.string().nullable(),
			mealTime: z.string().nullable(),
			items: z.array(dayPlanItemSchema),
		}),
	),
};

export class GetDayPlanItemsTool {
	public readonly name = "get_day_plan_items";

	private readonly dayPlanClient: DayPlanClient;

	public constructor(dayPlanClient: DayPlanClient = DayPlanClient.getInstance()) {
		this.dayPlanClient = dayPlanClient;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Fitatu Day Plan Items",
				description:
					"Fetches the authenticated Fitatu user's day plan meals and added food items for a YYYY-MM-DD date.",
				inputSchema: {
					date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format"),
					withRating: z.boolean().default(false).optional(),
				},
				outputSchema: dayPlanOutputSchema,
				annotations: {
					title: "Get Fitatu Day Plan Items",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ date, withRating }) => {
				try {
					const dayPlan = await this.dayPlanClient.getDayPlan({
						date,
						withRating: withRating === true,
					});
					return createTextResult({
						date: dayPlan.date,
						meals: dayPlan.meals,
					});
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to fetch Fitatu day plan items.", error);
				}
			},
		);
	}
}
