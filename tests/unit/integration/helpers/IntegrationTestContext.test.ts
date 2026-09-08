import { describe, expect, it, vi } from "vitest";
import { IntegrationTestContext } from "../../../integration/helpers/IntegrationTestContext.ts";

describe("IntegrationTestContext", () => {
	it("authenticates with the dedicated integration credentials", async () => {
		const token = `header.${Buffer.from(JSON.stringify({ sub: "integration-user" })).toString("base64url")}.signature`;
		const fetchFn = vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ token, refresh_token: "integration-refresh" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchFn);
		const context = IntegrationTestContext.fromEnvironment({
			FITATU_INTEGRATION_EMAIL: "integration@example.com",
			FITATU_INTEGRATION_PASSWORD: "integration-password",
		});

		await context.authClient.getSession();

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
			method: "POST",
			body: JSON.stringify({
				_username: "integration@example.com",
				_password: "integration-password",
			}),
		});
	});
});
