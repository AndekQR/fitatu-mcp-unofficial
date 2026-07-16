import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
		setupFiles: ["./tests/unit/setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			reportsDirectory: "coverage",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts"],
		},
	},
});
