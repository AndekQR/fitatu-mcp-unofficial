import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import { DayPlanQueryService } from "../../services/dayPlan/DayPlanQueryService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";

const dayPlanItemSchema = z.object({
	itemId: z.string().optional().describe("Fitatu meal item id used for update, remove, and move operations, when available."),
	name: z.string().optional().describe("Display name of the food or recipe in the meal, when available."),
	foodType: z.string().optional().describe("Fitatu food type for the item, for example PRODUCT or CUSTOM_ITEM, when available."),
	productId: z.union([z.number(), z.string()]).optional().describe("Fitatu product id for product items, when applicable."),
	recipeId: z.union([z.number(), z.string()]).optional().describe("Fitatu recipe id for recipe items, when applicable."),
	brand: z.string().optional().describe("Product brand or producer name, when available."),
	measureId: z.union([z.number(), z.string()]).optional().describe("Measure id currently used by the meal item, when available."),
	measureName: z.string().optional().describe("Human-readable name of the current measure, when available."),
	measureQuantity: z.number().optional().describe("Quantity of the current measure, when available."),
	weight: z.number().optional().describe("Item weight in grams when Fitatu provides it."),
	capacity: z.number().optional().describe("Measure capacity or serving size when Fitatu provides it."),
	energy: z.number().optional().describe("Energy for the item in kcal, when available."),
	protein: z.number().optional().describe("Protein for the item in grams, when available."),
	fat: z.number().optional().describe("Fat for the item in grams, when available."),
	carbohydrate: z.number().optional().describe("Carbohydrates for the item in grams, when available."),
	fiber: z.number().optional().describe("Fiber for the item in grams, when available."),
	sugars: z.number().optional().describe("Sugars for the item in grams, when available."),
	salt: z.number().optional().describe("Salt for the item in grams, when available."),
	visible: z.boolean().optional().describe("Whether the item is visible in the Fitatu day plan, when available."),
	eaten: z.boolean().optional().describe("Whether Fitatu marks the item as eaten, when available."),
});

const dayPlanOutputSchema = {
	date: z.string().describe("YYYY-MM-DD date of the returned day plan."),
	meals: z.array(
		z.object({
			mealKey: z.string().describe("Fitatu meal key used by add, update, remove, and move meal item tools."),
			mealName: z.string().optional().describe("Human-readable meal name, when available."),
			mealTime: z.string().optional().describe("Meal time configured in Fitatu, when available."),
			items: z.array(dayPlanItemSchema).optional().describe("Food and recipe items currently assigned to this meal, when any."),
		}),
	).optional(),
};

export class GetDayPlanItemsTool {
	public readonly name = "get_day_plan_items";

	private readonly dayPlanQueryService: DayPlanQueryService;

	public constructor(dayPlanQueryService: DayPlanQueryService) {
		this.dayPlanQueryService = dayPlanQueryService;
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
					const dayPlan = await this.dayPlanQueryService.getDayPlan({
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
