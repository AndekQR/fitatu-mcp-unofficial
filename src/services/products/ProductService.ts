import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { ProductClient } from "../../api/products/ProductClient.ts";
import type { ProductCreateResult } from "../../api/products/ProductCreateResult.ts";
import { ProductWriteInput } from "../../api/products/ProductWriteInput.ts";
import { FoodSearchService } from "../foodSearch/FoodSearchService.ts";
import { MutationConfirmationContext } from "../MutationConfirmationContext.ts";
import { MutationConfirmationError } from "../MutationConfirmationError.ts";
import type { ProductCreation } from "./ProductCreation.ts";
import { ProductServiceCreateResult } from "./ProductServiceCreateResult.ts";
import { ProductWarning } from "./ProductWarning.ts";

/** Weight of one unit of a gram measure, so its quantity equals grams. */
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

	public async createProduct(creation: ProductCreation): Promise<ProductServiceCreateResult> {
		const created = await this.createOrReportUnknownOutcome(creation);

		let measures: readonly FoodMeasure[];
		try {
			measures = await this.foodSearchService.getAvailableMeasures(created.productId, "PRODUCT");
		} catch (error) {
			// Any failure here comes after a known write, so it must never hide the new productId.
			return unconfirmed(
				created,
				`Product ${created.productId} was created, but reading it back failed. Do not create it again; look up its measures with search_food.`,
				error instanceof FitatuClientError ? error : null,
			);
		}

		// Every product is created with a gram measure, so a read-back without measures does not confirm it.
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

	/**
	 * A lost or unreadable answer to the create call does not tell whether the
	 * product was stored, so it is reported as an unknown outcome instead of a
	 * plain failure that would invite a retry.
	 */
	private async createOrReportUnknownOutcome(creation: ProductCreation): Promise<ProductCreateResult> {
		try {
			return await this.productClient.createProduct(toWriteInput(creation));
		} catch (error) {
			if (error instanceof FitatuClientError && leavesOutcomeUnknown(error)) {
				throw MutationConfirmationError.outcomeUnknown(
					new MutationConfirmationContext(`product "${creation.name}"`, "search_food"),
				);
			}
			throw error;
		}
	}
}

/**
 * A rejection (4xx) means nothing was stored. A lost or unreadable answer, a
 * request timeout or a server-side failure (5xx, e.g. a gateway timeout) can
 * happen after the product was already written.
 */
function leavesOutcomeUnknown(error: FitatuClientError): boolean {
	// Login, profile or session-refresh failures happen before the POST is sent.
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

function toWriteInput(creation: ProductCreation): ProductWriteInput {
	return new ProductWriteInput(
		creation.name,
		creation.brand,
		creation.barcode,
		creation.energy,
		creation.fat,
		creation.carbohydrate,
		creation.protein,
		creation.saturatedFat,
		creation.sugars,
		creation.fiber,
		creation.salt,
	);
}

/**
 * Fitatu exposes grams as a measure weighing 1 g (measureId "1", name "g").
 * The 100 g measure sent on creation is also listed, but its quantity counts
 * 100 g portions, so it is not the gram measure.
 */
function findGramMeasureId(measures: readonly FoodMeasure[]): string | null {
	const gramMeasures = measures.filter(
		(measure) => measure.measureId !== null && measure.weightG === GRAM_MEASURE_WEIGHT,
	);
	const named = gramMeasures.find((measure) => measure.measureName?.trim().toLowerCase() === "g");
	return (named ?? gramMeasures[0])?.measureId ?? null;
}
