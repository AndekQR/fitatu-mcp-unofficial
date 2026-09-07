import { DateUtils } from "../../shared/DateUtils.ts";
import { ServiceError } from "../ServiceError.ts";
import { SERVICE_ERROR_CODES } from "../ServiceErrorCode.ts";

export class BodyMeasurementUpdate {
	public readonly date: string;
	public readonly weight?: number;
	public readonly neck?: number;
	public readonly chest?: number;
	public readonly waist?: number;
	public readonly stomach?: number;
	public readonly hips?: number;
	public readonly thigh?: number;
	public readonly calf?: number;
	public readonly biceps?: number;
	public readonly fatPercentage?: number;

	public constructor(
		date: string,
		weight?: number,
		neck?: number,
		chest?: number,
		waist?: number,
		stomach?: number,
		hips?: number,
		thigh?: number,
		calf?: number,
		biceps?: number,
		fatPercentage?: number,
	) {
		this.date = DateUtils.validateIsoDate(date);
		this.weight = normalizeValue("weight", weight);
		this.neck = normalizeValue("neck", neck);
		this.chest = normalizeValue("chest", chest);
		this.waist = normalizeValue("waist", waist);
		this.stomach = normalizeValue("stomach", stomach);
		this.hips = normalizeValue("hips", hips);
		this.thigh = normalizeValue("thigh", thigh);
		this.calf = normalizeValue("calf", calf);
		this.biceps = normalizeValue("biceps", biceps);
		this.fatPercentage = normalizeValue("fatPercentage", fatPercentage, 100);

		if (
			[
				this.weight,
				this.neck,
				this.chest,
				this.waist,
				this.stomach,
				this.hips,
				this.thigh,
				this.calf,
				this.biceps,
				this.fatPercentage,
			].every((value) => value === undefined)
		) {
			throw new ServiceError(
				"At least one body measurement value is required",
				"invalidInput",
				SERVICE_ERROR_CODES.bodyMeasurementValueRequired,
			);
		}
	}
}

function normalizeValue(field: string, value: number | undefined, maximum?: number): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value <= 0 ||
		(maximum !== undefined && value > maximum)
	) {
		throw new ServiceError(
			maximum === undefined
				? `${field} must be a finite number greater than zero`
				: `${field} must be a finite number greater than zero and less than or equal to ${maximum}`,
			"invalidInput",
			SERVICE_ERROR_CODES.invalidBodyMeasurementValue,
		);
	}
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
