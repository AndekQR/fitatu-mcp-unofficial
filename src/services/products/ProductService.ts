import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { ProductClient } from "../../api/products/ProductClient.ts";
import type { ProductCreateResult } from "../../api/products/ProductCreateResult.ts";
import type { ProductWriteInput } from "../../api/products/ProductWriteInput.ts";
import { FoodSearchService } from "../foodSearch/FoodSearchService.ts";
import { MutationConfirmationContext } from "../MutationConfirmationContext.ts";
import { MutationConfirmationError } from "../MutationConfirmationError.ts";
import { ProductServiceCreateResult } from "./ProductServiceCreateResult.ts";
import { ProductWarning } from "./ProductWarning.ts";

const GRAM_MEASURE_WEIGHT = 1;

/**
 * Creates user-owned products and confirms them with one read of the product
 * details. Once Fitatu has answered the create call, the product exists, so a
 * failed read-back is reported as a warning rather than an error: an error
 * would invite a retry and a duplicate product.
 */
export class ProductService {
	private readonly productClient: ProductClient;
	private readonly foodSearchService: FoodSearchService;

	public constructor(productClient: ProductClient, foodSearchService: FoodSearchService) {
		this.productClient = productClient;
		this.foodSearchService = foodSearchService;
	}

	public async createProduct(input: ProductWriteInput): Promise<ProductServiceCreateResult> {
		const created = await this.createOrReportUnknownOutcome(input);

		let measures: readonly FoodMeasure[];
		try {
			measures = await this.foodSearchService.getAvailableMeasures(created.productId, "PRODUCT");
		} catch (error) {
			return unconfirmed(
				created,
				`Product ${created.productId} was created, but reading it back failed. Do not create it again; look up its measures with search_food.`,
				error instanceof FitatuClientError ? error : null,
			);
		}

		if (measures.length === 0) {
			return unconfirmed(
				created,
				`Product ${created.productId} was created, but its read-back returned no measures. Do not create it again; look up its measures with search_food.`,
				null,
			);
		}

		const gramMeasureId = findGramMeasureId(measures);
		const warnings =
			gramMeasureId === null
				? [
						new ProductWarning(
							"GRAM_MEASURE_NOT_FOUND",
							`Product ${created.productId} was created, but Fitatu returned no gram measure; pick a measureId from measures.`,
						),
					]
				: [];
		return new ProductServiceCreateResult(created, measures, gramMeasureId, warnings, "confirmed");
	}

	private async createOrReportUnknownOutcome(input: ProductWriteInput): Promise<ProductCreateResult> {
		try {
			return await this.productClient.createProduct(input);
		} catch (error) {
			if (error instanceof FitatuClientError && leavesOutcomeUnknown(error)) {
				throw MutationConfirmationError.outcomeUnknown(
					new MutationConfirmationContext(`product "${input.name}"`, "search_food"),
				);
			}
			throw error;
		}
	}
}

function leavesOutcomeUnknown(error: FitatuClientError): boolean {
	if (error.operation !== FITATU_CLIENT_OPERATIONS.productsCreate) {
		return false;
	}
	const failure = error.failure;
	switch (failure.kind) {
		case "invalidResponse":
		case "transport":
			return true;
		case "http":
			return failure.statusCode === 408 || failure.statusCode >= 500;
		default:
			return false;
	}
}

function unconfirmed(
	created: ProductCreateResult,
	message: string,
	clientError: FitatuClientError | null,
): ProductServiceCreateResult {
	const warning = new ProductWarning("PRODUCT_MEASURES_UNAVAILABLE", message, clientError);
	return new ProductServiceCreateResult(created, [], null, [warning], "unconfirmed");
}

function findGramMeasureId(measures: readonly FoodMeasure[]): string | null {
	const gramMeasures = measures.filter(
		(measure) => measure.measureId !== null && measure.weightG === GRAM_MEASURE_WEIGHT,
	);
	const named = gramMeasures.find((measure) => measure.measureName?.trim().toLowerCase() === "g");
	return (named ?? gramMeasures[0])?.measureId ?? null;
}
