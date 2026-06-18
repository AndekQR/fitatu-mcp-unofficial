import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import { createTextResult } from "../../lib/utils.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { FoodSearchResultForMcp } from "./FoodSearchResultForMcp.ts";

const measureOutputSchema = z.object({
	measureId: z.string().optional().describe("Measure id to pass to add_meal_items or update_meal_item."),
	measureName: z.string().optional().describe("Human-readable measure name, for example serving, package, or gram."),
	weightG: z.number().optional().describe("Measure weight in grams, omitted when unknown."),
	unit: z.string().optional().describe("Fitatu unit key for the measure, when available."),
	energyKcal: z.number().optional().describe("Energy for one unit of this measure in kcal, when available."),
});

const fitatuApiErrorOutputSchema = z.object({
	statusCode: z.number().int().describe("HTTP status code returned by Fitatu."),
	statusText: z.string().optional().describe("HTTP status text returned by Fitatu, when available."),
	method: z.string().describe("HTTP method used for the upstream Fitatu request."),
	path: z.string().describe("Fitatu API path that produced the warning or error."),
	upstreamMessage: z.string().optional().describe("Safe upstream error message returned by Fitatu, when available."),
	upstreamCode: z
		.union([z.string(), z.number()])
		.optional()
		.describe("Safe upstream error code returned by Fitatu, when available."),
	responseSnippet: z.string().optional().describe("Short safe snippet of the upstream response, when available."),
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
	queryCount: z.number().int().describe("Number of search queries processed by this call."),
	resultCount: z.number().int().describe("Total number of returned candidate items across all queries."),
	results: z
		.array(
			z.object({
				queryIndex: z.number().int().describe("Zero-based index of the input query for this result group."),
				query: z.string().describe("Search query for this result group."),
				count: z.number().int().describe("Number of returned candidate items for this query."),
				items: z
					.array(
						z.object({
							index: z
								.number()
								.int()
								.describe("Zero-based global index of this candidate across all result groups."),
							source: z.enum(["public", "user"]).describe("Fitatu catalog source for this candidate."),
							foodId: z
								.string()
								.describe("Food id to pass to add_meal_items. Usually the same as productId."),
							productId: z
								.string()
								.describe("Product id to pass to add_meal_items. Usually the same as foodId."),
							foodType: z
								.string()
								.optional()
								.describe("Fitatu food type to pass to add_meal_items when available."),
							name: z.string().optional().describe("Raw product or recipe name returned by Fitatu."),
							displayName: z
								.string()
								.describe("Readable product label assembled from available Fitatu fields."),
							brand: z.string().optional().describe("Product brand or producer name when available."),
							measureId: z
								.string()
								.optional()
								.describe("Default measure id to pass to add_meal_items when appropriate."),
							measureName: z.string().optional().describe("Default measure name returned by Fitatu."),
							measureQuantity: z
								.number()
								.optional()
								.describe("Default quantity for the returned measure, when available."),
							weightG: z.number().optional().describe("Default measure weight in grams, when available."),
							kcal: z
								.number()
								.optional()
								.describe("Energy in kcal for the default measure, when available."),
							verified: z.boolean().optional().describe("Whether Fitatu marks this product as verified."),
							photoUrl: z.string().optional().describe("Product photo URL when Fitatu provides one."),
							matchScore: z
								.number()
								.describe(
									"Local text match score used for ranking candidates. Higher is generally better.",
								),
							measures: z
								.array(measureOutputSchema)
								.optional()
								.describe(
									"Available measures from product details. Use these measureId values when default measure is unsuitable.",
								),
						}),
					)
					.describe("Candidate items returned for this query."),
			}),
		)
		.describe("Search results grouped by input query."),
	warnings: z
		.array(z.string())
		.optional()
		.describe("Non-fatal warnings produced while searching or fetching details."),
	warningDetails: z
		.array(warningDetailOutputSchema)
		.optional()
		.describe("Structured details for non-fatal warnings."),
};

const inputSchema = {
	queries: z
		.array(z.string().min(1))
		.min(1)
		.describe("One or more product search phrases. Use a single-element array when looking up one product."),
	locale: z.string().min(1).default("pl_PL").optional().describe("Fitatu search locale. Defaults to pl_PL."),
	limit: z
		.number()
		.int()
		.min(1)
		.max(50)
		.default(3)
		.optional()
		.describe("Maximum candidates per query per source. Defaults to 3 to keep responses compact."),
	includeUserFood: z
		.boolean()
		.default(true)
		.optional()
		.describe("Whether to search the authenticated user's custom foods and history."),
	includePublicFood: z.boolean().default(true).optional().describe("Whether to search Fitatu's public food catalog."),
	includeDetails: z
		.boolean()
		.default(false)
		.optional()
		.describe(
			"Whether to fetch product or recipe details for top candidates, including additional measures. Defaults to false.",
		),
	detailsLimit: z
		.number()
		.int()
		.min(0)
		.max(50)
		.default(3)
		.optional()
		.describe(
			"Number of top candidates per query to enrich with product or recipe details and measures. Use 0 to skip details.",
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
					"Searches Fitatu food catalogs for product ids and measure ids. Provide one precise query per desired product; use a single-element queries array for one product. Results are grouped by input query and default to 3 candidates per query per source to keep responses compact. For each result group, compare displayName/name, brand, source, matchScore, verified, kcal, default measureId/measureName/weightG, and measures[].measureId/measureName/weightG/energyKcal. Choose the candidate whose name, brand, weight, kcal, and measure best match that query and the user's requested portion. Next action: call add_meal_items with the selected foodId or productId, foodType when present, and the most appropriate measureId; use a measure from measures[] when the default measure is unsuitable. Only run follow-up searches for products that remain unresolved, using improved or simplified query text.",
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
					return createTextResult(new FoodSearchResultForMcp(result), {
						keepEmptyArrayKeys: ["items"],
						omitNullsAndEmptyArrays: true,
					});
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to search Fitatu food.", error);
				}
			},
		);
	}
}
