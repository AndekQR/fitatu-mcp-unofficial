import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/integration/**/*.test.ts"],
		fileParallelism: false,
		testTimeout: 120_000,
		hookTimeout: 90_000,
		sequence: {
			concurrent: false,
		},
	},
});
