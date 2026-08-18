import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MoveMealItemOptions } from "../../api/dayPlan/MoveMealItemOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	MEAL_KEY_HINT,
	mealKeySchema,
	moveMealItemOutputSchema,
	toMoveMealItemForMcp,
} from "./MealItemToolSupport.ts";
import { isoCalendarDateSchema, nonEmptyStringSchema } from "../shared/ToolSchemas.ts";

export class MoveMealItemTool {
	public static readonly toolName = "move_meal_item";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "moveMealItem">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			MoveMealItemTool.toolName,
			{
				title: "Move Fitatu Meal Item",
				description:
					"Moves and confirms one existing Fitatu meal item selected by its exact source date, mealKey, and itemId. Provide a destination date, mealKey, or both that differs from the source. Fitatu creates a new item id during a valid move. Returns { status: 'confirmed', fromDate, fromMealKey, previousItemId, toDate, toMealKey, itemId }; use the returned itemId for later mutations.",
				inputSchema: z
					.object({
						fromDate: isoCalendarDateSchema("fromDate").describe(
							"Current day containing the item to move, in YYYY-MM-DD format.",
						),
						fromMealKey: mealKeySchema.describe(
							`Current meal key containing the item. Use mealKey values returned by get_day_plan_items. ${MEAL_KEY_HINT}`,
						),
						itemId: nonEmptyStringSchema("itemId").describe(
							"Meal item id to move. Use itemId returned by get_day_plan_items.",
						),
						toDate: isoCalendarDateSchema("toDate")
							.optional()
							.describe(
								"Destination day in YYYY-MM-DD format. Omit when moving only to a different meal on the same date.",
							),
						toMealKey: mealKeySchema
							.optional()
							.describe(
								"Destination meal key. Omit only when moving to the same meal on a different date. Do not omit both toDate and toMealKey.",
							),
					})
					.strict()
					.refine(({ toDate, toMealKey }) => toDate !== undefined || toMealKey !== undefined, {
						message: "Provide at least one move destination field",
					})
					.refine(
						({ fromDate, fromMealKey, toDate, toMealKey }) =>
							(toDate ?? fromDate) !== fromDate || (toMealKey ?? fromMealKey) !== fromMealKey,
						{ message: "Move destination must differ from its source" },
					)
					.describe(
						"Meal item move with at least one destination field and a destination different from the source.",
					),
				outputSchema: moveMealItemOutputSchema,
				annotations: {
					title: "Move Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({ fromDate, fromMealKey, itemId, toDate, toMealKey }) => {
				try {
					const result = await this.mealItemMutationService.moveMealItem(
						new MoveMealItemOptions(fromDate, fromMealKey, itemId, toDate, toMealKey),
					);
					return createTextResult(toMoveMealItemForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(
						MoveMealItemTool.toolName,
						"Unable to move Fitatu meal item.",
						error,
					);
				}
			},
		);
	}
}
