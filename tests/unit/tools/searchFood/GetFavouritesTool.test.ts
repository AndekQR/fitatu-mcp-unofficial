import { describe, expect, it } from "vitest";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FoodNutrition } from "../../../../src/api/foodSearch/FoodNutrition.ts";
import { FoodSearchItem } from "../../../../src/api/foodSearch/FoodSearchItem.ts";
import { FoodSearchResult } from "../../../../src/api/foodSearch/FoodSearchResult.ts";
import { NormalizedFoodSearchItem } from "../../../../src/api/foodSearch/NormalizedFoodSearchItem.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import { GetFavouritesTool } from "../../../../src/tools/searchFood/GetFavouritesTool.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("GetFavouritesTool", () => {
	it("is a read-only tool that delegates to the service", async () => {
		const service = new FakeFavouritesService();
		const registered = await registerToolForTest(new GetFavouritesTool(service));

		const result = await registered.invoke({ phrase: "jogurt", limit: 7 });

		expect(registered.name).toBe("get_favourites");
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
		});
		expect(service.requests).toEqual([{ phrase: "jogurt", limit: 7 }]);
		expect(result.isError).not.toBe(true);
	});

	it("applies the default limit when no arguments are provided", async () => {
		const service = new FakeFavouritesService();
		const registered = await registerToolForTest(new GetFavouritesTool(service));

		await registered.invoke({});

		expect(service.requests).toEqual([{ phrase: undefined, limit: 50 }]);
	});

	it.each([{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { phrase: "" }, { phrase: "   " }, { unknown: true }])(
		"rejects invalid input before calling the service %#",
		async (input) => {
			const service = new FakeFavouritesService();
			const registered = await registerToolForTest(new GetFavouritesTool(service));

			const result = await registered.invoke(input);

			expect(result.isError).toBe(true);
			expect(service.requests).toHaveLength(0);
		},
	);

	it("returns products with productId and recipes with recipeId, omitting custom items", async () => {
		const service = new FakeFavouritesService(undefined, [
			createItem("111", "PRODUCT", "Kefir"),
			createItem("222", "RECIPE", "Zupa"),
			createItem("333", "CUSTOM_ITEM", "Wlasny"),
		]);
		const registered = await registerToolForTest(new GetFavouritesTool(service));

		const payload = parseTextContent(await registered.invoke({}));

		expect(payload).toMatchObject({
			count: 2,
			items: [
				{ source: "user", productId: "111", name: "Kefir", measureId: "2" },
				{ source: "user", recipeId: "222", name: "Zupa", measureId: "2" },
			],
		});
		expect(JSON.stringify(payload)).not.toContain("333");
	});

	it("returns an empty list when the user has no favourites", async () => {
		const registered = await registerToolForTest(new GetFavouritesTool(new FakeFavouritesService()));

		const payload = parseTextContent(await registered.invoke({}));

		expect(payload).toEqual({ count: 0, items: [] });
	});

	it("redacts unexpected service errors", async () => {
		const service = new FakeFavouritesService(new Error("secret upstream response"));
		const registered = await registerToolForTest(new GetFavouritesTool(service));

		const result = await registered.invoke({});

		expect(result.isError).toBe(true);
		expect(JSON.stringify(parseTextContent(result))).not.toContain("secret upstream response");
	});
});

function createItem(foodId: string, foodType: "PRODUCT" | "RECIPE" | "CUSTOM_ITEM", name: string): FoodSearchItem {
	return new FoodSearchItem(
		new NormalizedFoodSearchItem(
			"user",
			foodId,
			foodType,
			name,
			null,
			"2",
			"package",
			1,
			100,
			50,
			new FoodNutrition(50, null, null, null, null, null, null, null),
			new FoodNutrition(50, null, null, null, null, null, null, null),
			false,
			null,
			[],
		),
		0,
		0,
		"favourites",
		name,
	);
}

class FakeFavouritesService extends FoodSearchService {
	public readonly requests: Array<{ readonly phrase?: string; readonly limit?: number }> = [];
	private readonly error?: Error;
	private readonly items: readonly FoodSearchItem[];

	public constructor(error?: Error, items: readonly FoodSearchItem[] = []) {
		super(createUnusedFoodSearchClient());
		this.error = error;
		this.items = items;
	}

	public override async getFavouriteFoods(phrase?: string, limit?: number): Promise<FoodSearchResult> {
		this.requests.push({ phrase, limit });
		if (this.error) throw this.error;
		return new FoodSearchResult("2026-08-20", ["favourites"], this.items, [], [], []);
	}
}

function createUnusedFoodSearchClient(): FoodSearchClient {
	return new FoodSearchClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn: async () => {
			throw new Error("Unexpected HTTP request from favourites tool test double");
		},
		authClient: createAuthClientStub({ userId: "user-1" }),
		userClient: {
			getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
			clearUserCache: () => undefined,
		},
	});
}
