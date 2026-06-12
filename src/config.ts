import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SERVER_NAME: z.string().default("mcp-typescript-template"),
  SERVER_VERSION: z.string().default("1.0.0"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  FITATU_EMAIL: z.string().email("FITATU_EMAIL must be a valid email address"),
  FITATU_PASSWORD: z.string().min(1, "FITATU_PASSWORD is required"),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

export function getConfig(): Config {
  if (!config) {
    try {
      config = configSchema.parse(process.env);
    } catch (error) {
      console.error("❌ Invalid environment configuration:", error);
      process.exit(1);
    }
  }
  return config;
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}
