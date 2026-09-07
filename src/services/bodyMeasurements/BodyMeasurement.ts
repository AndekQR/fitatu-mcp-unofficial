import type { MeasurementApiResponse } from "../../api/users/MeasurementApiResponse.ts";

export class BodyMeasurement {
	public readonly date: string;
	public readonly weight: number | null;
	public readonly neck: number | null;
	public readonly chest: number | null;
	public readonly waist: number | null;
	public readonly stomach: number | null;
	public readonly hips: number | null;
	public readonly thigh: number | null;
	public readonly calf: number | null;
	public readonly biceps: number | null;
	public readonly fatPercentage: number | null;
	public readonly weightUnit: string;
	public readonly sizeUnit: string;

	public constructor(date: string, response: MeasurementApiResponse) {
		this.date = date;
		this.weight = roundNullable(response.weight);
		this.neck = roundNullable(response.neck);
		this.chest = roundNullable(response.chest);
		this.waist = roundNullable(response.waist);
		this.stomach = roundNullable(response.stomach);
		this.hips = roundNullable(response.hips);
		this.thigh = roundNullable(response.thigh);
		this.calf = roundNullable(response.calf);
		this.biceps = roundNullable(response.biceps);
		this.fatPercentage = roundNullable(response.fatPercentage);
		this.weightUnit = response.weightUnit;
		this.sizeUnit = response.sizeUnit;
	}
}

function roundNullable(value: number | null): number | null {
	return value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100;
}
