import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ProductCreation } from "../../services/products/ProductCreation.ts";
import { ProductService } from "../../services/products/ProductService.ts";
import type { ProductWarning } from "../../services/products/ProductWarning.ts";
import { FoodMeasureForMcp } from "../searchFood/FoodMeasureForMcp.ts";
import { foodMeasureOutputSchema } from "../searchFood/FoodSearchToolSchemas.ts";
import {
	FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS,
	FITATU_CLIENT_ERROR_NULL_KEYS,
	fitatuClientErrorOutputSchema,
} from "../shared/FitatuClientErrorOutputSchema.ts";
import { FitatuClientErrorPublic } from "../shared/FitatuClientErrorPublic.ts";
import { nonEmptyStringSchema } from "../shared/ToolSchemas.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";

function nutritionSchema(fieldName: string, description: string) {
	return z.number().finite().nonnegative(`${fieldName} must be non-negative`).describe(description);
}

export const createProductInputSchema = {
	name: nonEmptyStringSchema("name").describe("Product name as it should appear in Fitatu."),
	brand: z.string().trim().optional().describe("Optional brand or manufacturer name."),
	barcode: z
		.string()
		.trim()
		.regex(/^\d*$/, "barcode must contain digits only")
		.optional()
		.describe("Optional EAN/UPC barcode, digits only."),
	energy: nutritionSchema("energy", "Energy in kcal per 100 g of product."),
	fat: nutritionSchema("fat", "Total fat in grams per 100 g of product."),
	carbohydrate: nutritionSchema("carbohydrate", "Total carbohydrate in grams per 100 g of product."),
	protein: nutritionSchema("protein", "Protein in grams per 100 g of product."),
	saturatedFat: nutritionSchema("saturatedFat", "Saturated fat in grams per 100 g of product.").optional(),
	sugars: nutritionSchema("sugars", "Sugars in grams per 100 g of product.").optional(),
	fiber: nutritionSchema("fiber", "Dietary fiber in grams per 100 g of product.").optional(),
	salt: nutritionSchema("salt", "Salt in grams per 100 g of product.").optional(),
};

const productWarningOutputSchema = z
	.object({
		code: z.enum(["PRODUCT_MEASURES_UNAVAILABLE", "GRAM_MEASURE_NOT_FOUND"]),
		message: z.string(),
		clientError: fitatuClientErrorOutputSchema
			.optional()
			.describe("Safe Fitatu client error from the failed read-back, when there was one."),
	})
	.describe("Non-fatal problem found after the product was already created.");

const PRODUCT_EMPTY_ARRAY_KEYS = ["measures", "warnings", ...FITATU_CLIENT_ERROR_EMPTY_ARRAY_KEYS];

export class CreateProductTool {
	public static readonly toolName = "create_product";
	private readonly productService: ProductService;

	public constructor(productService: ProductService) {
		this.productService = productService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			CreateProductTool.toolName,
			{
				title: "Create Fitatu Product",
				description:
					"Creates a persistent product in the user's own Fitatu catalog from nutrition values per 100 g, then reads it back to confirm it. The product stays in the account, and repeating the request creates a duplicate, so first check with search_food that a suitable product does not already exist. Returns { status, productId, name, gramMeasureId, measures, warnings }. To log the product, call add_meal_items with { productId, measureId: gramMeasureId, measureQuantity: <grams> }. status 'unconfirmed' means the product was created but the read-back failed: do not create it again. An error with code MUTATION_OUTCOME_UNKNOWN means Fitatu's answer was lost: the product may exist, so check with search_food before retrying.",
				inputSchema: createProductInputSchema,
				outputSchema: {
					status: z
						.enum(["confirmed", "unconfirmed"])
						.describe(
							"confirmed: created and read back. unconfirmed: created, but the read-back failed; do not retry.",
						),
					productId: z.string().describe("Id of the new product; pass it as productId to add_meal_items."),
					name: z.string().describe("Product name stored by Fitatu."),
					gramMeasureId: z
						.string()
						.optional()
						.describe(
							"measureId whose measureQuantity is a number of grams; omitted when the read-back did not expose one.",
						),
					measures: foodMeasureOutputSchema
						.array()
						.describe("Measures read back from Fitatu; empty when the read-back failed."),
					warnings: productWarningOutputSchema
						.array()
						.describe(
							"Non-fatal warnings: PRODUCT_MEASURES_UNAVAILABLE with status unconfirmed, GRAM_MEASURE_NOT_FOUND with status confirmed.",
						),
				},
				annotations: {
					title: "Create Fitatu Product",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: false,
					openWorldHint: true,
				},
			},
			async (input) => {
				try {
					const result = await this.productService.createProduct(
						new ProductCreation(
							input.name,
							input.brand || null,
							input.barcode || null,
							input.energy,
							input.fat,
							input.carbohydrate,
							input.protein,
							input.saturatedFat ?? null,
							input.sugars ?? null,
							input.fiber ?? null,
							input.salt ?? null,
						),
					);
					return createTextResult(
						{
							status: result.status,
							productId: result.productId,
							name: result.name,
							gramMeasureId: result.gramMeasureId,
							measures: result.measures.map((measure) => new FoodMeasureForMcp(measure)),
							warnings: result.warnings.map(toWarningForMcp),
						},
						{ keepEmptyArrayKeys: PRODUCT_EMPTY_ARRAY_KEYS, keepNullKeys: FITATU_CLIENT_ERROR_NULL_KEYS },
					);
				} catch (error) {
					return ToolErrorResult.create(
						CreateProductTool.toolName,
						"Unable to create Fitatu product.",
						error,
					);
				}
			},
		);
	}
}

function toWarningForMcp(warning: ProductWarning): Record<string, unknown> {
	return {
		code: warning.code,
		message: warning.message,
		clientError: warning.clientError ? new FitatuClientErrorPublic(warning.clientError) : null,
	};
}
