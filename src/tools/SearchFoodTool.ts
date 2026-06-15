import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FoodSearchClient } from "../api/foodSearch/FoodSearchClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const nullableNumberSchema = z.number().nullable();
const nullableStringSchema = z.string().nullable();
const nullableBooleanSchema = z.boolean().nullable();

const nutritionOutputSchema = z.object({
	energyKcal: nullableNumberSchema,
	proteinG: nullableNumberSchema,
	fatG: nullableNumberSchema,
	carbsG: nullableNumberSchema,
	fiberG: nullableNumberSchema,
	sugarsG: nullableNumberSchema,
	saltG: nullableNumberSchema,
	saturatedFatG: nullableNumberSchema,
});

const measureOutputSchema = z.object({
	measureId: nullableStringSchema,
	measureName: nullableStringSchema,
	weightG: nullableNumberSchema,
	unit: nullableStringSchema,
	energyKcal: nullableNumberSchema,
});

const fitatuApiErrorOutputSchema = z.object({
	statusCode: z.number().int(),
	statusText: nullableStringSchema,
	method: z.string(),
	path: z.string(),
	upstreamMessage: nullableStringSchema,
	upstreamCode: z.union([z.string(), z.number()]).nullable(),
	responseSnippet: nullableStringSchema,
});

const warningDetailOutputSchema = z.object({
	message: z.string(),
	errorName: z.string(),
	query: z.string().optional(),
	source: z.enum(["public", "user"]).optional(),
	foodId: z.string().optional(),
	fitatuApiError: fitatuApiErrorOutputSchema.optional(),
	fitatuApiErrors: z.array(fitatuApiErrorOutputSchema).optional(),
});

const foodSearchOutputSchema = {
	status: z.literal("ok"),
	date: z.string(),
	query: nullableStringSchema,
	queries: z.array(z.string()),
	queryCount: z.number().int(),
	count: z.number().int(),
	items: z.array(
		z.object({
			index: z.number().int(),
			queryIndex: z.number().int(),
			query: z.string(),
			source: z.enum(["public", "user"]),
			foodId: z.string(),
			productId: z.string(),
			foodType: nullableStringSchema,
			name: nullableStringSchema,
			displayName: z.string(),
			brand: nullableStringSchema,
			measureId: nullableStringSchema,
			measureName: nullableStringSchema,
			measureQuantity: nullableNumberSchema,
			weightG: nullableNumberSchema,
			kcal: nullableNumberSchema,
			nutritionPer100g: nutritionOutputSchema,
			nutritionPerDefaultMeasure: nutritionOutputSchema,
			verified: nullableBooleanSchema,
			photoUrl: nullableStringSchema,
			matchScore: z.number(),
			measures: z.array(measureOutputSchema),
		}),
	),
	warnings: z.array(z.string()),
	warningDetails: z.array(warningDetailOutputSchema),
	message: z.string(),
};

const inputSchema = {
	query: z.string().min(1).optional(),
	queries: z.array(z.string().min(1)).optional(),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
		.optional(),
	locale: z.string().min(1).default("pl_PL").optional(),
	limit: z.number().int().min(1).max(50).default(10).optional(),
	includeUserFood: z.boolean().default(true).optional(),
	includePublicFood: z.boolean().default(true).optional(),
	includeDetails: z.boolean().default(true).optional(),
	detailsLimit: z.number().int().min(0).max(50).default(3).optional(),
};

export class SearchFoodTool {
	public readonly name = "search_food";

	private readonly foodSearchClient: FoodSearchClient;

	public constructor(foodSearchClient: FoodSearchClient = FoodSearchClient.getInstance()) {
		this.foodSearchClient = foodSearchClient;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Search Fitatu Food",
				description:
					"Searches Fitatu food catalogs for product ids and measure ids. Provide exactly one of query or queries. Use returned foodId/productId and measureId values with add_meal_items.",
				inputSchema,
				outputSchema: foodSearchOutputSchema,
				annotations: {
					title: "Search Fitatu Food",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async (input) => {
				try {
					const result = await this.foodSearchClient.search(input);
					return createTextResult(result);
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to search Fitatu food.", error);
				}
			},
		);
	}
}
