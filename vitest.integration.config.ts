import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/integration/**/*.test.ts"],
		globalSetup: ["tests/integration/setup/testDayFinalizer.globalSetup.ts"],
		fileParallelism: false,
		testTimeout: 300_000,
		hookTimeout: 180_000,
		sequence: {
			concurrent: false,
		},
	},
});
