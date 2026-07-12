import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import { MealItemMutationService } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	mealItemInputSchema,
	mealItemMutationOutputSchema,
	toMealItemInput,
} from "../mealItems/MealItemToolSupport.ts";

export class AddMealItemsTool {
	public readonly name = "add_meal_items";

	private readonly mealItemMutationService: MealItemMutationService;

	public constructor(mealItemMutationService: MealItemMutationService) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Add Fitatu Meal Items",
				description:
					"Adds one or more products or recipes to an existing Fitatu meal for a YYYY-MM-DD date. Each item requires the foodId and measureId returned by search_food; pass foodType when available, including RECIPE for recipes. A status of accepted only confirms that Fitatu accepted the synchronization request; it does not confirm that individual items were persisted. After accepted, wait for synchronization and call get_day_plan_items to verify the result before reporting that the items were added. An immediate read may still return the previous day plan state.",
				inputSchema: {
					date: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
						.describe("Target day in YYYY-MM-DD format where the meal items should be added."),
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
					const result = await this.mealItemMutationService.addMealItems({
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
