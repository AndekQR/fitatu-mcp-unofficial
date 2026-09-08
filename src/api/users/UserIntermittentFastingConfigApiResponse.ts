import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export class UserIntermittentFastingConfigApiResponse {
	public readonly weekDays: readonly number[];
	public readonly type: number | null;
	public readonly default: boolean | null;
	public readonly startDate: string | null;

	private constructor(
		weekDays: readonly number[],
		type: number | null,
		defaultValue: boolean | null,
		startDate: string | null,
	) {
		this.weekDays = weekDays;
		this.type = type;
		this.default = defaultValue;
		this.startDate = startDate;
	}

	public static fromApiResponse(data: unknown): UserIntermittentFastingConfigApiResponse | undefined {
		if (data === undefined) return undefined;
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu intermittent fasting config was not a valid JSON object");
		}

		return new UserIntermittentFastingConfigApiResponse(
			requireNumberArray(data.weekDays, "weekDays"),
			requireNullableNumber(data.type, "type"),
			requireNullableBoolean(data.default, "default"),
			requireNullableString(data.startDate, "startDate"),
		);
	}
}

function requireNumberArray(value: unknown, fieldName: string): readonly number[] {
	if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
		throw new FitatuResponseDecodeError(`Fitatu intermittent fasting config ${fieldName} was not a number array`);
	}
	return value;
}

function requireNullableNumber(value: unknown, fieldName: string): number | null {
	if (value === null) return null;
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new FitatuResponseDecodeError(`Fitatu intermittent fasting config ${fieldName} was not a number or null`);
	}
	return value;
}

function requireNullableBoolean(value: unknown, fieldName: string): boolean | null {
	if (value === null || typeof value === "boolean") return value;
	throw new FitatuResponseDecodeError(`Fitatu intermittent fasting config ${fieldName} was not a boolean or null`);
}

function requireNullableString(value: unknown, fieldName: string): string | null {
	if (value === null || typeof value === "string") return value;
	throw new FitatuResponseDecodeError(`Fitatu intermittent fasting config ${fieldName} was not a string or null`);
}
