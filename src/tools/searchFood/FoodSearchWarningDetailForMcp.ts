import type { FoodSearchWarningDetail } from "../../api/foodSearch/FoodSearchWarningDetail.ts";
import type { FoodSearchSource } from "../../api/foodSearch/FoodSearchSource.ts";
import { FitatuClientErrorPublic } from "../shared/FitatuClientErrorPublic.ts";

export class FoodSearchWarningDetailForMcp {
	public readonly message: string;
	public readonly clientError: FitatuClientErrorPublic;
	public readonly query?: string;
	public readonly source?: FoodSearchSource;

	public constructor(detail: FoodSearchWarningDetail) {
		this.message = detail.message;
		this.clientError = new FitatuClientErrorPublic(detail.clientError);
		this.query = detail.query;
		this.source = detail.source;
	}
}
