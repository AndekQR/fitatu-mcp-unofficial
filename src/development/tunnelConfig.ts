import { z } from "zod";

const port = z.coerce.number().int().min(1024).max(65535);

const schema = z.object({
	NGROK_DOMAIN: z.string().regex(/^[a-z0-9-]+\.ngrok-free\.(app|dev)$/),
	TUNNEL_PORT: port.default(3100),
	TUNNEL_PERSONAL_PORT: port.default(3000),
	TUNNEL_TEST_PORT: port.default(3001),
	FITATU_EMAIL: z.email(),
	FITATU_PASSWORD: z.string().min(1),
	FITATU_INTEGRATION_EMAIL: z.email(),
	FITATU_INTEGRATION_PASSWORD: z.string().min(1),
});

export type TunnelConfig = z.infer<typeof schema>;
export type Account = "personal" | "test";

export function readTunnelConfig(environment: NodeJS.ProcessEnv): TunnelConfig {
	const result = schema.safeParse(environment);

	if (!result.success) {
		const invalidFields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");

		throw new Error(`Invalid tunnel configuration: ${invalidFields}`);
	}

	const config = result.data;
	const ports = [config.TUNNEL_PORT, config.TUNNEL_PERSONAL_PORT, config.TUNNEL_TEST_PORT];

	if (new Set(ports).size !== 3) {
		throw new Error("Tunnel and account ports must be different.");
	}

	if (config.FITATU_EMAIL.toLowerCase() === config.FITATU_INTEGRATION_EMAIL.toLowerCase()) {
		throw new Error("Personal and test accounts must use different Fitatu emails.");
	}

	return config;
}
