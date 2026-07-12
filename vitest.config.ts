import { defineConfig } from "vitest/config";
import { loadEnvFile } from "node:process";

const isIntegrationRun = process.argv.some((arg) => arg.includes("tests/integration"));

if (isIntegrationRun) {
	loadEnvFile(".env");
}

export default defineConfig({
	test: {
		...(isIntegrationRun
			? {
					fileParallelism: false,
					testTimeout: 120_000,
					hookTimeout: 90_000,
					sequence: {
						concurrent: false,
					},
				}
			: {
					setupFiles: ["./tests/unit/setup.ts"],
					exclude: ["tests/integration/**", "node_modules/**", "dist/**"],
				}),
	},
});
