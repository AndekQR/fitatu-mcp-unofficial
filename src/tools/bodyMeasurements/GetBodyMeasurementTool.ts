import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BodyMeasurementService } from "../../services/bodyMeasurements/BodyMeasurementService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	bodyMeasurementNullKeys,
	bodyMeasurementSchema,
	toBodyMeasurementForMcp,
} from "./BodyMeasurementToolSchemas.ts";

const getBodyMeasurementOutputSchema = z
	.object({
		date: isoCalendarDateSchema()
			.optional()
			.describe(
				"Resolved measurement date in YYYY-MM-DD format. Omitted only when the latest measurement was requested and no history exists.",
			),
		found: z.boolean().describe("Whether Fitatu has a body measurement entry for the requested or latest date."),
		measurement: bodyMeasurementSchema.optional().describe("Complete body measurement when found is true."),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.found !== (value.measurement !== undefined)) {
			context.addIssue({
				code: "custom",
				message: "measurement must be present exactly when found is true",
				path: ["measurement"],
			});
		}
		if (value.found && value.date === undefined) {
			context.addIssue({ code: "custom", message: "date must be present when found is true", path: ["date"] });
		}
	})
	.meta({
		oneOf: [
			{
				properties: { found: { const: false } },
				required: ["found"],
				not: { required: ["measurement"] },
			},
			{
				properties: { found: { const: true } },
				required: ["date", "found", "measurement"],
			},
		],
	});

export class GetBodyMeasurementTool {
	public static readonly toolName = "get_body_measurement";
	private readonly bodyMeasurementService: BodyMeasurementService;

	public constructor(bodyMeasurementService: BodyMeasurementService) {
		this.bodyMeasurementService = bodyMeasurementService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			GetBodyMeasurementTool.toolName,
			{
				title: "Get Fitatu Body Measurement",
				description:
					"Gets the authenticated Fitatu user's body measurement for an optional calendar date. When date is omitted, returns the most recent measurement across weight, circumference, and body-fat history.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema()
							.optional()
							.describe(
								"Optional measurement date in YYYY-MM-DD format; defaults to the latest available entry.",
							),
					})
					.strict(),
				outputSchema: getBodyMeasurementOutputSchema,
				annotations: {
					title: "Get Fitatu Body Measurement",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ date }) => {
				try {
					const measurement = await this.bodyMeasurementService.getBodyMeasurement(date);
					return createTextResult(
						measurement === null
							? date === undefined
								? { found: false }
								: { date, found: false }
							: {
									date: measurement.date,
									found: true,
									measurement: toBodyMeasurementForMcp(measurement),
								},
						{ keepNullKeys: bodyMeasurementNullKeys },
					);
				} catch (error) {
					return ToolErrorResult.create(
						GetBodyMeasurementTool.toolName,
						"Unable to get the Fitatu body measurement.",
						error,
					);
				}
			},
		);
	}
}
