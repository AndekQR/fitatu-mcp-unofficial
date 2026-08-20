import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BodyMeasurementProvider } from "../../services/bodyMeasurements/BodyMeasurementService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import { bodyMeasurementSchema, toBodyMeasurementForMcp } from "./BodyMeasurementToolSupport.ts";

const getBodyMeasurementOutputSchema = {
	date: z.string().describe("Requested date in YYYY-MM-DD format."),
	found: z.boolean().describe("Whether Fitatu holds a measurement for that date."),
	measurement: bodyMeasurementSchema.optional().describe("Stored measurement, omitted when found is false."),
};

export class GetBodyMeasurementTool {
	public static readonly toolName = "get_body_measurement";

	private readonly bodyMeasurementService: Pick<BodyMeasurementProvider, "getMeasurement">;

	public constructor(bodyMeasurementService: Pick<BodyMeasurementProvider, "getMeasurement">) {
		this.bodyMeasurementService = bodyMeasurementService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			GetBodyMeasurementTool.toolName,
			{
				title: "Get Fitatu Body Measurement",
				description:
					"Returns the authenticated user's body measurement stored for one YYYY-MM-DD date. Fitatu keeps measurements per day and has no range endpoint, so a weight trend has to be read one date at a time. Days without an entry return found=false instead of an error.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema().describe("Measurement date in YYYY-MM-DD format."),
					})
					.strict(),
				outputSchema: getBodyMeasurementOutputSchema,
				annotations: {
					title: "Get Fitatu Body Measurement",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ date }) => {
				try {
					const measurement = await this.bodyMeasurementService.getMeasurement(date);
					return createTextResult({
						date,
						found: measurement !== null,
						measurement: measurement === null ? undefined : toBodyMeasurementForMcp(measurement),
					});
				} catch (error) {
					return ToolErrorResult.create(
						GetBodyMeasurementTool.toolName,
						"Unable to fetch the Fitatu body measurement.",
						error,
					);
				}
			},
		);
	}
}
