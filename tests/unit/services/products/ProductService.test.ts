import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FavouritesClient } from "../../../../src/api/users/FavouritesClient.ts";
import { ProductClient } from "../../../../src/api/products/ProductClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { ProductWriteInput } from "../../../../src/api/products/ProductWriteInput.ts";
import { ProductService } from "../../../../src/services/products/ProductService.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "test-user" });
const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "test-user", locale: "pl_PL" }),
	clearUserCache: () => undefined,
};

describe("ProductService", () => {
	it("creates a product, reads it back, and returns the 1 g measure as the gram measure", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			createJsonResponse({
				measures: [
					{ id: "GRAM", weight: 100 },
					{ id: 1, name: "g", weight: 1 },
				],
			}),
		);
		const service = createService(fetchStub);

		const result = await service.createProduct(product());

		expect(result).toMatchObject({ productId: "150968031", name: "Test bun", status: "confirmed" });
		expect(result.gramMeasureId).toBe("1");
		expect(result.measures.map((measure) => measure.measureId)).toEqual(["GRAM", "1"]);
		expect(result.warnings).toEqual([]);
		expect(fetchStub.calls.map((call) => call.init?.method ?? "GET")).toEqual(["POST", "GET"]);
		expect(fetchStub.calls[1]?.input).toBe("https://fitatu.test/api/products/150968031");
	});

	it("returns the created product with a warning instead of failing when the read-back fails", async () => {
		const notFound = () => createJsonResponse({ message: "missing" }, { status: 404 });
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			notFound(),
			notFound(),
			notFound(),
		);
		const service = createService(fetchStub);

		const result = await service.createProduct(product());

		expect(result).toMatchObject({
			productId: "150968031",
			status: "unconfirmed",
			gramMeasureId: null,
			measures: [],
		});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toMatchObject({
			code: "PRODUCT_MEASURES_UNAVAILABLE",
			message: expect.stringMatching(/was created.*Do not create it again/),
			clientError: { name: "FitatuClientError", operation: "food.details.get" },
		});
	});

	it("keeps the productId when the read-back payload cannot be decoded", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			createJsonResponse({ measures: [{ id: 1, name: "g", weight: "invalid" }] }),
		);
		const service = createService(fetchStub);

		const result = await service.createProduct(product());

		expect(result).toMatchObject({ productId: "150968031", status: "unconfirmed", measures: [] });
		expect(result.warnings[0]).toMatchObject({ code: "PRODUCT_MEASURES_UNAVAILABLE", clientError: null });
	});

	it("does not confirm a product whose read-back has no measures", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			createJsonResponse({}),
		);
		const service = createService(fetchStub);

		const result = await service.createProduct(product());

		expect(result).toMatchObject({ productId: "150968031", status: "unconfirmed", gramMeasureId: null });
		expect(result.warnings[0]).toMatchObject({
			code: "PRODUCT_MEASURES_UNAVAILABLE",
			message: expect.stringMatching(/no measures.*Do not create it again/),
		});
	});

	it("confirms a product without a gram measure and warns about it", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			createJsonResponse({ measures: [{ id: "GRAM", weight: 100 }] }),
		);
		const service = createService(fetchStub);

		const result = await service.createProduct(product());

		expect(result).toMatchObject({ status: "confirmed", gramMeasureId: null });
		expect(result.warnings.map((warning) => warning.code)).toEqual(["GRAM_MEASURE_NOT_FOUND"]);
	});

	it("reports an unknown outcome when the create response has no id", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ name: "Test bun" }, { status: 201 }));
		const service = createService(fetchStub);

		await expect(service.createProduct(product())).rejects.toMatchObject({
			name: "MutationConfirmationError",
			kind: "unconfirmed",
			code: "MUTATION_OUTCOME_UNKNOWN",
			message: expect.stringMatching(/may have accepted.*search_food/),
		});
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("reports an unknown outcome when the create request loses its connection", async () => {
		const service = createService({
			fetchFn: async () => {
				throw new TypeError("fetch failed");
			},
		});

		await expect(service.createProduct(product())).rejects.toMatchObject({
			code: "MUTATION_OUTCOME_UNKNOWN",
		});
	});

	it("reports an unknown outcome when the connection drops while the create response body streams", async () => {
		const body = new ReadableStream({
			start(controller) {
				controller.error(new TypeError("terminated"));
			},
		});
		const fetchStub = createFetchStub(new Response(body, { status: 201 }));
		const service = createService(fetchStub);

		await expect(service.createProduct(product())).rejects.toMatchObject({
			code: "MUTATION_OUTCOME_UNKNOWN",
		});
	});

	it("reports an unknown outcome when the create request hits a gateway timeout", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "timeout" }, { status: 504 }));
		const service = createService(fetchStub);

		await expect(service.createProduct(product())).rejects.toMatchObject({
			code: "MUTATION_OUTCOME_UNKNOWN",
		});
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("keeps a failure that happens before the create request as a plain error", async () => {
		const fetchStub = createFetchStub();
		const profileFailure = FitatuClientError.transport({
			message: "Fitatu user request failed",
			operation: "users.get",
			method: "GET",
			endpointTemplate: "/users/:userId",
			error: new TypeError("fetch failed"),
		});
		const options = {
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient: {
				getCurrentUser: async () => {
					throw profileFailure;
				},
				clearUserCache: () => undefined,
			},
		};
		const service = new ProductService(
			new ProductClient(options),
			new FoodSearchService(new FoodSearchClient(options), new FavouritesClient(options)),
		);

		await expect(service.createProduct(product())).rejects.toBe(profileFailure);
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("lets a Fitatu rejection of the create request surface as an error", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ message: "invalid" }, { status: 400 }));
		const service = createService(fetchStub);

		await expect(service.createProduct(product())).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "products.create",
			failure: { kind: "http", statusCode: 400 },
		});
		expect(fetchStub.calls).toHaveLength(1);
	});
});

function product(): ProductWriteInput {
	return new ProductWriteInput("Test bun", null, null, 395, 18, 51, 5.3, null, null, null, null);
}

function createService(fetchStub: Pick<ReturnType<typeof createFetchStub>, "fetchFn">): ProductService {
	const options = { baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn, authClient, userClient };
	return new ProductService(new ProductClient(options), new FoodSearchService(new FoodSearchClient(options), new FavouritesClient(options)));
}
