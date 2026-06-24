import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextResult } from "../shared/ToolResult.ts";
import { CurrentUserService } from "../../services/currentUser/CurrentUserService.ts";
import type { FitatuUserProfile } from "../../services/currentUser/CurrentUserTypes.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";

const optionalString = z.string().optional();
const optionalBoolean = z.boolean().optional();

const currentUserOutputSchema = {
	user: z
		.object({
			id: optionalString.describe("Authenticated Fitatu user id, when available."),
			username: optionalString.describe("Fitatu username or email when available."),
			nickname: optionalString.describe("Fitatu display nickname when available."),
			locale: optionalString.describe("User interface locale configured in Fitatu, when available."),
			storageLocale: optionalString.describe("Fitatu storage locale used for account data, when available."),
			searchLocale: optionalString.describe("Preferred locale for Fitatu search results, when available."),
			timezone: optionalString.describe("User timezone configured in Fitatu, when available."),
			weightUnit: optionalString.describe("Preferred weight unit configured in Fitatu, when available."),
			sizeUnit: optionalString.describe("Preferred body size unit configured in Fitatu, when available."),
			enabled: optionalBoolean.describe("Whether the Fitatu account is enabled, when available."),
			demo: optionalBoolean.describe("Whether the Fitatu account is marked as a demo account, when available."),
			hasDietSettings: optionalBoolean.describe("Whether the user has diet settings configured, when available."),
			hasUserSettings: optionalBoolean.describe("Whether the user has general settings configured, when available."),
		})
		.describe("Safe subset of the authenticated Fitatu user profile."),
};

type SafeCurrentUser = z.infer<typeof currentUserOutputSchema.user>;

export class GetCurrentUserTool {
	public readonly name = "get_current_user";

	private readonly currentUserService: CurrentUserService;

	public constructor(currentUserService: CurrentUserService) {
		this.currentUserService = currentUserService;
	}

	public register(server: McpServer): void {
		server.registerTool(
			this.name,
			{
				title: "Get Current Fitatu User",
				description: "Fetches the currently authenticated Fitatu user profile.",
				inputSchema: {},
				outputSchema: currentUserOutputSchema,
				annotations: {
					title: "Get Current Fitatu User",
					readOnlyHint: true,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			async () => {
				try {
					const user = await this.currentUserService.getCurrentUser();
					return createTextResult({
						user: this.toSafeCurrentUser(user),
					});
				} catch (error) {
					return createToolErrorResult(this.name, "Unable to fetch the current Fitatu user.", error);
				}
			},
		);
	}

	private toSafeCurrentUser(user: FitatuUserProfile): SafeCurrentUser {
		return {
			id: user.id ?? undefined,
			username: user.username ?? undefined,
			nickname: user.nickname ?? undefined,
			locale: user.locale ?? undefined,
			storageLocale: user.storageLocale ?? undefined,
			searchLocale: user.searchLocale ?? undefined,
			timezone: user.timezone ?? undefined,
			weightUnit: user.weightUnit ?? undefined,
			sizeUnit: user.sizeUnit ?? undefined,
			enabled: user.enabled ?? undefined,
			demo: user.demo ?? undefined,
			hasDietSettings: user.hasDietSettings ?? undefined,
			hasUserSettings: user.hasUserSettings ?? undefined,
		};
	}
}
