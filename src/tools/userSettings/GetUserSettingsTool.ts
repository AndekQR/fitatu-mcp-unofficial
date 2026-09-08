import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UserSettingsService } from "../../services/userSettings/UserSettingsService.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";
import { createTextResult } from "../shared/ToolResult.ts";
import {
	toUserSettingsForMcp,
	userSettingsNullKeys,
	userSettingsSnapshotOutputSchema,
} from "./UserSettingsToolSchemas.ts";

export class GetUserSettingsTool {
	public static readonly toolName = "get_user_settings";
	private readonly userSettingsService: UserSettingsService;

	public constructor(userSettingsService: UserSettingsService) {
		this.userSettingsService = userSettingsService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			GetUserSettingsTool.toolName,
			{
				title: "Get Fitatu User Settings",
				description:
					"Gets the authenticated Fitatu user's date-resolved energy, calculated, and water settings. When date is omitted, today is resolved in the user's Fitatu timezone.",
				inputSchema: z
					.object({
						date: isoCalendarDateSchema()
							.optional()
							.describe("Optional settings date in YYYY-MM-DD format; defaults to today in Fitatu."),
					})
					.strict(),
				outputSchema: z.object({ settings: userSettingsSnapshotOutputSchema }).strict(),
				annotations: {
					title: "Get Fitatu User Settings",
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async ({ date }) => {
				try {
					const settings = await this.userSettingsService.getUserSettings(date);
					return createTextResult(
						{ settings: toUserSettingsForMcp(settings) },
						{ keepNullKeys: userSettingsNullKeys },
					);
				} catch (error) {
					return ToolErrorResult.create(
						GetUserSettingsTool.toolName,
						"Unable to get Fitatu user settings.",
						error,
					);
				}
			},
		);
	}
}
