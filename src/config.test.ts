import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

async function loadConfigWithEnv(env: NodeJS.ProcessEnv) {
	vi.resetModules();
	process.env = { ...originalEnv, ...env };
	return import("./config.ts");
}

describe("getConfig", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		process.env = originalEnv;
	});

	it("reads Fitatu credentials from environment variables", async () => {
		const { getConfig, getFitatuPassword, getFitatuUsername } = await loadConfigWithEnv({
			FITATU_EMAIL: "test@example.com",
			FITATU_PASSWORD: "test-password",
		});

		expect(getConfig()).toMatchObject({
			FITATU_EMAIL: "test@example.com",
			FITATU_PASSWORD: "test-password",
		});
		expect(getFitatuUsername()).toBe("test@example.com");
		expect(getFitatuPassword()).toBe("test-password");
	});

	it("provides the current Fitatu mobile client profile by default", async () => {
		const { getFitatuMobileClientProfile } = await loadConfigWithEnv({
			FITATU_EMAIL: "test@example.com",
			FITATU_PASSWORD: "test-password",
			FITATU_USER_AGENT: undefined,
			FITATU_APP_VERSION: undefined,
			FITATU_API_APK_UUID: undefined,
		});

		expect(getFitatuMobileClientProfile()).toEqual({
			userAgent: "Dart/3.10 (dart:io)",
			appVersion: "4.14.4",
			apiApkUuid: "BE4B.251210.005",
		});
	});

	it("allows the mobile client profile to be updated through environment variables", async () => {
		const { getFitatuMobileClientProfile } = await loadConfigWithEnv({
			FITATU_EMAIL: "test@example.com",
			FITATU_PASSWORD: "test-password",
			FITATU_USER_AGENT: "Dart/3.11 (dart:io)",
			FITATU_APP_VERSION: "4.15.0",
			FITATU_API_APK_UUID: "BUILD.123",
		});

		expect(getFitatuMobileClientProfile()).toEqual({
			userAgent: "Dart/3.11 (dart:io)",
			appVersion: "4.15.0",
			apiApkUuid: "BUILD.123",
		});
	});

	it("exits when Fitatu email is invalid", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const exit = vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit called");
		}) as never);

		const { getConfig } = await loadConfigWithEnv({
			FITATU_EMAIL: "not-an-email",
			FITATU_PASSWORD: "test-password",
		});

		expect(() => getConfig()).toThrow("process.exit called");
		expect(exit).toHaveBeenCalledWith(1);
		expect(consoleError).toHaveBeenCalled();
	});

	it("initializes the logger without requiring Fitatu credentials", async () => {
		vi.resetModules();
		process.env = {
			...originalEnv,
			NODE_ENV: "test",
			SERVER_NAME: "fitatu-mcp-test",
			SERVER_VERSION: "test-version",
			LOG_LEVEL: "warn",
			FITATU_EMAIL: undefined,
			FITATU_PASSWORD: undefined,
		};

		const { logger } = await import("./logger.ts");

		expect(logger.level).toBe("warn");
		expect(logger.bindings()).toMatchObject({ service: "fitatu-mcp-test", version: "test-version" });
	});

	it("exits safely when logger configuration is invalid", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const exit = vi.spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit called");
		}) as never);
		vi.resetModules();
		process.env = {
			...originalEnv,
			LOG_LEVEL: "verbose",
			FITATU_EMAIL: undefined,
			FITATU_PASSWORD: undefined,
		};

		await expect(import("./logger.ts")).rejects.toThrow("process.exit called");
		expect(exit).toHaveBeenCalledWith(1);
		expect(consoleError).toHaveBeenCalled();
	});
});
