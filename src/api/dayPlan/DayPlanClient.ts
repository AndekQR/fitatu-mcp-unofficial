import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuUserClient } from "../users/FitatuUserClient.ts";
import { DayPlan } from "./DayPlan.ts";
import type { DayPlanClientOptions } from "./DayPlanClientOptions.ts";
import { DayPlanError } from "./DayPlanError.ts";

interface GetDayPlanOptions {
	readonly date: string;
	readonly userId?: string;
	readonly withRating?: boolean;
}

export class DayPlanClient extends FitatuApiClientBase {
	private static instance: DayPlanClient | undefined;

	private constructor(options: DayPlanClientOptions = {}) {
		const userClient = options.userClient ?? FitatuUserClient.getInstance();
		super({
			...options,
			currentUserProvider:
				options.currentUserProvider ??
				(() => userClient.getAuthenticatedUser()),
		});
	}

	public static getInstance(
		options: DayPlanClientOptions = {},
	): DayPlanClient {
		if (!DayPlanClient.instance) {
			DayPlanClient.instance = new DayPlanClient(options);
		}

		return DayPlanClient.instance;
	}

	public async getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		const date = normalizeDate(options.date);
		const userId = normalizeUserId(
			await this.getAuthenticatedUserId(options.userId),
		);

		const response = await this.fetchAuthenticatedFitatuApi({
			method: "GET",
			path: `/diet-and-activity-plan/${encodeURIComponent(userId)}/day/${date}`,
			query:
				options.withRating === true ? { withRating: true } : undefined,
			userId,
		});

		if (!response.ok) {
			throw new DayPlanError("Fitatu day plan request failed", {
				statusCode: response.status,
			});
		}

		return DayPlan.fromApiResponse({
			data: await response.json(),
			date,
			userId,
		});
	}
}

function normalizeDate(value: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new DayPlanError("date must use YYYY-MM-DD format");
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (
		Number.isNaN(parsed.getTime()) ||
		parsed.toISOString().slice(0, 10) !== date
	) {
		throw new DayPlanError("date must be a valid calendar date");
	}

	return date;
}

function normalizeUserId(value: string): string {
	const userId = value.trim();
	if (!userId) {
		throw new DayPlanError("Fitatu user id is required");
	}

	return userId;
}
