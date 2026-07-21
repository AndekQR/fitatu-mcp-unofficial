import { z } from "zod";

const configSchema = z.object({
	PORT: z.coerce.number().default(3000),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	SERVER_NAME: z.string().default("fitatu-mcp"),
	SERVER_VERSION: z.string().default("1.0.0"),
	LOG_LEVEL: z.enum(["silent", "error", "warn", "info", "debug"]).default("info"),
	FITATU_EMAIL: z.string().email("FITATU_EMAIL must be a valid email address"),
	FITATU_PASSWORD: z.string().min(1, "FITATU_PASSWORD is required"),
});

const loggerConfigSchema = configSchema.pick({
	NODE_ENV: true,
	SERVER_NAME: true,
	SERVER_VERSION: true,
	LOG_LEVEL: true,
});

export type Config = z.infer<typeof configSchema>;
export type LoggerConfig = z.infer<typeof loggerConfigSchema>;

export function getConfig(): Config {
	return parseEnvironment(configSchema);
}

export function getLoggerConfig(): LoggerConfig {
	return parseEnvironment(loggerConfigSchema);
}

export function getFitatuUsername(): string {
	return getConfig().FITATU_EMAIL;
}

export function getFitatuPassword(): string {
	return getConfig().FITATU_PASSWORD;
}

export function isProduction(): boolean {
	return getConfig().NODE_ENV === "production";
}

export function isDevelopment(): boolean {
	return getConfig().NODE_ENV === "development";
}

function parseEnvironment<Output>(schema: z.ZodType<Output>): Output {
	try {
		return schema.parse(process.env);
	} catch (error) {
		console.error("❌ Invalid environment configuration:", error);
		process.exit(1);
	}
}
