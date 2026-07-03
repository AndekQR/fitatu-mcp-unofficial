import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DietSummaryService } from "../../services/dietSummary/DietSummaryService.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";

const optionalNumber = z.number().optional();
const nutrientStatusSchema = z.enum(["belowMin", "withinRange", "aboveMax", "noTarget", "noValue"]);

const nutrientSchema = z.object({
	key: z.string().describe("Original Fitatu nutrient or measure key."),
	label: z.string().describe("Human-readable nutrient label."),
	unit: z.string().optional().describe("Unit when known, for example kcal, g, mg, ug, or ml."),
	current: optionalNumber.describe("Fitatu current value for the selected period, when available."),
	min: optionalNumber.describe("Fitatu minimum target for the selected period, when available."),
	max: optionalNumber.describe("Fitatu maximum target for the selected period, when available."),
	eaten: optionalNumber.describe("Fitatu eaten value for the selected period, when available."),
	status: nutrientStatusSchema.describe("Interpretation of current against the available target range."),
	amountToMinimum: optionalNumber.describe("How much is missing to reach min, when below minimum."),
	amountOverMaximum: optionalNumber.describe("How much exceeds max, when above maximum."),
	remainingToMaximum: optionalNumber.describe("How much remains before max, when current is at or below maximum."),
});

const dietSummaryOutputSchema = {
	period: z
		.object({
			fromDate: z.string().describe("Inclusive range start date in YYYY-MM-DD format."),
			toDate: z.string().describe("Inclusive range end date in YYYY-MM-DD format."),
			dayCount: z.number().int().describe("Number of calendar days in the inclusive range."),
		})
		.describe("Date range covered by this summary."),
	energy: z
		.object({
			loggedTotal: z
				.number()
				.describe("Sum of daily energy values returned by Fitatu for logged/planned items, not only eaten=true items."),
			targetTotal: z.number().describe("Sum of daily energy targets returned by Fitatu."),
			averageLogged: z
				.number()
				.describe("Logged/planned energy averaged across every day in the selected range, including empty days as zero."),
			averageTarget: z.number().describe("Target energy averaged across every day in the selected range."),
			remainingToTarget: z.number().describe("Positive means remaining calories; negative means over target."),
			daily: z
				.array(
					z.object({
						date: z.string().describe("YYYY-MM-DD date."),
						logged: z
							.number()
							.describe("Logged/planned energy for the day; zero when Fitatu returned no daily measure."),
						target: optionalNumber.describe("Energy target for the day, when Fitatu returned it."),
						remainingToTarget: optionalNumber.describe("Target minus logged energy for the day, when a target exists."),
					}),
				)
				.describe("Daily energy target and logged/planned values."),
		})
		.describe("Energy totals and daily values from the energy summary endpoint."),
	keyNutrients: z.array(nutrientSchema).describe("High-signal nutrients selected for quick agent interpretation."),
	allNutrients: z.array(nutrientSchema).describe("All nutrients returned by Fitatu, normalized into a scannable list."),
};

export class GetDietSummaryTool {
	public readonly name = "get_diet_summary";

	private readonly dietSummaryService: DietSummaryService;

	public constructor(dietSummaryService: DietSummaryService) {
		this.dietSummaryService = dietSummaryService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Fitatu Diet Summary",
				description:
					"Fetches the authenticated Fitatu user's nutrition and energy summary for an inclusive date range.",
				inputSchema: {
					fromDate: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must use YYYY-MM-DD format")
						.describe("Inclusive range start date in YYYY-MM-DD format."),
					toDate: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must use YYYY-MM-DD format")
						.describe("Inclusive range end date in YYYY-MM-DD format."),
				},
				outputSchema: dietSummaryOutputSchema,
				annotations: {
					title: "Get Fitatu Diet Summary",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ fromDate, toDate }) => {
				try {
					const summary = await this.dietSummaryService.getDietSummary({ fromDate, toDate });
					return createTextResult(summary, { keepEmptyArrayKeys: ["keyNutrients", "allNutrients", "daily"] });
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to fetch Fitatu diet summary.", error);
				}
			},
		);
	}
}
