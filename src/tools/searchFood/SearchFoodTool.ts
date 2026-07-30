import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FoodSearchOptions } from "../../api/foodSearch/FoodSearchOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { FoodSearchProvider } from "../../services/foodSearch/FoodSearchService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { rawRecipeIdSchema } from "../shared/ToolSchemas.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
	fitatuClientErrorOutputSchema,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { FoodSearchResultForMcp } from "./FoodSearchResultForMcp.ts";

const measureOutputSchema = z.object({
	measureId: z.string().optional().describe("Measure id to pass to add_meal_items or update_meal_item."),
	measureName: z.string().optional().describe("Human-readable measure name, for example serving, package, or gram."),
	weightG: z.number().optional().describe("Measure weight in grams, omitted when unknown."),
	unit: z.string().optional().describe("Fitatu unit key for the measure, when available."),
	energyKcal: z.number().optional().describe("Energy for one unit of this measure in kcal, when available."),
});

const warningDetailOutputSchema = z.object({
	message: z.string().describe("Human-readable warning message."),
	clientError: fitatuClientErrorOutputSchema.describe(
		"Complete safe Fitatu client error that produced this warning.",
	),
	query: z.string().optional().describe("Search query related to the warning, when applicable."),
	source: z.enum(["public", "user"]).optional().describe("Catalog source related to the warning, when applicable."),
});

const foodCandidateBaseShape = {
	index: z.number().int().describe("Zero-based global index of this candidate across all result groups."),
	source: z.enum(["public", "user"]).describe("Fitatu catalog source for this candidate."),
	name: z.string().optional().describe("Raw product or recipe name returned by Fitatu."),
	displayName: z.string().describe("Readable product label assembled from available Fitatu fields."),
	brand: z.string().optional().describe("Product brand or producer name when available."),
	measureId: z.string().optional().describe("Default measure id to pass to add_meal_items when appropriate."),
	measureName: z.string().optional().describe("Default measure name returned by Fitatu."),
	measureQuantity: z.number().optional().describe("Default quantity for the returned measure, when available."),
	weightG: z.number().optional().describe("Default measure weight in grams, when available."),
	kcal: z.number().optional().describe("Energy in kcal for the default measure, when available."),
	verified: z.boolean().optional().describe("Whether Fitatu marks this product as verified."),
	photoUrl: z.string().optional().describe("Product photo URL when Fitatu provides one."),
	matchScore: z.number().describe("Local text match score used for ranking candidates. Higher is generally better."),
	measures: z
		.array(measureOutputSchema)
		.optional()
		.describe("Available measures from product details. Use these when the default measure is unsuitable."),
};

const foodCandidateOutputSchema = z.union([
	z
		.object({
			...foodCandidateBaseShape,
			productId: z
				.string()
				.describe(
					"Product candidate identifier. Copy productId with a listed measureId to the PRODUCT variant of add_meal_items; do not send recipeId.",
				),
		})
		.strict()
		.describe("PRODUCT candidate identified by productId."),
	z
		.object({
			...foodCandidateBaseShape,
			recipeId: rawRecipeIdSchema.describe(
				"Recipe candidate identifier. Copy raw recipeId with a listed measureId to the RECIPE variant of add_meal_items; do not send productId.",
			),
		})
		.strict()
		.describe("RECIPE candidate identified by recipeId."),
]);

const foodSearchOutputSchema = {
	queryCount: z.number().int().describe("Number of search queries processed by this call."),
	resultCount: z.number().int().describe("Total number of returned candidate items across all queries."),
	results: z
		.array(
			z.object({
				queryIndex: z.number().int().describe("Zero-based index of the input query for this result group."),
				query: z.string().describe("Search query for this result group."),
				count: z.number().int().describe("Number of returned candidate items for this query."),
				items: z.array(foodCandidateOutputSchema).describe("Candidate items returned for this query."),
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
		.describe("One or more food search phrases. Use a single-element array when looking up one item."),
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
			"Whether to include additional product or recipe information and available measures. These details can be useful when adding a selected item to a day plan. Defaults to false.",
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

	private readonly foodSearchService: FoodSearchProvider;

	public constructor(foodSearchService: FoodSearchProvider) {
		this.foodSearchService = foodSearchService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Search Fitatu Food",
				description:
					"Searches Fitatu catalogs for products and recipes. Set includeDetails=true to include additional information and available measures. These details can be useful when adding a selected item to a day plan. A candidate has exactly one definition id: productId means use the PRODUCT add_meal_items variant; raw recipeId means use the RECIPE variant. Copy that id with a listed measureId. Do not send foodType. Candidates with no positive local text match are omitted and reported as low-confidence warnings.",
				inputSchema: z.object(inputSchema).strict(),
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
					const result = await this.foodSearchService.search(
						new FoodSearchOptions(
							input.queries,
							undefined,
							input.locale,
							input.limit,
							input.includeUserFood,
							input.includePublicFood,
							input.includeDetails,
							input.detailsLimit,
						),
					);
					return createTextResult(new FoodSearchResultForMcp(result), {
						keepEmptyArrayKeys: ["items", ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS],
						keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS,
					});
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to search Fitatu food.", error);
				}
			},
		);
	}
}
