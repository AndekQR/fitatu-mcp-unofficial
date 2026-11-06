import { describe, expect, it } from "vitest";
import { ProductClient } from "../../../../src/api/products/ProductClient.ts";
import { ProductCreateResult } from "../../../../src/api/products/ProductCreateResult.ts";
import { ProductWriteInput } from "../../../../src/api/products/ProductWriteInput.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "test-user" });
const userClient = {
	getCurrentUser: async () =>
		FitatuUserProfile.fromApiResponse({ id: "test-user", locale: "pl_PL", searchLocale: "pl_PL" }),
	clearUserCache: () => undefined,
};

describe("ProductClient", () => {
	it("posts the web-app product payload and returns the new id and name", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }));
		const client = createClient(fetchStub);

		const result = await client.createProduct(
			new ProductWriteInput("Test bun", "Test brand", null, 395, 18, 51, 5.3, 9.3, 25, 1.5, 0.46),
		);

		expect(result).toBeInstanceOf(ProductCreateResult);
		expect(result).toEqual({ productId: "150968031", name: "Test bun" });
		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/products");
		expect(fetchStub.calls[0]?.init?.method).toBe("POST");
		const body = JSON.parse(String(fetchStub.calls[0]?.init?.body)) as Record<string, unknown>;
		expect(body).toMatchObject({
			name: "Test bun",
			brand: "Test brand",
			barcode: "",
			energy: 395,
			fat: 18,
			saturatedFat: 9.3,
			carbohydrate: 51,
			sugars: 25,
			fiber: 1.5,
			protein: 5.3,
			salt: 0.46,
			measures: [{ measureKey: "GRAM", measureUnit: "g", weight: 100 }],
		});
		expect(Object.keys(body)).toHaveLength(43);
		for (const field of ["animalProtein", "omega3", "cholesterol", "vitaminB12", "sodium", "iron"]) {
			expect(body[field]).toBeNull();
		}
	});

	it("sends omitted optional values as empty strings and nulls", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ id: 1 }, { status: 201 }));
		const client = createClient(fetchStub);

		const result = await client.createProduct(
			new ProductWriteInput("Plain product", null, null, 100, 1, 2, 3, null, null, null, null),
		);

		expect(result).toEqual({ productId: "1", name: "Plain product" });
		expect(JSON.parse(String(fetchStub.calls[0]?.init?.body))).toMatchObject({
			brand: "",
			barcode: "",
			saturatedFat: null,
			sugars: null,
			fiber: null,
			salt: null,
		});
	});

	it("rejects an empty name before making a Fitatu request", async () => {
		const fetchStub = createFetchStub();
		const client = createClient(fetchStub);

		await expect(
			client.createProduct(new ProductWriteInput("  ", null, null, 100, 1, 2, 3, null, null, null, null)),
		).rejects.toMatchObject({ name: "FitatuClientError", operation: "products.create" });
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("reports the upstream status when Fitatu rejects the product", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "invalid" }, { status: 400 }));
		const client = createClient(fetchStub);

		await expect(client.createProduct(validInput())).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "products.create",
			failure: { kind: "http", endpointTemplate: "/products", statusCode: 400 },
		});
	});

	it("rejects a create response without an id", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ name: "Test bun" }, { status: 201 }));
		const client = createClient(fetchStub);

		await expect(client.createProduct(validInput())).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "products.create",
			failure: { kind: "invalidResponse" },
		});
	});
});

function validInput(): ProductWriteInput {
	return new ProductWriteInput("Test bun", null, null, 395, 18, 51, 5.3, null, null, null, null);
}

function createClient(fetchStub: ReturnType<typeof createFetchStub>): ProductClient {
	return new ProductClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn: fetchStub.fetchFn,
		authClient,
		userClient,
	});
}
