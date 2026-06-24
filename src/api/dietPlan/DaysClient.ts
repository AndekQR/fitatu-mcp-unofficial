import { createFitatuApiErrorDetails, createFitatuApiErrorDetailsFromData } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { DayPlanError } from "../dayPlan/DayPlanError.ts";
import { getApiProblemMessage, parseOptionalJson } from "../dayPlan/DayPlanApiResponse.ts";
import type { SyncDaysRequest } from "./SyncDaysRequest.ts";

/** HTTP adapter for POST /diet-plan/{userId}/days, including Fitatu version fallbacks. */
export class DaysClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public async syncDays(request: SyncDaysRequest): Promise<void> {
		let lastNotFoundError: DayPlanError | undefined;

		for (const path of this.paths(request.userId)) {
			try {
				await this.post(path, request.daysPayload);
				return;
			} catch (error) {
				if (!(error instanceof DayPlanError) || error.statusCode !== 404) throw error;
				lastNotFoundError = error;
			}
		}

		throw lastNotFoundError ?? new DayPlanError("Fitatu day synchronization request failed");
	}

	private async post(path: string, body: Record<string, unknown>): Promise<void> {
		const response = await this.fetchFitatuApi({
			method: "POST",
			path,
			headers: { accept: this.V3_ACCEPT_HEADER, "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			const fitatuApiError = await createFitatuApiErrorDetails(response, { method: "POST", path });
			throw new DayPlanError("Fitatu day synchronization request failed", {
				statusCode: response.status,
				fitatuApiError,
			});
		}
		const data = await parseOptionalJson(response);
		const apiProblem = getApiProblemMessage(data);
		if (apiProblem) {
			throw new DayPlanError(apiProblem, {
				statusCode: response.status,
				fitatuApiError: createFitatuApiErrorDetailsFromData({
					data,
					method: "POST",
					path,
					statusCode: response.status,
					statusText: response.statusText || null,
				}),
			});
		}
	}

	private paths(userId: string): readonly string[] {
		const encodedUserId = encodeURIComponent(userId);
		return [
			`/diet-plan/${encodedUserId}/days`,
			`/v2/diet-plan/${encodedUserId}/days`,
			`/v3/diet-plan/${encodedUserId}/days`,
		];
	}
}
