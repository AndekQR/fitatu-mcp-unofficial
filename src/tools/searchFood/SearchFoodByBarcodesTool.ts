import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FoodSearchResult } from "../../api/foodSearch/FoodSearchResult.ts";
import type { FoodSearchService } from "../../services/foodSearch/FoodSearchService.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
	fitatuClientErrorOutputSchema,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { FitatuClientErrorPublic } from "../shared/FitatuClientErrorPublic.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { foodCandidateOutputSchema } from "./FoodSearchToolSchemas.ts";
import { FoodSearchItemForMcp } from "./FoodSearchItemForMcp.ts";

const barcodeSchema = z
	.string()
	.trim()
	.regex(/^(?:\d{8}|\d{12,14})$/, "barcode must contain 8, 12, 13, or 14 digits");

const barcodeWarningDetailOutputSchema = z.object({
	message: z.string().describe("Human-readable warning message."),
	clientError: fitatuClientErrorOutputSchema.describe(
		"Complete safe Fitatu client error that produced this warning.",
	),
	barcode: z.string().optional().describe("Barcode related to the warning, when applicable."),
});

const outputSchema = {
	results: z
		.array(
			z
				.object({
					barcode: barcodeSchema.describe("Input barcode represented by this result group."),
					items: z
						.array(foodCandidateOutputSchema)
						.describe("All unique public Fitatu candidates for this barcode, in Fitatu order."),
				})
				.strict(),
		)
		.describe("One result group for every input barcode, preserving input order and duplicates."),
	warnings: z.array(z.string()).optional().describe("Non-fatal warnings produced by barcode searches or enrichment."),
	warningDetails: z
		.array(barcodeWarningDetailOutputSchema)
		.optional()
		.describe("Structured details for non-fatal barcode search warnings."),
};

export class SearchFoodByBarcodesTool {
	public static readonly toolName = "search_food_by_barcodes";
	public readonly name = SearchFoodByBarcodesTool.toolName;

	private readonly foodSearchService: FoodSearchService;

	public constructor(foodSearchService: FoodSearchService) {
		this.foodSearchService = foodSearchService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Search Fitatu Food by Barcodes",
				description:
					"Searches Fitatu's public food catalog for up to 10 GTIN barcodes in parallel. Returns one minimal result group per input barcode in input order, including duplicates. Copy a selected productId and measureId to add_meal_items. This tool only searches and never adds food.",
				inputSchema: z
					.object({
						barcodes: z
							.array(barcodeSchema)
							.min(1)
							.max(10)
							.describe("One to ten GTIN-8, UPC-A, EAN-13, or GTIN-14 barcode strings."),
						includeDetails: z
							.boolean()
							.default(false)
							.optional()
							.describe("Whether to enrich top candidates with product details and available measures."),
						detailsLimit: z
							.number()
							.int()
							.min(0)
							.max(50)
							.default(3)
							.optional()
							.describe("Maximum candidates to enrich per barcode. Defaults to 3."),
					})
					.strict(),
				outputSchema,
				annotations: {
					title: "Search Fitatu Food by Barcodes",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ barcodes, includeDetails, detailsLimit }) => {
				try {
					const result = await this.foodSearchService.searchBarcodes(barcodes, includeDetails, detailsLimit);
					return createTextResult(toBarcodeSearchOutput(result), {
						keepEmptyArrayKeys: ["items", ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS],
						keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS,
					});
				} catch (error) {
					return ToolErrorResult.create(this.name, "Unable to search Fitatu food by barcodes.", error);
				}
			},
		);
	}
}

function toBarcodeSearchOutput(result: FoodSearchResult): object {
	const reusableItems = result.publicItems.filter((item) => item.foodType !== "CUSTOM_ITEM");
	const omittedCustomItems = result.publicItems.filter((item) => item.foodType === "CUSTOM_ITEM");

	return {
		results: result.queries.map((barcode, queryIndex) => ({
			barcode,
			items: reusableItems
				.filter((item) => item.queryIndex === queryIndex)
				.map((item) => new FoodSearchItemForMcp(item)),
		})),
		warnings: [
			...result.warnings,
			...omittedCustomItems.map(
				(item) =>
					`Omitted non-reusable CUSTOM_ITEM candidate "${item.displayName}" from barcode search results; create it directly with add_meal_items.`,
			),
		],
		warningDetails: result.warningDetails.map((detail) => ({
			message: detail.message,
			clientError: new FitatuClientErrorPublic(detail.clientError),
			barcode: detail.query,
		})),
	};
}
