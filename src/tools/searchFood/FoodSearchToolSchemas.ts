import { z } from "zod";
import { fitatuClientErrorOutputSchema } from "../shared/FitatuClientErrorOutputSchema.ts";
import { rawRecipeIdSchema } from "../shared/ToolSchemas.ts";

export const foodMeasureOutputSchema = z.object({
	measureId: z.string().optional().describe("Measure id to pass to add_meal_items or update_meal_item."),
	measureName: z.string().optional().describe("Human-readable measure name, for example serving, package, or gram."),
	weightG: z.number().optional().describe("Measure weight in grams, omitted when unknown."),
	unit: z.string().optional().describe("Fitatu unit key for the measure, when available."),
	energyKcal: z.number().optional().describe("Energy for one unit of this measure in kcal, when available."),
});

export const foodSearchWarningDetailOutputSchema = z.object({
	message: z.string().describe("Human-readable warning message."),
	clientError: fitatuClientErrorOutputSchema.describe(
		"Complete safe Fitatu client error that produced this warning.",
	),
	query: z.string().optional().describe("Search query related to the warning, when applicable."),
	source: z.enum(["public", "user"]).optional().describe("Catalog source related to the warning, when applicable."),
});

const foodCandidateBaseShape = {
	index: z
		.number()
		.int()
		.nonnegative()
		.describe("Zero-based index of this candidate within its source across all result groups."),
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
	measures: z
		.array(foodMeasureOutputSchema)
		.optional()
		.describe("Available measures from product details. Use these when the default measure is unsuitable."),
};

export const foodCandidateOutputSchema = z.union([
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
