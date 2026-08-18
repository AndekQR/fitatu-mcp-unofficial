import type { FoodSearchOptions } from "../../api/foodSearch/FoodSearchOptions.ts";
import { NormalizedFoodSearchOptions } from "../../api/foodSearch/NormalizedFoodSearchOptions.ts";
import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../api/fitatuApiClientBase/FitatuClientOperations.ts";
import { DateUtils } from "../../shared/DateUtils.ts";
import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";

const DEFAULT_LOCALE = "pl_PL";
const DEFAULT_LIMIT = 5;
const DEFAULT_DETAILS_LIMIT = 3;

export class FoodSearchOptionsNormalizer {
	public normalize(options: FoodSearchOptions): NormalizedFoodSearchOptions {
		try {
			return this.normalizeValidated(options);
		} catch (error) {
			if (error instanceof FitatuClientError) throw error;
			if (!(error instanceof ValidationError)) throw error;
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: error.message,
			});
		}
	}

	private normalizeValidated(options: FoodSearchOptions): NormalizedFoodSearchOptions {
		const queries = this.normalizeQueries(options.queries);
		const limit = NumberUtils.parseIntegerInRange(
			options.limit ?? DEFAULT_LIMIT,
			1,
			50,
			"limit must be between 1 and 50",
		);
		const detailsLimit = NumberUtils.parseIntegerInRange(
			options.detailsLimit ?? DEFAULT_DETAILS_LIMIT,
			0,
			50,
			"detailsLimit must be between 0 and 50",
		);
		const includeUserFood = options.includeUserFood ?? true;
		const includePublicFood = options.includePublicFood ?? true;

		if (!includeUserFood && !includePublicFood) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: "At least one food source must be enabled",
			});
		}

		return new NormalizedFoodSearchOptions(
			queries,
			DateUtils.validateIsoDate(options.date ?? DateUtils.toLocalDateString(), {
				calendarErrorMessage: "date must use YYYY-MM-DD format",
			}),
			StringUtils.parseNonEmptyString(options.locale ?? DEFAULT_LOCALE, "locale is required"),
			limit,
			includeUserFood,
			includePublicFood,
			options.includeDetails ?? false,
			detailsLimit,
		);
	}

	private normalizeQueries(queries: readonly string[] | undefined): readonly string[] {
		if (!queries) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: "queries is required",
			});
		}
		if (queries.length === 0) {
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: "queries must not be empty",
			});
		}

		return queries.map((value) =>
			StringUtils.parseNonEmptyString(value, "queries must not contain empty values is required"),
		);
	}
}
