import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoodSearchService } from "../../services/foodSearch/FoodSearchService.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { foodCandidateOutputSchema } from "./FoodSearchToolSchemas.ts";
import { FoodSearchItemForMcp } from "./FoodSearchItemForMcp.ts";

const outputSchema = {
	count: z.number().int().nonnegative().describe("Number of returned favourite items."),
	items: z
		.array(foodCandidateOutputSchema)
		.describe("Products and recipes the user marked as favourites, in Fitatu's order."),
};

export class GetFavouritesTool {
	public static readonly toolName = "get_favourites";
	public readonly name = GetFavouritesTool.toolName;

	private readonly foodSearchService: FoodSearchService;

	public constructor(foodSearchService: FoodSearchService) {
		this.foodSearchService = foodSearchService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Fitatu Favourite Foods",
				description:
					"Returns the products and recipes the user marked as favourites in Fitatu, in the same candidate shape as search_food. Prefer these items first when estimating or logging meals, because they reflect what the user actually eats; fall back to search_food only when no favourite fits. Optionally filter by phrase. A candidate has exactly one definition id: productId means the PRODUCT meal-item variant; recipeId means the RECIPE variant. Copy that id with its measureId to add_meal_items. This tool only reads and never changes favourites or meals.",
				inputSchema: z
					.object({
						phrase: z
							.string()
							.trim()
							.min(1)
							.optional()
							.describe("Optional text to filter favourites by name. Omit to list all favourites."),
						limit: z
							.number()
							.int()
							.min(1)
							.max(200)
							.default(50)
							.optional()
							.describe("Maximum number of favourites to return. Defaults to 50."),
					})
					.strict(),
				outputSchema,
				annotations: {
					title: "Get Fitatu Favourite Foods",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ phrase, limit }) => {
				try {
					const result = await this.foodSearchService.getFavouriteFoods(phrase, limit);
					const items = result.userItems
						.filter((item) => item.foodType !== "CUSTOM_ITEM")
						.map((item) => new FoodSearchItemForMcp(item));
					return createTextResult(
						{ count: items.length, items },
						{
							keepEmptyArrayKeys: ["items", ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS],
							keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS,
						},
					);
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to get Fitatu favourite foods.", error);
				}
			},
		);
	}
}
