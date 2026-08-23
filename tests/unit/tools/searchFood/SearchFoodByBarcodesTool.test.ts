import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FoodNutrition } from "../../../../src/api/foodSearch/FoodNutrition.ts";
import { FoodSearchItem } from "../../../../src/api/foodSearch/FoodSearchItem.ts";
import { FoodSearchResult } from "../../../../src/api/foodSearch/FoodSearchResult.ts";
import { NormalizedFoodSearchItem } from "../../../../src/api/foodSearch/NormalizedFoodSearchItem.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { SearchFoodByBarcodesTool } from "../../../../src/tools/searchFood/SearchFoodByBarcodesTool.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("SearchFoodByBarcodesTool", () => {
	it("delegates a barcode batch and returns one minimal result group per input", async () => {
		const service = new FakeBarcodeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodByBarcodesTool(service));

		const result = await registered.invoke({ barcodes: ["5902057001748", "5902057001748"] });

		expect(registered.name).toBe("search_food_by_barcodes");
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(service.requests).toEqual([
			{
				barcodes: ["5902057001748", "5902057001748"],
				includeDetails: false,
				detailsLimit: 3,
			},
		]);
		expect(parseTextContent(result)).toEqual({
			results: [
				{ barcode: "5902057001748", items: [] },
				{ barcode: "5902057001748", items: [] },
			],
		});
	});

	it.each([
		{ barcodes: [] },
		{ barcodes: ["1234567"] },
		{ barcodes: ["590205700174X"] },
		{ barcodes: Array.from({ length: 11 }, () => "5902057001748") },
	])("rejects invalid barcode input before calling the service %#", async (input) => {
		const service = new FakeBarcodeFoodSearchService();
		const registered = await registerToolForTest(new SearchFoodByBarcodesTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(service.requests).toHaveLength(0);
	});

	it("publishes the reusable search_food candidate without group count or index metadata", async () => {
		const service = new FakeBarcodeFoodSearchService(undefined, true);
		const registered = await registerToolForTest(new SearchFoodByBarcodesTool(service));

		const result = await registered.invoke({ barcodes: ["5902057001748"] });
		const payload = parseTextContent(result);
		const groups = (payload as { results: readonly unknown[] }).results;

		expect(payload).toMatchObject({
			results: [
				{
					barcode: "5902057001748",
					items: [{ productId: "product-1", measureId: "2", source: "public" }],
				},
			],
		});
		expect(payload).not.toHaveProperty("barcodeCount");
		expect(payload).not.toHaveProperty("resultCount");
		expect(groups[0]).not.toHaveProperty("barcodeIndex");
		expect(groups[0]).not.toHaveProperty("count");
	});

	it("redacts unexpected service errors", async () => {
		const service = new FakeBarcodeFoodSearchService(new Error("secret upstream response"));
		const registered = await registerToolForTest(new SearchFoodByBarcodesTool(service));

		const result = await registered.invoke({ barcodes: ["5902057001748"] });

		expect(result.isError).toBe(true);
		expect(JSON.stringify(parseTextContent(result))).not.toContain("secret upstream response");
	});
});

class FakeBarcodeFoodSearchService extends FoodSearchService {
	public readonly requests: Array<{
		readonly barcodes: readonly string[];
		readonly includeDetails?: boolean;
		readonly detailsLimit?: number;
	}> = [];
	private readonly error?: Error;
	private readonly includeProduct: boolean;

	public constructor(error?: Error, includeProduct = false) {
		super(createUnusedFoodSearchClient());
		this.error = error;
		this.includeProduct = includeProduct;
	}

	public override async searchBarcodes(
		barcodes: readonly string[],
		includeDetails?: boolean,
		detailsLimit?: number,
	): Promise<FoodSearchResult> {
		this.requests.push({ barcodes, includeDetails, detailsLimit });
		if (this.error) throw this.error;
		const publicItems = this.includeProduct
			? barcodes.map(
					(barcode, queryIndex) =>
						new FoodSearchItem(
							new NormalizedFoodSearchItem(
								"public",
								"product-1",
								"PRODUCT",
								"Kefir",
								"Krasnystaw",
								"2",
								"package",
								1,
								420,
								210,
								new FoodNutrition(50, null, null, null, null, null, null, null),
								new FoodNutrition(210, null, null, null, null, null, null, null),
								false,
								null,
								[],
							),
							queryIndex,
							queryIndex,
							barcode,
							"Kefir - 1 package, 420 g, 210 kcal",
						),
				)
			: [];
		return new FoodSearchResult("2026-08-20", barcodes, [], publicItems, [], []);
	}
}

function createUnusedFoodSearchClient(): FoodSearchClient {
	return new FoodSearchClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn: async () => {
			throw new Error("Unexpected HTTP request from barcode tool test double");
		},
		authClient: createAuthClientStub({ userId: "user-1" }),
		userClient: {
			getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
			clearUserCache: () => undefined,
		},
	});
}
