import { afterEach, describe, expect, it } from "vitest";
import { IntegrationTestContext } from "../helpers/IntegrationTestContext.ts";

const authClient = IntegrationTestContext.fromEnvironment().authClient;

describe.sequential("Fitatu auth token refresh integration", () => {
	afterEach(() => {
		authClient.clearSession();
	});

	it("refreshes an authenticated session with the login refresh token", async () => {
		authClient.clearSession();

		const initialSession = await authClient.getSession();

		expect(initialSession.token).toEqual(expect.any(String));
		expect(initialSession.refreshToken).toEqual(expect.any(String));
		expect(initialSession.fitatuUserId).toEqual(expect.any(String));

		const refreshedSession = await authClient.refreshSession();

		expect(refreshedSession.token).toEqual(expect.any(String));
		expect(refreshedSession.refreshToken).toEqual(expect.any(String));
		expect(refreshedSession.fitatuUserId).toBe(initialSession.fitatuUserId);
		expect(await authClient.getSession()).toEqual(refreshedSession);
	});
});
