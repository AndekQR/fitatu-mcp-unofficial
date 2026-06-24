import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import { MealItemMutationService } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	itemKindSchema,
	mealItemMutationOutputSchema,
	toMealItemKind,
} from "./MealItemToolSupport.ts";

export class RemoveMealItemTool {
	public readonly name = "remove_meal_item";

	private readonly mealItemMutationService: MealItemMutationService;

	public constructor(mealItemMutationService: MealItemMutationService) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Remove Fitatu Meal Item",
				description:
					"Removes one existing Fitatu meal item from a YYYY-MM-DD date. This is destructive. Fitatu applies this mutation asynchronously; an immediate get_day_plan_items call may still return the previous day plan state.",
				inputSchema: {
					date: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
						.describe("Day containing the item to remove, in YYYY-MM-DD format."),
					mealKey: z
						.string()
						.min(1)
						.describe("Meal key containing the item. Use mealKey values returned by get_day_plan_items."),
					itemId: z
						.string()
						.min(1)
						.describe("Meal item id to remove. Use itemId returned by get_day_plan_items."),
					itemKind: itemKindSchema.default("auto").optional(),
				},
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Remove Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, mealKey, itemId, itemKind }) => {
				try {
					const result = await this.mealItemMutationService.removeMealItem({
						date,
						mealKey,
						itemId,
						itemKind: toMealItemKind(itemKind),
					});
					return createTextResult(result);
				} catch (error) {
					return createSafeMealItemErrorResult(this.name, "Unable to remove Fitatu meal item.", error);
				}
			},
		);
	}
}
