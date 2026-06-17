import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FitatuUserClient } from "../api/users/FitatuUserClient.ts";
import type { FitatuUserProfile } from "../api/users/FitatuUserProfile.ts";
import { createTextResult } from "../lib/utils.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const nullableString = z.string().nullable();
const nullableBoolean = z.boolean().nullable();

const currentUserOutputSchema = {
	user: z
		.object({
			id: nullableString.describe("Authenticated Fitatu user id."),
			username: nullableString.describe("Fitatu username or email when available."),
			nickname: nullableString.describe("Fitatu display nickname when available."),
			locale: nullableString.describe("User interface locale configured in Fitatu."),
			storageLocale: nullableString.describe("Fitatu storage locale used for account data."),
			searchLocale: nullableString.describe("Preferred locale for Fitatu search results."),
			timezone: nullableString.describe("User timezone configured in Fitatu."),
			weightUnit: nullableString.describe("Preferred weight unit configured in Fitatu."),
			sizeUnit: nullableString.describe("Preferred body size unit configured in Fitatu."),
			enabled: nullableBoolean.describe("Whether the Fitatu account is enabled."),
			demo: nullableBoolean.describe("Whether the Fitatu account is marked as a demo account."),
			hasDietSettings: nullableBoolean.describe("Whether the user has diet settings configured."),
			hasUserSettings: nullableBoolean.describe("Whether the user has general settings configured."),
		})
		.describe("Safe subset of the authenticated Fitatu user profile."),
};

type SafeCurrentUser = z.infer<typeof currentUserOutputSchema.user>;

export class GetCurrentUserTool {
	public readonly name = "get_current_user";

	private readonly userClient: FitatuUserClient;

	public constructor(userClient: FitatuUserClient = FitatuUserClient.getInstance()) {
		this.userClient = userClient;
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
					const user = await this.userClient.getAuthenticatedUser();
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
			id: user.id ?? null,
			username: user.username ?? null,
			nickname: user.nickname ?? null,
			locale: user.locale ?? null,
			storageLocale: user.storageLocale ?? null,
			searchLocale: user.searchLocale ?? null,
			timezone: user.timezone ?? null,
			weightUnit: user.weightUnit ?? null,
			sizeUnit: user.sizeUnit ?? null,
			enabled: user.enabled ?? null,
			demo: user.demo ?? null,
			hasDietSettings: user.hasDietSettings ?? null,
			hasUserSettings: user.hasUserSettings ?? null,
		};
	}
}
