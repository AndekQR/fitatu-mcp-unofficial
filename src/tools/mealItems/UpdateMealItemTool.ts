import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UpdateMealItemOptions } from "../../api/dayPlan/UpdateMealItemOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { MealItemMutationProvider } from "../../services/dayPlan/MealItemMutationService.ts";
import {
	createSafeMealItemErrorResult,
	MEAL_KEY_HINT,
	mealKeySchema,
	mealItemMutationOutputSchema,
	toMealItemMutationForMcp,
} from "./MealItemToolSupport.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

const idSchema = z.union([z.string().min(1), z.number().finite()]);

export class UpdateMealItemTool {
	public static readonly toolName = "update_meal_item";

	private readonly mealItemMutationService: Pick<MealItemMutationProvider, "updateMealItem">;

	public constructor(mealItemMutationService: Pick<MealItemMutationProvider, "updateMealItem">) {
		this.mealItemMutationService = mealItemMutationService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			UpdateMealItemTool.toolName,
			{
				title: "Update Fitatu Meal Item",
				description:
					"Updates and confirms one existing Fitatu meal item quantity, measure, or eaten flag. For CUSTOM_ITEM entries, it can also update the name, calories, protein, fat, or carbohydrates in place without changing the item id. A successful accepted result means every requested field was observed in the persisted day plan.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe(
							"Day containing the item to update, in YYYY-MM-DD format.",
						),
						mealKey: mealKeySchema.describe(
							`Meal key containing the item. Use mealKey values returned by get_day_plan_items. ${MEAL_KEY_HINT}`,
						),
						itemId: z
							.string()
							.min(1)
							.describe("Meal item id to update. Use itemId returned by get_day_plan_items."),
						measureQuantity: z
							.number()
							.positive()
							.optional()
							.describe("New positive quantity for the item's current or selected measure."),
						measureId: idSchema
							.optional()
							.describe(
								"New measure id for the item. Use measureId values returned by search_food when changing measures.",
							),
						eaten: z.boolean().optional().describe("Whether Fitatu should mark the item as eaten."),
						name: z
							.string()
							.trim()
							.min(1)
							.optional()
							.describe("New non-empty name. Accepted only for an existing CUSTOM_ITEM."),
						energyKcal: z
							.number()
							.finite()
							.nonnegative()
							.optional()
							.describe("New non-negative calorie total. Accepted only for an existing CUSTOM_ITEM."),
						proteinG: z
							.number()
							.finite()
							.nonnegative()
							.optional()
							.describe("New non-negative protein total in grams. Accepted only for a CUSTOM_ITEM."),
						fatG: z
							.number()
							.finite()
							.nonnegative()
							.optional()
							.describe("New non-negative fat total in grams. Accepted only for a CUSTOM_ITEM."),
						carbohydrateG: z
							.number()
							.finite()
							.nonnegative()
							.optional()
							.describe("New non-negative carbohydrate total in grams. Accepted only for a CUSTOM_ITEM."),
					})
					.strict()
					.refine(
						({ measureQuantity, measureId, eaten, name, energyKcal, proteinG, fatG, carbohydrateG }) =>
							[measureQuantity, measureId, eaten, name, energyKcal, proteinG, fatG, carbohydrateG].some(
								(value) => value !== undefined,
							),
						{ message: "Provide at least one update field" },
					),
				outputSchema: mealItemMutationOutputSchema,
				annotations: {
					title: "Update Fitatu Meal Item",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async ({
				date,
				mealKey,
				itemId,
				measureQuantity,
				measureId,
				eaten,
				name,
				energyKcal,
				proteinG,
				fatG,
				carbohydrateG,
			}) => {
				try {
					const result = await this.mealItemMutationService.updateMealItem(
						new UpdateMealItemOptions(
							date,
							mealKey,
							itemId,
							measureQuantity,
							measureId,
							eaten,
							undefined,
							name,
							energyKcal,
							proteinG,
							fatG,
							carbohydrateG,
						),
					);
					return createTextResult(toMealItemMutationForMcp(result));
				} catch (error) {
					return createSafeMealItemErrorResult(
						UpdateMealItemTool.toolName,
						"Unable to update Fitatu meal item.",
						error,
					);
				}
			},
		);
	}
}
