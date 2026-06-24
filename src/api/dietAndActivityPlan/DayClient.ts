import { createFitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { DayPlanError } from "../dayPlan/DayPlanError.ts";
import type { GetDayRequest } from "./GetDayRequest.ts";
import type { GetDayResponse } from "./GetDayResponse.ts";

/** HTTP adapter for GET /diet-and-activity-plan/{userId}/day/{date}. */
export class DayClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async getDay(request: GetDayRequest): Promise<GetDayResponse> {
		const path = `/diet-and-activity-plan/${encodeURIComponent(request.userId)}/day/${request.date}`;
		const response = await this.fetchFitatuApi({
			method: "GET",
			path,
			headers: { accept: this.V3_ACCEPT_HEADER },
			query: request.withRating === true ? { withRating: true } : undefined,
		});

		if (!response.ok) {
			const fitatuApiError = await createFitatuApiErrorDetails(response, { method: "GET", path });
			throw new DayPlanError("Fitatu day plan request failed", { statusCode: response.status, fitatuApiError });
		}

		const data: unknown = await response.json();
		if (!isRecord(data)) {
			throw new DayPlanError("Fitatu day plan response was not a JSON object");
		}

		return data;
	}
}

function isRecord(value: unknown): value is GetDayResponse {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
