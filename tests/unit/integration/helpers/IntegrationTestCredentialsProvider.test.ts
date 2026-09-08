import { describe, expect, it } from "vitest";
import { IntegrationTestCredentialsProvider } from "../../../integration/helpers/IntegrationTestCredentialsProvider.ts";

describe("IntegrationTestCredentialsProvider", () => {
	it("provides dedicated integration credentials without runtime credentials", () => {
		const provider = IntegrationTestCredentialsProvider.fromEnvironment({
			FITATU_INTEGRATION_EMAIL: "integration@example.com",
			FITATU_INTEGRATION_PASSWORD: "integration-password",
			FITATU_EMAIL: undefined,
			FITATU_PASSWORD: undefined,
		});

		expect(provider.getCredentials()).toEqual({
			username: "integration@example.com",
			password: "integration-password",
		});
	});

	it("rejects the runtime account when its normalized email matches the integration account", () => {
		expect(() =>
			IntegrationTestCredentialsProvider.fromEnvironment({
				FITATU_INTEGRATION_EMAIL: " integration@example.com ",
				FITATU_INTEGRATION_PASSWORD: "integration-password",
				FITATU_EMAIL: "INTEGRATION@example.com",
			}),
		).toThrow("FITATU_INTEGRATION_EMAIL must identify a different account than FITATU_EMAIL");
	});

	it("rejects a missing integration email", () => {
		expect(() =>
			IntegrationTestCredentialsProvider.fromEnvironment({
				FITATU_INTEGRATION_PASSWORD: "integration-password",
			}),
		).toThrow("FITATU_INTEGRATION_EMAIL is required");
	});

	it("rejects a missing integration password", () => {
		expect(() =>
			IntegrationTestCredentialsProvider.fromEnvironment({
				FITATU_INTEGRATION_EMAIL: "integration@example.com",
			}),
		).toThrow("FITATU_INTEGRATION_PASSWORD is required");
	});

	it("rejects an invalid integration email", () => {
		expect(() =>
			IntegrationTestCredentialsProvider.fromEnvironment({
				FITATU_INTEGRATION_EMAIL: "not-an-email",
				FITATU_INTEGRATION_PASSWORD: "integration-password",
			}),
		).toThrow("FITATU_INTEGRATION_EMAIL must be a valid email address");
	});

	it("does not read the runtime password", () => {
		const environment = new Proxy<NodeJS.ProcessEnv>(
			{
				FITATU_INTEGRATION_EMAIL: "integration@example.com",
				FITATU_INTEGRATION_PASSWORD: "integration-password",
			},
			{
				get(target, property, receiver) {
					if (property === "FITATU_PASSWORD") {
						throw new Error("Runtime password must not be read");
					}
					return Reflect.get(target, property, receiver);
				},
			},
		);

		expect(IntegrationTestCredentialsProvider.fromEnvironment(environment).getCredentials()).toEqual({
			username: "integration@example.com",
			password: "integration-password",
		});
	});
});
