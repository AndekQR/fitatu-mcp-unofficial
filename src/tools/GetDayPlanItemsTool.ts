import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FitatuAuthError } from "../api/auth/FitatuAuthError.ts";
import { DayPlanClient } from "../api/dayPlan/DayPlanClient.ts";
import { DayPlanError } from "../api/dayPlan/DayPlanError.ts";
import { createErrorResult, createTextResult } from "../lib/utils.ts";
import { logger } from "../logger.ts";

const dayPlanItemSchema = z.object({
	itemId: z.string().nullable(),
	name: z.string().nullable(),
	foodType: z.string().nullable(),
	productId: z.union([z.number(), z.string()]).nullable(),
	recipeId: z.union([z.number(), z.string()]).nullable(),
	brand: z.string().nullable(),
	measureId: z.union([z.number(), z.string()]).nullable(),
	measureName: z.string().nullable(),
	measureQuantity: z.number().nullable(),
	weight: z.number().nullable(),
	capacity: z.number().nullable(),
	energy: z.number().nullable(),
	protein: z.number().nullable(),
	fat: z.number().nullable(),
	carbohydrate: z.number().nullable(),
	fiber: z.number().nullable(),
	sugars: z.number().nullable(),
	salt: z.number().nullable(),
	visible: z.boolean().nullable(),
	eaten: z.boolean().nullable(),
});

const dayPlanOutputSchema = {
	date: z.string(),
	userId: z.string(),
	meals: z.array(
		z.object({
			mealKey: z.string(),
			mealName: z.string().nullable(),
			mealTime: z.string().nullable(),
			items: z.array(dayPlanItemSchema),
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
					date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format"),
					withRating: z.boolean().default(false).optional(),
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
					return createTextResult(dayPlan);
				} catch (error) {
					return this.createSafeErrorResult(error);
				}
			},
		);
	}

	private createSafeErrorResult(error: unknown) {
		const safeError = this.toSafeError(error);

		logger.error(
			{
				toolName: this.name,
				errorName: safeError.errorName,
				statusCode: safeError.statusCode,
			},
			"Tool execution failed",
		);

		return createErrorResult(safeError.message);
	}

	private toSafeError(error: unknown): {
		errorName: string;
		message: string;
		statusCode?: number;
	} {
		if (error instanceof FitatuAuthError) {
			return {
				errorName: error.name,
				message: "Fitatu authentication failed.",
				statusCode: error.statusCode,
			};
		}

		if (error instanceof DayPlanError) {
			return {
				errorName: error.name,
				message: error.statusCode ? "Fitatu day plan request failed." : error.message,
				statusCode: error.statusCode,
			};
		}

		return {
			errorName: error instanceof Error ? error.name : "UnknownError",
			message: "Unable to fetch Fitatu day plan items.",
		};
	}
}
