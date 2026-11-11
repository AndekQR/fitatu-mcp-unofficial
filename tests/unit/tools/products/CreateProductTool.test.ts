import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import { FoodSearchClient } from "../../../../src/api/foodSearch/FoodSearchClient.ts";
import { FavouritesClient } from "../../../../src/api/users/FavouritesClient.ts";
import { FoodMeasure } from "../../../../src/api/foodSearch/FoodMeasure.ts";
import { ProductClient } from "../../../../src/api/products/ProductClient.ts";
import { ProductCreateResult } from "../../../../src/api/products/ProductCreateResult.ts";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { FoodSearchService } from "../../../../src/services/foodSearch/FoodSearchService.ts";
import type { ProductWriteInput } from "../../../../src/api/products/ProductWriteInput.ts";
import { ProductService } from "../../../../src/services/products/ProductService.ts";
import { ProductServiceCreateResult } from "../../../../src/services/products/ProductServiceCreateResult.ts";
import { ProductWarning } from "../../../../src/services/products/ProductWarning.ts";
import { CreateProductTool } from "../../../../src/tools/products/CreateProductTool.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("CreateProductTool", () => {
	it("maps validated input to the service and returns the read-back gram measure", async () => {
		const service = new FakeProductService(confirmedResult);
		const registered = await registerToolForTest(new CreateProductTool(service));

		const result = await registered.invoke({
			name: " Test bun ",
			brand: "Test brand",
			energy: 395,
			fat: 18,
			carbohydrate: 51,
			protein: 5.3,
			sugars: 25,
		});

		expect(registered.name).toBe("create_product");
		expect(registered.config.annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
		});
		expect(registered.config.description).toContain("user's own Fitatu catalog");
		expect(registered.config.description).toContain("search_food");
		expect(registered.config.inputSchema.required).toEqual(
			expect.arrayContaining(["name", "energy", "fat", "carbohydrate", "protein"]),
		);
		expect(service.inputs[0]).toEqual({
			name: "Test bun",
			brand: "Test brand",
			barcode: null,
			energy: 395,
			fat: 18,
			carbohydrate: 51,
			protein: 5.3,
			saturatedFat: null,
			sugars: 25,
			fiber: null,
			salt: null,
		});
		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toEqual({
			status: "confirmed",
			productId: "150968031",
			name: "Test bun",
			gramMeasureId: "1",
			measures: [{ measureId: "1", measureName: "g", weightG: 1 }],
			warnings: [],
		});
	});

	it("returns the created product id with a warning when the read-back failed", async () => {
		const registered = await registerToolForTest(new CreateProductTool(new FakeProductService(unconfirmedResult)));

		const result = await registered.invoke(validInput());

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toMatchObject({
			status: "unconfirmed",
			productId: "150968031",
			measures: [],
			warnings: [
				{
					code: "PRODUCT_MEASURES_UNAVAILABLE",
					clientError: { name: "FitatuClientError", operation: "food.details.get" },
				},
			],
		});
		expect(result.structuredContent).not.toHaveProperty("gramMeasureId");
	});

	it("returns the product id through the MCP output schema when the read-back gets a bare 404", async () => {
		const notFound = () => new Response(null, { status: 404 });
		const fetchStub = createFetchStub(
			createJsonResponse({ id: 150968031, name: "Test bun" }, { status: 201 }),
			notFound(),
			notFound(),
			notFound(),
		);
		const options = {
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient: createAuthClientStub({ userId: "test-user" }),
			userClient: {
				getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "test-user", locale: "pl_PL" }),
				clearUserCache: () => undefined,
			},
		};
		const service = new ProductService(
			new ProductClient(options),
			new FoodSearchService(new FoodSearchClient(options), new FavouritesClient(options)),
		);
		const registered = await registerToolForTest(new CreateProductTool(service));

		const result = await registered.invoke(validInput());

		expect(result.isError).toBeFalsy();
		expect(result.structuredContent).toMatchObject({
			status: "unconfirmed",
			productId: "150968031",
			warnings: [
				{
					code: "PRODUCT_MEASURES_UNAVAILABLE",
					clientError: { failure: { statusCode: 404, upstreamCode: null } },
				},
			],
		});
	});

	it.each([
		{ name: "a negative value", input: { ...validInput(), fat: -1 } },
		{ name: "a missing macronutrient", input: { name: "Test bun", energy: 100, fat: 1, carbohydrate: 2 } },
		{ name: "an empty name", input: { ...validInput(), name: "   " } },
		{ name: "a non-numeric barcode", input: { ...validInput(), barcode: "abc" } },
	])("rejects $name before calling the service", async ({ input }) => {
		const service = new FakeProductService(confirmedResult);
		const registered = await registerToolForTest(new CreateProductTool(service));

		const result = await registered.invoke(input);

		expect(result.isError).toBe(true);
		expect(getTextContent(result)).toMatch(/validation/i);
		expect(service.inputs).toHaveLength(0);
	});

	it("maps a Fitatu rejection of the create request to a safe public error", async () => {
		const error = FitatuClientError.invalidRequest({
			operation: FITATU_CLIENT_OPERATIONS.productsCreate,
			message: "name is required",
		});
		const registered = await registerToolForTest(new CreateProductTool(new FakeProductService(() => error)));

		const result = await registered.invoke(validInput());

		expect(result.isError).toBe(true);
		expect(parseTextContent(result)).toMatchObject({
			status: "error",
			toolName: "create_product",
			error: { name: "FitatuClientError", operation: "products.create" },
		});
	});
});

function validInput(): Record<string, unknown> {
	return { name: "Test bun", energy: 395, fat: 18, carbohydrate: 51, protein: 5.3 };
}

function created(): ProductCreateResult {
	return ProductCreateResult.fromApiResponse({ id: 150968031, name: "Test bun" }, "Test bun");
}

function confirmedResult(): ProductServiceCreateResult {
	return new ProductServiceCreateResult(created(), [new FoodMeasure("1", "g", 1, null, null)], "1", [], "confirmed");
}

function unconfirmedResult(): ProductServiceCreateResult {
	const readError = FitatuClientError.invalidRequest({
		operation: FITATU_CLIENT_OPERATIONS.foodDetailsGet,
		message: "read-back failed",
	});
	return new ProductServiceCreateResult(
		created(),
		[],
		null,
		[
			new ProductWarning(
				"PRODUCT_MEASURES_UNAVAILABLE",
				"Product was created, but reading it back failed.",
				readError,
			),
		],
		"unconfirmed",
	);
}

class FakeProductService extends ProductService {
	public readonly inputs: ProductWriteInput[] = [];
	private readonly outcome: () => ProductServiceCreateResult | Error;

	public constructor(outcome: () => ProductServiceCreateResult | Error) {
		const options = {
			fetchFn: unusedFetch,
			authClient: createAuthClientStub({ userId: "test-user" }),
			userClient: new UnusedFitatuUserClient(),
		};
		super(new ProductClient(options), new FoodSearchService(new FoodSearchClient(options), new FavouritesClient(options)));
		this.outcome = outcome;
	}

	public override async createProduct(input: ProductWriteInput): Promise<ProductServiceCreateResult> {
		const outcome = this.outcome();
		if (outcome instanceof Error) {
			throw outcome;
		}
		this.inputs.push(input);
		return outcome;
	}
}

class UnusedFitatuUserClient extends FitatuUserClient {
	public constructor() {
		super({ fetchFn: unusedFetch, authClient: createAuthClientStub({ userId: "test-user" }) });
	}
}

const unusedFetch: typeof fetch = async () => {
	throw new Error("Unexpected HTTP request from test fake");
};
