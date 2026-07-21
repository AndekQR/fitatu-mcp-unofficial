import { DayPlanError } from "../../api/dayPlan/DayPlanError.ts";
import type { GetEnergySummaryResponse } from "../../api/dietPlan/GetEnergySummaryResponse.ts";
import type { GetSummaryResponse, SummaryMeasure } from "../../api/dietPlan/GetSummaryResponse.ts";
import { SummaryClient } from "../../api/dietPlan/SummaryClient.ts";
import { FitatuUserClient } from "../../api/users/FitatuUserClient.ts";
import type { FitatuUserProfile } from "../../api/users/FitatuUserProfile.ts";
import type {
	DietSummaryDailyEnergy,
	DietSummaryEnergy,
	DietSummaryNutrient,
	DietSummaryRequest,
	DietSummaryResult,
	NutrientStatus,
} from "./DietSummaryTypes.ts";

interface SummaryApiClient {
	getSummary(request: {
		readonly userId: string;
		readonly fromDate: string;
		readonly toDate: string;
	}): Promise<GetSummaryResponse>;
	getEnergySummary(request: {
		readonly userId: string;
		readonly fromDate: string;
		readonly toDate: string;
	}): Promise<GetEnergySummaryResponse>;
}

interface CurrentUserProvider {
	getAuthenticatedUser(): Promise<FitatuUserProfile>;
}

const KEY_NUTRIENT_KEYS = [
	"energy",
	"protein",
	"fat",
	"carbohydrate",
	"fiber",
	"sugars",
	"salt",
	"water",
	"saturatedFat",
	"sodium",
] as const;

const NUTRIENT_LABELS: Record<string, string> = {
	activityEnergy: "Activity energy",
	addedActivityEnergy: "Added activity energy",
	animalProtein: "Animal protein",
	caffeine: "Caffeine",
	calcium: "Calcium",
	carbohydrate: "Carbohydrates",
	cholesterol: "Cholesterol",
	copper: "Copper",
	dietEnergy: "Diet energy",
	energy: "Energy",
	fat: "Fat",
	fiber: "Fiber",
	folicAcid: "Folic acid",
	iodine: "Iodine",
	iron: "Iron",
	magnesium: "Magnesium",
	monounsaturatedFat: "Monounsaturated fat",
	omega3: "Omega 3",
	omega6: "Omega 6",
	phosphorus: "Phosphorus",
	polyunsaturatedFat: "Polyunsaturated fat",
	potassium: "Potassium",
	protein: "Protein",
	salt: "Salt",
	saturatedFat: "Saturated fat",
	selenium: "Selenium",
	sodium: "Sodium",
	sugars: "Sugars",
	vegetableProtein: "Vegetable protein",
	vitaminA: "Vitamin A",
	vitaminB1: "Vitamin B1",
	vitaminB12: "Vitamin B12",
	vitaminB2: "Vitamin B2",
	vitaminB5: "Vitamin B5",
	vitaminB6: "Vitamin B6",
	vitaminB7: "Vitamin B7",
	vitaminC: "Vitamin C",
	vitaminD: "Vitamin D",
	vitaminE: "Vitamin E",
	vitaminK: "Vitamin K",
	vitaminPP: "Vitamin PP",
	water: "Water",
	zinc: "Zinc",
};

const NUTRIENT_UNITS: Record<string, string> = {
	activityEnergy: "kcal",
	addedActivityEnergy: "kcal",
	animalProtein: "g",
	caffeine: "mg",
	calcium: "mg",
	carbohydrate: "g",
	cholesterol: "mg",
	copper: "mg",
	dietEnergy: "kcal",
	energy: "kcal",
	fat: "g",
	fiber: "g",
	iodine: "ug",
	iron: "mg",
	magnesium: "mg",
	monounsaturatedFat: "g",
	omega3: "g",
	omega6: "g",
	phosphorus: "mg",
	polyunsaturatedFat: "g",
	potassium: "mg",
	protein: "g",
	salt: "g",
	saturatedFat: "g",
	selenium: "ug",
	sodium: "mg",
	sugars: "g",
	vegetableProtein: "g",
	weight: "g",
	water: "ml",
	zinc: "mg",
};

export interface DietSummaryProvider {
	getDietSummary(request: DietSummaryRequest): Promise<DietSummaryResult>;
}

export class DietSummaryService implements DietSummaryProvider {
	private readonly summaryClient: SummaryApiClient;
	private readonly userClient: CurrentUserProvider;

	public constructor(summaryClient: SummaryApiClient, userClient: CurrentUserProvider) {
		this.summaryClient = summaryClient;
		this.userClient = userClient;
	}

	public static create(
		options: { readonly summaryClient?: SummaryClient; readonly userClient?: FitatuUserClient } = {},
	): DietSummaryService {
		return new DietSummaryService(
			options.summaryClient ?? new SummaryClient(),
			options.userClient ?? FitatuUserClient.getInstance(),
		);
	}

	public async getDietSummary(request: DietSummaryRequest): Promise<DietSummaryResult> {
		const fromDate = normalizeDate(request.fromDate, "fromDate");
		const toDate = normalizeDate(request.toDate, "toDate");
		if (fromDate > toDate) {
			throw new DayPlanError("fromDate must be before or equal to toDate");
		}

		const user = await this.userClient.getAuthenticatedUser();
		const userId = normalizeUserId(user.id);
		const [summary, energySummary] = await Promise.all([
			this.summaryClient.getSummary({ userId, fromDate, toDate }),
			this.summaryClient.getEnergySummary({ userId, fromDate, toDate }),
		]);
		const dates = eachDate(fromDate, toDate);
		const allNutrients = Object.entries(summary).map(([key, measure]) => this.toNutrient(key, measure));

		return {
			period: {
				fromDate,
				toDate,
				dayCount: dates.length,
			},
			energy: this.toEnergy(energySummary, dates),
			keyNutrients: KEY_NUTRIENT_KEYS.flatMap((key) => {
				const nutrient = allNutrients.find((item) => item.key === key);
				return nutrient ? [nutrient] : [];
			}),
			allNutrients,
		};
	}

	private toEnergy(summary: GetEnergySummaryResponse, dates: readonly string[]): DietSummaryEnergy {
		const daily = dates.map((date) => {
			const logged = numberOrNull(summary.measures[date]) ?? 0;
			const target = numberOrNull(summary.targets[date]);
			return {
				date,
				logged,
				target,
				remainingToTarget: target === null ? null : round(target - logged),
			} satisfies DietSummaryDailyEnergy;
		});
		const loggedTotal = sumNumbers(daily.map((item) => item.logged));
		const targetTotal = sumNumbers(daily.map((item) => item.target));
		const dayCount = dates.length || 1;

		return {
			loggedTotal,
			targetTotal,
			averageLogged: round(loggedTotal / dayCount),
			averageTarget: round(targetTotal / dayCount),
			remainingToTarget: round(targetTotal - loggedTotal),
			daily,
		};
	}

	private toNutrient(key: string, measure: SummaryMeasure): DietSummaryNutrient {
		const current = numberOrNull(measure.current);
		const min = numberOrNull(measure.min);
		const max = numberOrNull(measure.max);
		const status = nutrientStatus(current, min, max);

		return {
			key,
			label: NUTRIENT_LABELS[key] ?? labelFromKey(key),
			unit: NUTRIENT_UNITS[key],
			current,
			min,
			max,
			eaten: numberOrNull(measure.eaten),
			status,
			amountToMinimum: current !== null && min !== null && current < min ? round(min - current) : undefined,
			amountOverMaximum: current !== null && max !== null && current > max ? round(current - max) : undefined,
			remainingToMaximum: current !== null && max !== null && current <= max ? round(max - current) : undefined,
		};
	}
}

function nutrientStatus(current: number | null, min: number | null, max: number | null): NutrientStatus {
	if (current === null) {
		return "noValue";
	}
	if (min === null && max === null) {
		return "noTarget";
	}
	if (min !== null && current < min) {
		return "belowMin";
	}
	if (max !== null && current > max) {
		return "aboveMax";
	}
	return "withinRange";
}

function normalizeDate(value: string, fieldName: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new DayPlanError(`${fieldName} must use YYYY-MM-DD format`);
	}
	if (date.startsWith("0000-")) {
		throw new DayPlanError(`${fieldName} year must be between 0001 and 9999`);
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new DayPlanError(`${fieldName} must be a valid calendar date`);
	}

	return date;
}

function normalizeUserId(value: string | null | undefined): string {
	const userId = value?.trim();
	if (!userId) {
		throw new DayPlanError("Fitatu user id is required");
	}

	return userId;
}

function eachDate(fromDate: string, toDate: string): readonly string[] {
	const dates: string[] = [];
	const cursor = new Date(`${fromDate}T00:00:00.000Z`);
	const end = new Date(`${toDate}T00:00:00.000Z`);

	while (cursor <= end) {
		dates.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return dates;
}

function sumNumbers(values: readonly (number | null)[]): number {
	return round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

function numberOrNull(value: number | null | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) ? round(value) : null;
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

function labelFromKey(key: string): string {
	return key.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());
}
