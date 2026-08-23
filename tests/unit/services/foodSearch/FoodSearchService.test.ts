import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "user-1" });

const userClient = {
	getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
	clearUserCache: () => undefined,
};

describe("FoodSearchService.searchBarcodes", () => {
	it("starts barcode searches concurrently and preserves input order", async () => {
		const resolvers = new Map<string, (response: Response) => void>();
		let markAllStarted: (() => void) | undefined;
		const allStarted = new Promise<void>((resolve) => {
			markAllStarted = resolve;
		});
		const fetchFn: typeof fetch = async (input) => {
			const barcode = new URL(String(input)).searchParams.get("phrase") ?? "";
			return new Promise<Response>((resolve) => {
				resolvers.set(barcode, resolve);
				if (resolvers.size === 2) markAllStarted?.();
			});
		};
		const service = createService(fetchFn);

		const search = service.searchBarcodes(["5902057001748", "5449000000996"]);
		await allStarted;
		resolvers.get("5449000000996")?.(createJsonResponse([{ id: "second-product", name: "Second product" }]));
		resolvers.get("5902057001748")?.(createJsonResponse([{ id: "first-product", name: "First product" }]));

		const result = await search;

		expect(result.queries).toEqual(["5902057001748", "5449000000996"]);
		expect(result.publicItems.map(({ query, productId }) => ({ query, productId }))).toEqual([
			{ query: "5902057001748", productId: "first-product" },
			{ query: "5449000000996", productId: "second-product" },
		]);
	});

	it.each([
		{ barcodes: [] },
		{ barcodes: ["1234567"] },
		{ barcodes: ["590205700174X"] },
		{ barcodes: Array.from({ length: 11 }, () => "5902057001748") },
	])("rejects an invalid barcode batch before making a search request %#", async ({ barcodes }) => {
		const fetchStub = createFetchStub(createJsonResponse([]));
		const service = createService(fetchStub.fetchFn);

		await expect(service.searchBarcodes(barcodes)).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "food.search",
			failure: { kind: "invalidRequest" },
		});
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("keeps successful barcode groups and warns when another barcode request fails", async () => {
		const calls: string[] = [];
		const fetchFn: typeof fetch = async (input) => {
			const url = new URL(String(input));
			calls.push(url.toString());
			return url.searchParams.get("phrase") === "5902057001748"
				? createJsonResponse([{ id: "product-1", name: "Kefir" }])
				: createJsonResponse({ message: "temporary failure" }, { status: 503 });
		};
		const service = createService(fetchFn);

		const result = await service.searchBarcodes(["5902057001748", "5449000000996"]);

		expect(result.publicItems.map(({ query, productId }) => ({ query, productId }))).toEqual([
			{ query: "5902057001748", productId: "product-1" },
		]);
		expect(result.warningDetails).toHaveLength(1);
		expect(result.warningDetails[0]).toMatchObject({
			query: "5449000000996",
			source: "public",
			clientError: { failure: { kind: "http", statusCode: 503 } },
		});
		expect(calls).toHaveLength(3);
	});

	it("fails the barcode batch when every request fails", async () => {
		const fetchFn: typeof fetch = async () => createJsonResponse({ message: "temporary failure" }, { status: 503 });
		const service = createService(fetchFn);

		await expect(service.searchBarcodes(["5902057001748", "5449000000996"])).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "All Fitatu food search requests failed",
			operation: "food.search",
			failure: { kind: "http", statusCode: 503 },
			attempts: [
				{ kind: "http", statusCode: 503 },
				{ kind: "http", statusCode: 503 },
				{ kind: "http", statusCode: 503 },
			],
		});
	});
});

function createService(fetchFn: typeof fetch): FoodSearchService {
	return new FoodSearchService(
		new FoodSearchClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn,
			authClient,
			userClient,
		}),
	);
}
