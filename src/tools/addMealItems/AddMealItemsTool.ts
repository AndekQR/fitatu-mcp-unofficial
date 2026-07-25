import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	mealItemInputSchema,
	mealItemMutationOutputSchema,
	toMealItemMutationForMcp,
	toMealItemInput,
} from "../mealItems/MealItemToolSupport.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

export class AddMealItemsTool {
	public readonly name = "add_meal_items";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "addMealItems">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "addMealItems">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Add Fitatu Meal Items",
				description:
					"Validates and submits products, recipes, or custom items to a Fitatu meal. Every item requires foodType and a foodId/measureId pair returned by search_food; recipe foodId values use recipe:<digits>. Deleted recipes and mismatched measures are rejected before synchronization. provisionalItemIds are not proof of persistence: wait and verify with get_day_plan_items.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe(
							"Target day in YYYY-MM-DD format where the meal items should be added.",
						),
						mealKey: z
							.string()
							.min(1)
							.describe(
								"Fitatu meal key to add items into. Use mealKey values returned by get_day_plan_items.",
							),
						items: z
							.array(mealItemInputSchema)
							.min(1)
							.describe("One or more products or recipes to add. Batch multiple meal items in one call."),
					})
					.strict(),
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
					const result = await this.mealItemMutationService.addMealItems({
						date,
						mealKey,
						items: items.map(toMealItemInput),
					});
					return createTextResult(toMealItemMutationForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to add Fitatu meal items.", error);
				}
			},
		);
	}
}
