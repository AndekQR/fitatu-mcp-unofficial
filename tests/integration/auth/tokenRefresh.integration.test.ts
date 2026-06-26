import { afterEach, describe, expect, it } from "vitest";
import { FitatuAuthClient } from "../../../src/api/auth/FitatuAuthClient.ts";

const authClient = FitatuAuthClient.getInstance();

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
