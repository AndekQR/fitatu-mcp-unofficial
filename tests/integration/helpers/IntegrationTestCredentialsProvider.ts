import { z } from "zod";
import type { FitatuCredentials } from "../../../src/api/auth/FitatuCredentials.ts";

const integrationTestEnvironmentSchema = z.object({
	FITATU_INTEGRATION_EMAIL: z
		.string({ error: "FITATU_INTEGRATION_EMAIL is required" })
		.trim()
		.email("FITATU_INTEGRATION_EMAIL must be a valid email address"),
	FITATU_INTEGRATION_PASSWORD: z
		.string({ error: "FITATU_INTEGRATION_PASSWORD is required" })
		.min(1, "FITATU_INTEGRATION_PASSWORD is required"),
	FITATU_EMAIL: z.string().optional(),
});

export class IntegrationTestCredentialsProvider {
	private readonly credentials: FitatuCredentials;

	private constructor(credentials: FitatuCredentials) {
		this.credentials = credentials;
	}

	public static fromEnvironment(environment: NodeJS.ProcessEnv = process.env): IntegrationTestCredentialsProvider {
		const parsed = integrationTestEnvironmentSchema.parse(environment);
		if (
			parsed.FITATU_EMAIL !== undefined &&
			normalizeEmail(parsed.FITATU_EMAIL) === normalizeEmail(parsed.FITATU_INTEGRATION_EMAIL)
		) {
			throw new Error("FITATU_INTEGRATION_EMAIL must identify a different account than FITATU_EMAIL");
		}
		return new IntegrationTestCredentialsProvider({
			username: parsed.FITATU_INTEGRATION_EMAIL,
			password: parsed.FITATU_INTEGRATION_PASSWORD,
		});
	}

	public getCredentials(): FitatuCredentials {
		return this.credentials;
	}
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}
