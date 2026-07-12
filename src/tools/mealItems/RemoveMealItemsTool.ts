import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import { MealItemMutationService } from "../../services/dayPlan/MealItemMutationService.ts";
import { createSafeMealItemErrorResult, mealItemMutationOutputSchema } from "./MealItemToolSupport.ts";

export class RemoveMealItemsTool {
	public readonly name = "remove_meal_items";

	private readonly mealItemMutationService: MealItemMutationService;

	public constructor(mealItemMutationService: MealItemMutationService) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Remove Fitatu Meal Items",
				description:
					"Removes all active PRODUCT meal items matching one or more productIds from a YYYY-MM-DD date. Copy productId strings from get_day_plan_items. This is destructive. The items are removed in one Fitatu day sync; accepted means Fitatu accepted the sync request.",
				inputSchema: {
					date: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
						.describe("Day containing the products to remove, in YYYY-MM-DD format."),
					productIds: z
						.array(z.string().min(1))
						.min(1)
						.describe(
							"One or more Fitatu product id strings copied from get_day_plan_items. All active occurrences of each productId are removed from the whole day.",
						),
				},
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Remove Fitatu Meal Items",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, productIds }) => {
				try {
					const result = await this.mealItemMutationService.removeMealItems({
						date,
						productIds,
					});
					return createTextResult(result);
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to remove Fitatu meal items.", error);
				}
			},
		);
	}
}
