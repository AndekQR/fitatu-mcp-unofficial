import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import { FoodSearchApiResponse } from "../foodSearch/FoodSearchApiResponse.ts";
import { FavouriteFoodsRequest } from "./FavouriteFoodsRequest.ts";

const DEFAULT_ACCEPT_HEADER = "application/json";

export class FavouritesClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions) {
		super(options);
	}

	public getFavouriteFoods(request: FavouriteFoodsRequest): Promise<FoodSearchApiResponse> {
		return FitatuFallbackRunner.run(
			[{ accept: this.V3_ACCEPT_HEADER }, { accept: DEFAULT_ACCEPT_HEADER }],
			(headers) =>
				this.performCallout({
					operation: FITATU_CLIENT_OPERATIONS.foodFavouritesGet,
					method: "GET",
					path: `/users/${encodeURIComponent(request.userId)}/favorite/foods`,
					endpointTemplate: "/users/:userId/favorite/foods",
					query: {
						page: 1,
						limit: request.limit,
						...(request.phrase === undefined ? {} : { phrase: request.phrase }),
					},
					headers,
					failureMessage: "Fitatu favourite foods request failed",
					invalidResponseMessage: "Fitatu favourite foods response was not valid JSON",
					decoder: FoodSearchApiResponse.fromApiResponse,
				}),
			(error) => error.failure.kind === "http",
		);
	}
}
