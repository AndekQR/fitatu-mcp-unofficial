import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BodyMeasurementService } from "../../services/bodyMeasurements/BodyMeasurementService.ts";
import { BodyMeasurementUpdate } from "../../services/bodyMeasurements/BodyMeasurementUpdate.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	bodyMeasurementNullKeys,
	bodyMeasurementSchema,
	toBodyMeasurementForMcp,
} from "./BodyMeasurementToolSchemas.ts";

const measurementValueSchema = z.number().positive("Measurement values must be greater than zero");
const saveBodyMeasurementInputSchema = z
	.object({
		date: isoCalendarDateSchema().describe("Measurement date in YYYY-MM-DD format."),
		weight: measurementValueSchema.optional().describe("Body weight in the profile's weight unit."),
		neck: measurementValueSchema.optional().describe("Neck circumference in the profile's size unit."),
		chest: measurementValueSchema.optional().describe("Chest circumference in the profile's size unit."),
		waist: measurementValueSchema.optional().describe("Waist circumference in the profile's size unit."),
		stomach: measurementValueSchema.optional().describe("Abdominal circumference in the profile's size unit."),
		hips: measurementValueSchema.optional().describe("Hip circumference in the profile's size unit."),
		thigh: measurementValueSchema.optional().describe("Thigh circumference in the profile's size unit."),
		calf: measurementValueSchema.optional().describe("Calf circumference in the profile's size unit."),
		biceps: measurementValueSchema.optional().describe("Upper-arm circumference in the profile's size unit."),
		fatPercentage: measurementValueSchema
			.max(100, "fatPercentage must be less than or equal to 100")
			.optional()
			.describe("Body fat percentage."),
	})
	.strict()
	.refine((value) => Object.keys(value).some((key) => key !== "date"), {
		message: "At least one body measurement value is required",
	})
	.meta({ minProperties: 2 });

export class SaveBodyMeasurementTool {
	public static readonly toolName = "save_body_measurement";
	private readonly bodyMeasurementService: BodyMeasurementService;

	public constructor(bodyMeasurementService: BodyMeasurementService) {
		this.bodyMeasurementService = bodyMeasurementService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			SaveBodyMeasurementTool.toolName,
			{
				title: "Save Fitatu Body Measurement",
				description:
					"Partially updates the authenticated Fitatu user's body measurement for an explicit date. Omitted values remain unchanged, and existing values cannot be cleared with this tool.",
				inputSchema: saveBodyMeasurementInputSchema,
				outputSchema: z.object({ measurement: bodyMeasurementSchema }).strict(),
				annotations: {
					title: "Save Fitatu Body Measurement",
					readOnlyHint: false,
					destructiveHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ date, weight, neck, chest, waist, stomach, hips, thigh, calf, biceps, fatPercentage }) => {
				try {
					const measurement = await this.bodyMeasurementService.saveBodyMeasurement(
						new BodyMeasurementUpdate(
							date,
							weight,
							neck,
							chest,
							waist,
							stomach,
							hips,
							thigh,
							calf,
							biceps,
							fatPercentage,
						),
					);
					return createTextResult(
						{ measurement: toBodyMeasurementForMcp(measurement) },
						{ keepNullKeys: bodyMeasurementNullKeys },
					);
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
