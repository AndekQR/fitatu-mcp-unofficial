import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const dayPlanItemSchema = z.object({
	itemId: z.string().nullable().describe("Fitatu meal item id used for update, remove, and move operations."),
	name: z.string().nullable().describe("Display name of the food or recipe in the meal."),
	foodType: z.string().nullable().describe("Fitatu food type for the item, for example PRODUCT or CUSTOM_ITEM."),
	productId: z.union([z.number(), z.string()]).nullable().describe("Fitatu product id for product items, or null."),
	recipeId: z.union([z.number(), z.string()]).nullable().describe("Fitatu recipe id for recipe items, or null."),
	brand: z.string().nullable().describe("Product brand or producer name, when available."),
	measureId: z.union([z.number(), z.string()]).nullable().describe("Measure id currently used by the meal item."),
	measureName: z.string().nullable().describe("Human-readable name of the current measure."),
	measureQuantity: z.number().nullable().describe("Quantity of the current measure."),
	weight: z.number().nullable().describe("Item weight in grams when Fitatu provides it."),
	capacity: z.number().nullable().describe("Measure capacity or serving size when Fitatu provides it."),
	energy: z.number().nullable().describe("Energy for the item in kcal."),
	protein: z.number().nullable().describe("Protein for the item in grams."),
	fat: z.number().nullable().describe("Fat for the item in grams."),
	carbohydrate: z.number().nullable().describe("Carbohydrates for the item in grams."),
	fiber: z.number().nullable().describe("Fiber for the item in grams."),
	sugars: z.number().nullable().describe("Sugars for the item in grams."),
	salt: z.number().nullable().describe("Salt for the item in grams."),
	visible: z.boolean().nullable().describe("Whether the item is visible in the Fitatu day plan."),
	eaten: z.boolean().nullable().describe("Whether Fitatu marks the item as eaten."),
});

const dayPlanOutputSchema = {
	date: z.string().describe("YYYY-MM-DD date of the returned day plan."),
	meals: z.array(
		z.object({
			mealKey: z.string().describe("Fitatu meal key used by add, update, remove, and move meal item tools."),
			mealName: z.string().nullable().describe("Human-readable meal name, when available."),
			mealTime: z.string().nullable().describe("Meal time configured in Fitatu, when available."),
			items: z.array(dayPlanItemSchema).describe("Food and recipe items currently assigned to this meal."),
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
					date: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
						.describe("Day to fetch in YYYY-MM-DD format."),
					withRating: z
						.boolean()
						.default(false)
						.optional()
						.describe("Whether to ask Fitatu for rating-related day plan data when supported."),
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
