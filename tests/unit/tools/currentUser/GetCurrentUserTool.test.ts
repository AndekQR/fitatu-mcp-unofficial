import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import type { CurrentUserProvider } from "../../../../src/services/currentUser/CurrentUserService.ts";
import { GetCurrentUserTool } from "../../../../src/tools/currentUser/GetCurrentUserTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("GetCurrentUserTool", () => {
	it("returns only the safe public subset of the authenticated profile", async () => {
		const service = new FakeCurrentUserService(
			FitatuUserProfile.fromApiResponse({
				id: "user-1",
				nickname: "Test user",
				email: "sensitive@example.test",
				roles: ["ROLE_USER"],
				locale: "pl_PL",
				timezone: "Europe/Warsaw",
				enabled: true,
				demo: false,
			}),
		);
		const registered = await registerToolForTest(new GetCurrentUserTool(service));

		const result = await registered.invoke({});
		const expectedContent = {
			user: {
				id: "user-1",
				nickname: "Test user",
				locale: "pl_PL",
				timezone: "Europe/Warsaw",
				enabled: true,
				demo: false,
			},
		};

		expect(service.requestCount).toBe(1);
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(result.structuredContent).toEqual(expectedContent);
		expect(parseTextContent(result)).toEqual(expectedContent);
		expect(getTextContent(result)).not.toContain("sensitive@example.test");
		expect(getTextContent(result)).not.toContain("ROLE_USER");
	});

	it("returns a safe structured error for a known user failure", async () => {
		const clientError = await FitatuClientError.http({
			operation: FITATU_CLIENT_OPERATIONS.usersGet,
			message: "Fitatu user request failed",
			method: "GET",
			endpointTemplate: "/users/:userId",
			response: new Response(null, { status: 503 }),
		});
		const service = new FakeCurrentUserService(undefined, clientError);
		const registered = await registerToolForTest(new GetCurrentUserTool(service));

		const result = await registered.invoke({});

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "get_current_user",
			error: {
				source: "fitatuApi",
				name: "FitatuClientError",
				message: "Fitatu user request failed",
				operation: "users.get",
				failure: {
					kind: "http",
					method: "GET",
					endpointTemplate: "/users/:userId",
					statusCode: 503,
					statusText: null,
					upstreamCode: null,
					upstreamMessage: null,
					responseSnippet: null,
				},
				attempts: [],
			},
		});
		expect(result.structuredContent).toBeUndefined();
	});
});

class FakeCurrentUserService implements CurrentUserProvider {
	public requestCount = 0;

	public constructor(
		private readonly user?: FitatuUserProfile,
		private readonly error?: Error,
	) {}

	public async getCurrentUser(): Promise<FitatuUserProfile> {
		this.requestCount += 1;
		if (this.error) {
			throw this.error;
		}
		if (!this.user) {
			throw new Error("FakeCurrentUserService requires a user or error");
		}

		return this.user;
	}
}
