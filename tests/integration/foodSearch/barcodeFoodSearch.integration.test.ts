import { describe, expect, it } from "vitest";
import { FoodSearchService } from "../../../src/services/foodSearch/FoodSearchService.ts";
import { IntegrationTestContext } from "../helpers/IntegrationTestContext.ts";

const KNOWN_BARCODE = "5902057001748";
const foodSearchService = new FoodSearchService(IntegrationTestContext.fromEnvironment().foodSearchClient);

describe.sequential("Fitatu barcode food search integration", () => {
	it("returns one public result group for every barcode input including duplicates", async () => {
		const result = await foodSearchService.searchBarcodes([KNOWN_BARCODE, KNOWN_BARCODE], false, 0);

		expect(result.queries).toEqual([KNOWN_BARCODE, KNOWN_BARCODE]);
		expect(result.userItems).toEqual([]);
		expect(result.warningDetails).toEqual([]);
		expect(result.publicItems.length).toBeGreaterThanOrEqual(2);
		expect(new Set(result.publicItems.map(({ queryIndex }) => queryIndex))).toEqual(new Set([0, 1]));
		expect(
			result.publicItems.every(
				({ productId, measureId, source }) =>
					productId.length > 0 && measureId !== null && measureId.length > 0 && source === "public",
			),
		).toBe(true);
	});
});
