import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ReplaceMealItemOptions } from "../../api/dayPlan/ReplaceMealItemOptions.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import { isoCalendarDateSchema, nonEmptyStringSchema } from "../shared/ToolSchemas.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	createSafeMealItemErrorResult,
	MEAL_KEY_HINT,
	mealItemInputSchema,
	mealItemMutationOutputSchema,
	mealKeySchema,
	toMealItemInput,
	toMealItemMutationForMcp,
} from "./MealItemToolSupport.ts";

export class ReplaceMealItemTool {
	public static readonly toolName = "replace_meal_item";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "replaceMealItem">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "replaceMealItem">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			ReplaceMealItemTool.toolName,
			{
				title: "Replace Fitatu Meal Item",
				description:
					"Replaces and confirms one existing Fitatu meal item. Select the existing entry by its exact date, mealKey, and itemId, then provide replacement using the same strict PRODUCT, RECIPE, or fallback CUSTOM_ITEM payload accepted by add_meal_items. If replacement.eaten is omitted, the existing eaten state is preserved. Replacing a PRODUCT or RECIPE with the same catalog definition is rejected; use update_meal_item for quantity, measure, or eaten changes. A successful result confirms that the old item disappeared and the new item persisted in the same meal; item order is not part of the contract.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe(
							"Day containing the item to replace, in YYYY-MM-DD format.",
						),
						mealKey: mealKeySchema.describe(
							`Meal key containing the item. Use mealKey values returned by get_day_plan_items. ${MEAL_KEY_HINT}`,
						),
						itemId: nonEmptyStringSchema("itemId").describe(
							"Existing meal item id. Use itemId returned by get_day_plan_items.",
						),
						replacement: mealItemInputSchema.describe(
							"New meal item using the same payload as one entry in add_meal_items.items.",
						),
					})
					.strict(),
				outputSchema: mealItemMutationOutputSchema("replace"),
				annotations: {
					title: "Replace Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ date, mealKey, itemId, replacement }) => {
				try {
					const result = await this.mealItemMutationService.replaceMealItem(
						new ReplaceMealItemOptions(date, mealKey, itemId, toMealItemInput(replacement)),
					);
					return createTextResult(toMealItemMutationForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(
						ReplaceMealItemTool.toolName,
						"Unable to replace Fitatu meal item.",
						error,
					);
				}
			},
		);
	}
}
