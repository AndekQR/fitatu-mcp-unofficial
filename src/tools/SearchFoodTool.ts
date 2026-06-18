import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FoodSearchClient } from "../api/foodSearch/FoodSearchClient.ts";
import { createTextResult } from "../lib/utils.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const nullableNumberSchema = z.number().nullable();
const nullableStringSchema = z.string().nullable();
const nullableBooleanSchema = z.boolean().nullable();

const nutritionOutputSchema = z.object({
	energyKcal: nullableNumberSchema.describe("Energy in kcal, or null when Fitatu did not provide it."),
	proteinG: nullableNumberSchema.describe("Protein in grams, or null when Fitatu did not provide it."),
	fatG: nullableNumberSchema.describe("Fat in grams, or null when Fitatu did not provide it."),
	carbsG: nullableNumberSchema.describe("Carbohydrates in grams, or null when Fitatu did not provide it."),
	fiberG: nullableNumberSchema.describe("Fiber in grams, or null when Fitatu did not provide it."),
	sugarsG: nullableNumberSchema.describe("Sugars in grams, or null when Fitatu did not provide it."),
	saltG: nullableNumberSchema.describe("Salt in grams, or null when Fitatu did not provide it."),
	saturatedFatG: nullableNumberSchema.describe("Saturated fat in grams, or null when Fitatu did not provide it."),
});

const measureOutputSchema = z.object({
	measureId: nullableStringSchema.describe("Measure id to pass to add_meal_items or update_meal_item."),
	measureName: nullableStringSchema.describe("Human-readable measure name, for example serving, package, or gram."),
	weightG: nullableNumberSchema.describe("Measure weight in grams, or null when unknown."),
	unit: nullableStringSchema.describe("Fitatu unit key for the measure, when available."),
	energyKcal: nullableNumberSchema.describe("Energy for one unit of this measure in kcal, when available."),
});

const fitatuApiErrorOutputSchema = z.object({
	statusCode: z.number().int().describe("HTTP status code returned by Fitatu."),
	statusText: nullableStringSchema.describe("HTTP status text returned by Fitatu, when available."),
	method: z.string().describe("HTTP method used for the upstream Fitatu request."),
	path: z.string().describe("Fitatu API path that produced the warning or error."),
	upstreamMessage: nullableStringSchema.describe("Safe upstream error message returned by Fitatu, when available."),
	upstreamCode: z
		.union([z.string(), z.number()])
		.nullable()
		.describe("Safe upstream error code returned by Fitatu, when available."),
	responseSnippet: nullableStringSchema.describe("Short safe snippet of the upstream response, when available."),
});

const warningDetailOutputSchema = z.object({
	message: z.string().describe("Human-readable warning message."),
	errorName: z.string().describe("Name of the internal error type that produced this warning."),
	query: z.string().optional().describe("Search query related to the warning, when applicable."),
	source: z.enum(["public", "user"]).optional().describe("Catalog source related to the warning, when applicable."),
	foodId: z.string().optional().describe("Food id related to a product details warning, when applicable."),
	fitatuApiError: fitatuApiErrorOutputSchema
		.optional()
		.describe("Single upstream Fitatu error related to the warning."),
	fitatuApiErrors: z
		.array(fitatuApiErrorOutputSchema)
		.optional()
		.describe("Multiple upstream Fitatu errors related to the warning."),
});

const foodSearchOutputSchema = {
	status: z.literal("ok").describe("Search status. ok means at least one requested source responded successfully."),
	date: z.string().describe("YYYY-MM-DD date used for user food search context."),
	queries: z.array(z.string()).describe("Normalized list of search queries processed by this call."),
	queryCount: z.number().int().describe("Number of search queries processed by this call."),
	count: z.number().int().describe("Total number of returned candidate items across all queries."),
	items: z.array(
		z.object({
			index: z.number().int().describe("Zero-based index of this candidate in the full returned items array."),
			queryIndex: z.number().int().describe("Zero-based index of the input query that produced this candidate."),
			query: z.string().describe("Search query that produced this candidate."),
			source: z.enum(["public", "user"]).describe("Fitatu catalog source for this candidate."),
			foodId: z.string().describe("Food id to pass to add_meal_items. Usually the same as productId."),
			productId: z.string().describe("Product id to pass to add_meal_items. Usually the same as foodId."),
			foodType: nullableStringSchema.describe("Fitatu food type to pass to add_meal_items when available."),
			name: nullableStringSchema.describe("Raw product or recipe name returned by Fitatu."),
			displayName: z.string().describe("Readable product label assembled from available Fitatu fields."),
			brand: nullableStringSchema.describe("Product brand or producer name when available."),
			measureId: nullableStringSchema.describe("Default measure id to pass to add_meal_items when appropriate."),
			measureName: nullableStringSchema.describe("Default measure name returned by Fitatu."),
			measureQuantity: nullableNumberSchema.describe(
				"Default quantity for the returned measure, when available.",
			),
			weightG: nullableNumberSchema.describe("Default measure weight in grams, when available."),
			kcal: nullableNumberSchema.describe("Energy in kcal for the default measure, when available."),
			nutritionPer100g: nutritionOutputSchema.describe(
				"Nutrition values per 100 grams, when Fitatu provides them.",
			),
			nutritionPerDefaultMeasure: nutritionOutputSchema.describe(
				"Nutrition values for the default measure, when available.",
			),
			verified: nullableBooleanSchema.describe("Whether Fitatu marks this product as verified."),
			photoUrl: nullableStringSchema.describe("Product photo URL when Fitatu provides one."),
			matchScore: z
				.number()
				.describe("Local text match score used for ranking candidates. Higher is generally better."),
			measures: z
				.array(measureOutputSchema)
				.describe(
					"Available measures from product details. Use these measureId values when default measure is unsuitable.",
				),
		}),
	),
	warnings: z.array(z.string()).describe("Non-fatal warnings produced while searching or fetching details."),
	warningDetails: z.array(warningDetailOutputSchema).describe("Structured details for non-fatal warnings."),
	message: z.string().describe("Human-readable summary of the search result."),
};

const inputSchema = {
	queries: z
		.array(z.string().min(1))
		.min(1)
		.describe("One or more product search phrases. Use a single-element array when looking up one product."),
	date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format")
		.optional()
		.describe("YYYY-MM-DD date used for user food search context. Defaults to the local current date."),
	locale: z.string().min(1).default("pl_PL").optional().describe("Fitatu search locale. Defaults to pl_PL."),
	limit: z
		.number()
		.int()
		.min(1)
		.max(50)
		.default(10)
		.optional()
		.describe(
			"Maximum candidates per query per source. Use 10-20 when an agent needs enough options to choose from.",
		),
	includeUserFood: z
		.boolean()
		.default(true)
		.optional()
		.describe("Whether to search the authenticated user's custom foods and history."),
	includePublicFood: z.boolean().default(true).optional().describe("Whether to search Fitatu's public food catalog."),
	includeDetails: z
		.boolean()
		.default(true)
		.optional()
		.describe("Whether to fetch product details for top candidates, including additional measures."),
	detailsLimit: z
		.number()
		.int()
		.min(0)
		.max(50)
		.default(3)
		.optional()
		.describe(
			"Number of top candidates per query to enrich with product details and measures. Use 0 to skip details.",
		),
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
					"Searches Fitatu food catalogs for product ids and measure ids. Provide one or more product search phrases in queries; use a single-element array for one product. Use returned foodId/productId and measureId values with add_meal_items. For meal planning or adding multiple meal items, start with one precise query per desired product and use limit 10-20 when you need enough candidates to choose from. Inspect returned candidates before searching again. Only run follow-up searches for products that remain unresolved, using improved or simplified query text. Avoid repeatedly searching many synonyms for the same product before inspecting the first batched result.",
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
