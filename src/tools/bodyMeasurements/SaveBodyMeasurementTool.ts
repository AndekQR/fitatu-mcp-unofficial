import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BODY_MEASUREMENT_VALUE_FIELDS } from "../../api/bodyMeasurements/BodyMeasurementValueField.ts";
import type { BodyMeasurementValues } from "../../api/bodyMeasurements/BodyMeasurementValueField.ts";
import type { BodyMeasurementProvider } from "../../services/bodyMeasurements/BodyMeasurementService.ts";
import { SaveBodyMeasurementInput } from "../../services/bodyMeasurements/SaveBodyMeasurementInput.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import { bodyMeasurementSchema, toBodyMeasurementForMcp } from "./BodyMeasurementToolSupport.ts";

const MAXIMUM_FAT_PERCENTAGE = 100;

const positiveMeasurementSchema = z.number().finite().positive();
const circumferenceSchema = positiveMeasurementSchema.optional();

const saveBodyMeasurementInputSchema = z
	.object({
		date: isoCalendarDateSchema().describe("Measurement date in YYYY-MM-DD format."),
		weight: positiveMeasurementSchema
			.optional()
			.describe("Body weight in the account's weight unit, usually kilograms."),
		neck: circumferenceSchema.describe("Neck circumference in the account's size unit, usually centimetres."),
		chest: circumferenceSchema.describe("Chest circumference in the account's size unit."),
		waist: circumferenceSchema.describe("Waist circumference in the account's size unit."),
		stomach: circumferenceSchema.describe("Stomach circumference in the account's size unit."),
		hips: circumferenceSchema.describe("Hips circumference in the account's size unit."),
		thigh: circumferenceSchema.describe("Thigh circumference in the account's size unit."),
		calf: circumferenceSchema.describe("Calf circumference in the account's size unit."),
		biceps: circumferenceSchema.describe("Biceps circumference in the account's size unit."),
		fatPercentage: positiveMeasurementSchema
			.max(MAXIMUM_FAT_PERCENTAGE)
			.optional()
			.describe("Body fat percentage between 0 and 100."),
	})
	.strict()
	.refine((input) => BODY_MEASUREMENT_VALUE_FIELDS.some((field) => input[field] !== undefined), {
		message: "Provide at least one measurement value",
	});

const saveBodyMeasurementOutputSchema = {
	date: z.string().describe("Date the measurement was written to, in YYYY-MM-DD format."),
	measurement: bodyMeasurementSchema.describe("Measurement Fitatu persisted for that date after the update."),
};

export class SaveBodyMeasurementTool {
	public static readonly toolName = "save_body_measurement";

	private readonly bodyMeasurementService: Pick<BodyMeasurementProvider, "saveMeasurement">;

	public constructor(bodyMeasurementService: Pick<BodyMeasurementProvider, "saveMeasurement">) {
		this.bodyMeasurementService = bodyMeasurementService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			SaveBodyMeasurementTool.toolName,
			{
				title: "Save Fitatu Body Measurement",
				description:
					"Writes body weight and optional circumferences to the authenticated user's Fitatu measurement for one YYYY-MM-DD date. Provided fields are merged into that date's existing entry, so a weight-only call leaves other measurements untouched. Units come from the Fitatu profile, and the returned measurement is the state Fitatu persisted. Fitatu cannot clear a stored value through this endpoint.",
				inputSchema: saveBodyMeasurementInputSchema,
				outputSchema: saveBodyMeasurementOutputSchema,
				annotations: {
					title: "Save Fitatu Body Measurement",
					readOnlyHint: false,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async (input) => {
				try {
					const measurement = await this.bodyMeasurementService.saveMeasurement(
						new SaveBodyMeasurementInput(input.date, toBodyMeasurementValues(input)),
					);
					return createTextResult({
						date: measurement.date,
						measurement: toBodyMeasurementForMcp(measurement),
					});
				} catch (error) {
					return ToolErrorResult.create(
						SaveBodyMeasurementTool.toolName,
						"Unable to save the Fitatu body measurement.",
						error,
					);
				}
			},
		);
	}
}

function toBodyMeasurementValues(input: z.infer<typeof saveBodyMeasurementInputSchema>): BodyMeasurementValues {
	const values: Record<string, number> = {};

	for (const field of BODY_MEASUREMENT_VALUE_FIELDS) {
		const value = input[field];
		if (value !== undefined) {
			values[field] = value;
		}
	}

	return values;
}
