import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FoodSearchOptions } from "../../api/foodSearch/FoodSearchOptions.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import type { FoodSearchProvider } from "../../services/foodSearch/FoodSearchService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { foodCandidateOutputSchema, foodSearchWarningDetailOutputSchema } from "./FoodSearchToolSchemas.ts";
import { FoodSearchResultForMcp } from "./FoodSearchResultForMcp.ts";

const foodSearchOutputSchema = {
	queryCount: z.number().int().nonnegative().describe("Number of search queries processed by this call."),
	resultCount: z
		.number()
		.int()
		.nonnegative()
		.describe("Total number of returned user and public candidate items across all queries."),
	results: z
		.array(
			z.object({
				queryIndex: z
					.number()
					.int()
					.nonnegative()
					.describe("Zero-based index of the input query for this result group."),
				query: z.string().describe("Search query for this result group."),
				count: z
					.number()
					.int()
					.nonnegative()
					.describe("Total number of returned user and public candidate items for this query."),
				userItems: z
					.array(foodCandidateOutputSchema)
					.describe("Candidates returned by Fitatu's authenticated user source, in Fitatu's order."),
				publicItems: z
					.array(foodCandidateOutputSchema)
					.describe("Candidates returned by Fitatu's public catalog, in Fitatu's order."),
			}),
		)
		.describe("Search results grouped by input query, with separate user and public source lists."),
	warnings: z
		.array(z.string())
		.optional()
		.describe("Non-fatal warnings produced while searching or fetching details."),
	warningDetails: z
		.array(foodSearchWarningDetailOutputSchema)
		.optional()
		.describe("Structured details for non-fatal warnings."),
};

const inputSchema = {
	queries: z
		.array(z.string().trim().min(1))
		.min(1)
		.describe(
			"One or more independent food search phrases. When a description is ambiguous or may use a retailer, producer, or private-label name, submit plausible query variants together in one call. Results remain grouped by input query.",
		),
	date: isoCalendarDateSchema()
		.optional()
		.describe("Date context for Fitatu's authenticated user search. Defaults to today's local date."),
	locale: z.string().trim().min(1).default("pl_PL").optional().describe("Fitatu search locale. Defaults to pl_PL."),
	limit: z
		.number()
		.int()
		.min(1)
		.max(50)
		.default(5)
		.optional()
		.describe("Maximum candidates per query per source. Defaults to 5."),
	includeUserFood: z
		.boolean()
		.default(true)
		.optional()
		.describe(
			"Whether to use Fitatu's authenticated user search source. Its exact composition and ordering are determined by Fitatu.",
		),
	includePublicFood: z.boolean().default(true).optional().describe("Whether to search Fitatu's public food catalog."),
	includeDetails: z
		.boolean()
		.default(false)
		.optional()
		.describe(
			"Whether to fetch additional product or recipe information and available measures. Leave false when the candidate's default measure is sufficient; enable it when the default measure is missing or an alternative measure is needed. Defaults to false.",
		),
	detailsLimit: z
		.number()
		.int()
		.min(0)
		.max(50)
		.default(3)
		.optional()
		.describe(
			"Total number of top candidates per query to enrich with product or recipe details and measures across both source lists. User candidates consume the quota first. Use 0 to skip details.",
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
					"Searches Fitatu catalogs for products and recipes. The server does not infer brand or retailer aliases; provide alternative phrases together in queries when needed. Each query returns separate userItems and publicItems lists in Fitatu's order; the server does not merge or deduplicate candidates across those sources. Set includeDetails=true only when an alternative or missing measure is needed. A candidate has exactly one definition id: productId means use the PRODUCT meal-item variant; raw recipeId means use the RECIPE variant. Copy that id with a listed measureId. Do not send foodType.",
				inputSchema: z
					.object(inputSchema)
					.strict()
					.refine(
						({ includeUserFood, includePublicFood }) =>
							includeUserFood !== false || includePublicFood !== false,
						{
							message: "At least one food source must be enabled",
							path: ["includePublicFood"],
						},
					)
					.describe("Food search request with at least one of includeUserFood or includePublicFood enabled."),
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
							input.date,
							input.locale,
							input.limit,
							input.includeUserFood,
							input.includePublicFood,
							input.includeDetails,
							input.detailsLimit,
						),
					);
					return createTextResult(new FoodSearchResultForMcp(result), {
						keepEmptyArrayKeys: ["userItems", "publicItems", ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS],
						keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS,
					});
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to search Fitatu food.", error);
				}
			},
		);
	}
}
