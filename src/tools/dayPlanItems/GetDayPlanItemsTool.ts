import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GetDayPlanOptions } from "../../api/dayPlan/GetDayPlanOptions.ts";
import { DateUtils } from "../../shared/DateUtils.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { DayPlanQueryProvider } from "../../services/dayPlan/DayPlanQueryService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import type { DayPlanItem } from "../../api/dayPlan/DayPlanItem.ts";
import { isoCalendarDateSchema, rawRecipeIdSchema } from "../shared/ToolSchemas.ts";

const dayPlanItemSchema = z.object({
	itemId: z
		.string()
		.optional()
		.describe("Fitatu meal item id used for update, remove, and move operations, when available."),
	name: z.string().optional().describe("Display name of the food or recipe in the meal, when available."),
	foodType: z
		.string()
		.optional()
		.describe("Fitatu food type for the item, for example PRODUCT or CUSTOM_ITEM, when available."),
	productId: z
		.string()
		.optional()
		.describe("Fitatu product definition id, when applicable. This is not a removable day-plan itemId."),
	recipeId: rawRecipeIdSchema
		.optional()
		.describe("Raw Fitatu recipe definition id for recipe items, when applicable."),
	brand: z.string().optional().describe("Product brand or producer name, when available."),
	measureId: z.string().optional().describe("Measure id currently used by the meal item, when available."),
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
	meals: z
		.array(
			z.object({
				mealKey: z.string().describe("Fitatu meal key used by add, update, remove, and move meal item tools."),
				mealTime: z.string().optional().describe("Meal time configured in Fitatu, when available."),
				items: z
					.array(dayPlanItemSchema)
					.optional()
					.describe("Food and recipe items currently assigned to this meal, when any."),
			}),
		)
		.optional(),
};

export class GetDayPlanItemsTool {
	public readonly name = "get_day_plan_items";

	private readonly dayPlanQueryService: DayPlanQueryProvider;

	public constructor(dayPlanQueryService: DayPlanQueryProvider) {
		this.dayPlanQueryService = dayPlanQueryService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Fitatu Day Plan Items",
				description:
					"Fetches Fitatu meals and concrete day-plan entries. Copy itemId UUID values to update_meal_item, move_meal_item, or remove_meal_items; productId and raw recipeId identify food definitions, not removable entries. Defaults to today's local date.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema()
							.optional()
							.describe(
								"Day to fetch in YYYY-MM-DD format. Defaults to today's local date when omitted.",
							),
						withRating: z
							.boolean()
							.default(false)
							.optional()
							.describe("Whether to ask Fitatu for rating-related day plan data when supported."),
					})
					.strict(),
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
					const dayPlan = await this.dayPlanQueryService.getDayPlan(
						new GetDayPlanOptions(date ?? DateUtils.toLocalDateString(), undefined, withRating === true),
					);
					return createTextResult({
						date: dayPlan.date,
						meals: dayPlan.meals.map((meal) => ({
							mealKey: meal.mealKey,
							mealTime: meal.mealTime,
							items: meal.items.map(toDayPlanItemForMcp),
						})),
					});
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to fetch Fitatu day plan items.", error);
				}
			},
		);
	}
}

function toDayPlanItemForMcp(item: DayPlanItem): Omit<DayPlanItem, "productId" | "recipeId" | "measureId"> & {
	productId?: string;
	recipeId?: string;
	measureId?: string;
} {
	const { productId, recipeId, measureId, ...otherFields } = item;
	return {
		...otherFields,
		...(productId === null ? {} : { productId: String(productId) }),
		...(recipeId === null ? {} : { recipeId: String(recipeId) }),
		...(measureId === null ? {} : { measureId: String(measureId) }),
	};
}
