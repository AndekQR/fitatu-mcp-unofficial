import { describe, expect, it } from "vitest";
import { createFetchStub, createJsonResponse } from "./httpTestDouble.ts";

describe("HTTP test double", () => {
	it("records a request and returns the configured JSON response", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ id: "user-1" }, { status: 201 }));

		const response = await fetchStub.fetchFn("https://fitatu.test/users", { method: "POST" });

		expect(fetchStub.calls).toEqual([{ input: "https://fitatu.test/users", init: { method: "POST" } }]);
		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ id: "user-1" });
	});

	it("fails when code makes more requests than the test configured", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ ok: true }));

		await fetchStub.fetchFn("https://fitatu.test/first");

		await expect(fetchStub.fetchFn("https://fitatu.test/unexpected")).rejects.toThrow(
			"Unexpected fetch call: no response configured for call 2",
		);
	});
});
