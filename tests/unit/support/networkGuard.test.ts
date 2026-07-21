import { describe, expect, it } from "vitest";

describe("unit test network guard", () => {
	it("rejects an unexpected request through the global fetch function", async () => {
		await expect(fetch("https://example.invalid/test")).rejects.toThrow(
			"Unexpected network request in a unit test",
		);
	});
});
