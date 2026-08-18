import { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { FoodDetailsApiResponse } from "./FoodDetailsApiResponse.ts";
import { FoodDetailsRequest } from "./FoodDetailsRequest.ts";
import { FoodSearchApiResponse } from "./FoodSearchApiResponse.ts";
import { PublicFoodSearchRequest } from "./PublicFoodSearchRequest.ts";
import { UserFoodSearchRequest } from "./UserFoodSearchRequest.ts";

const DEFAULT_ACCEPT_HEADER = "application/json";

export class FoodSearchClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		const authClient = options.authClient ?? FitatuAuthClient.getInstance();
		const userClient = options.userClient ?? FitatuUserClient.getInstance({ authClient });

		super({
			...options,
			authClient,
			userClient,
		});
	}

	public searchPublicFood(request: PublicFoodSearchRequest): Promise<FoodSearchApiResponse> {
		return this.fetchSearchResponse({
			path: "/search/new/food",
			query: {
				phrase: request.phrase,
				page: 1,
				locale: request.locale,
				limit: request.limit,
				accessType: ["FREE", "PREMIUM"],
			},
			failureMessage: "Fitatu public food search request failed",
		});
	}

	public searchUserFood(request: UserFoodSearchRequest): Promise<FoodSearchApiResponse> {
		return this.fetchSearchResponse({
			path: `/search/food/user/${encodeURIComponent(request.userId)}`,
			query: { date: request.date, phrase: request.phrase, page: 1, limit: request.limit },
			failureMessage: "Fitatu user food search request failed",
		});
	}

	public getFoodDetails(request: FoodDetailsRequest): Promise<FoodDetailsApiResponse> {
		const encodedFoodId = encodeURIComponent(request.foodId);
		const paths =
			request.foodType === "RECIPE"
				? [`/recipes/${encodedFoodId}`]
				: [`/products/${encodedFoodId}`, `/v2/products/${encodedFoodId}`, `/v3/products/${encodedFoodId}`];

		return FitatuFallbackRunner.run(
			paths,
			(path) =>
				this.performCallout({
					operation: FITATU_CLIENT_OPERATIONS.foodDetailsGet,
					method: "GET",
					path,
					endpointTemplate: endpointTemplateForDetailsPath(path),
					headers: { accept: DEFAULT_ACCEPT_HEADER },
					failureMessage: "Fitatu product details request failed",
					invalidResponseMessage: "Fitatu response was not valid JSON",
					decoder: FoodDetailsApiResponse.fromApiResponse,
				}),
			(error) => error.failure.kind === "http",
		);
	}

	private fetchSearchResponse(options: {
		readonly path: string;
		readonly query: Record<string, string | number | readonly string[]>;
		readonly failureMessage: string;
	}): Promise<FoodSearchApiResponse> {
		return FitatuFallbackRunner.run(
			[{ accept: this.V3_ACCEPT_HEADER }, { accept: DEFAULT_ACCEPT_HEADER }],
			(headers) =>
				this.performCallout({
					operation: FITATU_CLIENT_OPERATIONS.foodSearch,
					method: "GET",
					path: options.path,
					endpointTemplate: endpointTemplateForSearchPath(options.path),
					query: options.query,
					headers,
					failureMessage: options.failureMessage,
					invalidResponseMessage: "Fitatu search response was not valid JSON",
					decoder: FoodSearchApiResponse.fromApiResponse,
				}),
			(error) => error.failure.kind === "http",
		);
	}
}

function endpointTemplateForSearchPath(path: string): string {
	return path.startsWith("/search/food/user/") ? "/search/food/user/:userId" : "/search/new/food";
}

function endpointTemplateForDetailsPath(path: string): string {
	if (path.startsWith("/recipes/")) return "/recipes/:foodId";
	if (path.startsWith("/v2/")) return "/v2/products/:foodId";
	if (path.startsWith("/v3/")) return "/v3/products/:foodId";
	return "/products/:foodId";
}
