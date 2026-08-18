import { FoodType, type FoodTypeName } from "../../api/dayPlan/FoodType.ts";
import type { FitatuRequestFailure } from "../../api/fitatuApiClientBase/FitatuClientFailure.ts";
import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FoodSearchApiResponse } from "../../api/foodSearch/FoodSearchApiResponse.ts";
import type { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import { FoodDetailsRequest } from "../../api/foodSearch/FoodDetailsRequest.ts";
import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import type { FoodSearchOptions } from "../../api/foodSearch/FoodSearchOptions.ts";
import { FoodSearchQueryResult } from "../../api/foodSearch/FoodSearchQueryResult.ts";
import { FoodSearchResult } from "../../api/foodSearch/FoodSearchResult.ts";
import type { FoodSearchSource } from "../../api/foodSearch/FoodSearchSource.ts";
import { FoodSearchWarningDetail } from "../../api/foodSearch/FoodSearchWarningDetail.ts";
import type { NormalizedFoodSearchItem } from "../../api/foodSearch/NormalizedFoodSearchItem.ts";
import type { NormalizedFoodSearchOptions } from "../../api/foodSearch/NormalizedFoodSearchOptions.ts";
import { PublicFoodSearchRequest } from "../../api/foodSearch/PublicFoodSearchRequest.ts";
import { UserFoodSearchRequest } from "../../api/foodSearch/UserFoodSearchRequest.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FoodSearchOptionsNormalizer } from "./FoodSearchOptionsNormalizer.ts";
import { FoodSearchResponseMapper } from "./FoodSearchResponseMapper.ts";
import { FoodSourceSearchResult } from "./FoodSourceSearchResult.ts";
import { UserFoodRelevanceFilter } from "./UserFoodRelevanceFilter.ts";

type FoodSearchApi = Pick<
	FoodSearchClient,
	"getContextUserId" | "searchPublicFood" | "searchUserFood" | "getFoodDetails"
>;

export interface FoodSearchProvider {
	search(options: FoodSearchOptions): Promise<FoodSearchResult>;
}

export class FoodSearchService implements FoodSearchProvider {
	private readonly foodSearchClient: FoodSearchApi;
	private readonly optionsNormalizer: FoodSearchOptionsNormalizer;
	private readonly responseMapper: FoodSearchResponseMapper;
	private readonly userFoodRelevanceFilter: UserFoodRelevanceFilter;

	public constructor(
		foodSearchClient: FoodSearchApi,
		optionsNormalizer: FoodSearchOptionsNormalizer = new FoodSearchOptionsNormalizer(),
		responseMapper: FoodSearchResponseMapper = new FoodSearchResponseMapper(),
		userFoodRelevanceFilter: UserFoodRelevanceFilter = new UserFoodRelevanceFilter(),
	) {
		this.foodSearchClient = foodSearchClient;
		this.optionsNormalizer = optionsNormalizer;
		this.responseMapper = responseMapper;
		this.userFoodRelevanceFilter = userFoodRelevanceFilter;
	}

	public async search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		const normalized = this.optionsNormalizer.normalize(options);
		const userId = normalized.includeUserFood
			? StringUtils.firstNonEmptyString(await this.foodSearchClient.getContextUserId())
			: undefined;
		if (normalized.includeUserFood && !userId) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: "Fitatu user id is required",
			});
		}

		const results: FoodSearchQueryResult[] = [];
		for (const query of normalized.queries) {
			results.push(await this.searchOne(query, normalized, userId));
		}

		this.throwWhenEverySearchFailed(results);
		return new FoodSearchResult(
			normalized.date,
			normalized.queries,
			this.responseMapper.toOutputItems(results, "user"),
			this.responseMapper.toOutputItems(results, "public"),
			results.flatMap((result) => result.warnings),
			results.flatMap((result) => result.warningDetails),
		);
	}

	public async getAvailableMeasureIds(foodId: string | number, foodType: FoodTypeName): Promise<ReadonlySet<string>> {
		const measures = await this.getAvailableMeasures(foodId, foodType);
		return new Set(measures.flatMap((measure) => (measure.measureId === null ? [] : [measure.measureId])));
	}

	public async getAvailableMeasures(
		foodId: string | number,
		foodType: FoodTypeName,
	): Promise<readonly FoodMeasure[]> {
		let normalizedFoodId: string | number;
		try {
			normalizedFoodId = StringUtils.parseStringOrSafeInteger(foodId, "foodId is required");
			FoodType.resolve(foodType, "PRODUCT", "foodType");
		} catch (error) {
			if (!(error instanceof ValidationError)) throw error;
			throw FitatuClientError.invalidRequest({
				operation: FITATU_CLIENT_OPERATIONS.foodSearch,
				message: error.message,
			});
		}

		const response = await this.foodSearchClient.getFoodDetails(
			new FoodDetailsRequest(String(normalizedFoodId), foodType),
		);
		return this.responseMapper.mapAvailableMeasures(response);
	}

	private async searchOne(
		query: string,
		options: NormalizedFoodSearchOptions,
		userId: string | undefined,
	): Promise<FoodSearchQueryResult> {
		const [userResult, publicResult] = await Promise.all([
			options.includeUserFood && userId
				? this.searchSource(query, "user", () =>
						this.foodSearchClient.searchUserFood(
							new UserFoodSearchRequest(userId, query, options.date, options.limit),
						),
					)
				: undefined,
			options.includePublicFood
				? this.searchSource(query, "public", () =>
						this.foodSearchClient.searchPublicFood(
							new PublicFoodSearchRequest(query, options.locale, options.limit),
						),
					)
				: undefined,
		]);
		const sourceResults = [userResult, publicResult].filter(isFoodSourceSearchResult);
		const warnings = sourceResults.flatMap((result) => result.warnings);
		const warningDetails = sourceResults.flatMap((result) => result.warningDetails);
		let userItems = this.userFoodRelevanceFilter.filter(query, deduplicateItems(userResult?.items ?? []));
		let publicItems = deduplicateItems(publicResult?.items ?? []);

		if (options.includeDetails && options.detailsLimit > 0) {
			userItems = await this.withDetails(userItems, options.detailsLimit, warnings, warningDetails);
			publicItems = await this.withDetails(
				publicItems,
				Math.max(0, options.detailsLimit - userItems.length),
				warnings,
				warningDetails,
			);
		}

		return new FoodSearchQueryResult(
			query,
			userItems,
			publicItems,
			warnings,
			warningDetails,
			sourceResults.length,
			sourceResults.filter((result) => result.succeeded).length,
		);
	}

	private async searchSource(
		query: string,
		source: FoodSearchSource,
		request: () => Promise<FoodSearchApiResponse>,
	): Promise<FoodSourceSearchResult> {
		try {
			return FoodSourceSearchResult.success(this.responseMapper.mapSearchItems(await request(), source));
		} catch (error) {
			if (!(error instanceof FitatuClientError)) throw error;
			const warning = `${source} search failed for query='${query}': ${safeWarningMessage(error)}`;
			return FoodSourceSearchResult.failure(warning, new FoodSearchWarningDetail(warning, error, query, source));
		}
	}

	private async withDetails(
		items: readonly NormalizedFoodSearchItem[],
		limit: number,
		warnings: string[],
		warningDetails: FoodSearchWarningDetail[],
	): Promise<readonly NormalizedFoodSearchItem[]> {
		const detailed: NormalizedFoodSearchItem[] = [];
		for (const [index, item] of items.entries()) {
			if (index >= limit) {
				detailed.push(item);
				continue;
			}
			try {
				const response = await this.foodSearchClient.getFoodDetails(
					new FoodDetailsRequest(item.foodId, this.responseMapper.resolveDetailsFoodType(item.foodType)),
				);
				detailed.push(this.responseMapper.mergeDetails(item, response));
			} catch (error) {
				if (!(error instanceof FitatuClientError)) throw error;
				const warning = `${item.source} details failed for foodId=${item.foodId}: ${safeWarningMessage(error)}`;
				warnings.push(warning);
				warningDetails.push(new FoodSearchWarningDetail(warning, error, undefined, item.source, item.foodId));
				detailed.push(item);
			}
		}
		return detailed;
	}

	private throwWhenEverySearchFailed(results: readonly FoodSearchQueryResult[]): void {
		const attemptCount = results.reduce((sum, result) => sum + result.searchAttemptCount, 0);
		const successCount = results.reduce((sum, result) => sum + result.searchSuccessCount, 0);
		if (attemptCount === 0 || successCount > 0) return;

		const errors = results.flatMap((result) => result.warningDetails.map((warning) => warning.clientError));
		const finalError = errors.at(-1);
		if (!finalError) return;
		const attempts = errors.slice(0, -1).flatMap(toRequestFailures);
		throw finalError.withAttempts([...attempts, ...finalError.attempts], "All Fitatu food search requests failed");
	}
}

function isFoodSourceSearchResult(value: FoodSourceSearchResult | undefined): value is FoodSourceSearchResult {
	return value !== undefined;
}

function deduplicateItems(items: readonly NormalizedFoodSearchItem[]): readonly NormalizedFoodSearchItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.foodType}:${item.foodId}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function safeWarningMessage(error: FitatuClientError): string {
	if (error.failure.kind !== "http") return error.message;
	const statusText = error.failure.statusText ? ` ${error.failure.statusText}` : "";
	const upstreamMessage = error.failure.upstreamMessage ? `: ${error.failure.upstreamMessage}` : "";
	return `${error.message} (HTTP ${error.failure.statusCode}${statusText}${upstreamMessage})`;
}

function toRequestFailures(error: FitatuClientError): FitatuRequestFailure[] {
	const failures = [...error.attempts];
	if (
		error.failure.kind === "http" ||
		error.failure.kind === "transport" ||
		error.failure.kind === "invalidResponse"
	) {
		failures.push(error.failure);
	}
	return failures;
}
