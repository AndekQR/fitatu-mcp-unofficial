import { z } from "zod";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

/**
 * Fitatu stores measurements as doubles, so values come back as 84.599999999999994
 * instead of 84.6. Two decimal places cover every unit the endpoint accepts.
 */
const MEASUREMENT_DECIMAL_PLACES = 2;

const nullableNumberSchema = z.number().finite().nullable().optional();
const bodyMeasurementResponseSchema = z.object({
	weight: nullableNumberSchema,
	neck: nullableNumberSchema,
	chest: nullableNumberSchema,
	waist: nullableNumberSchema,
	stomach: nullableNumberSchema,
	hips: nullableNumberSchema,
	thigh: nullableNumberSchema,
	calf: nullableNumberSchema,
	biceps: nullableNumberSchema,
	fatPercentage: nullableNumberSchema,
	weightUnit: z.string().nullable().optional(),
	sizeUnit: z.string().nullable().optional(),
});

type BodyMeasurementResponse = z.infer<typeof bodyMeasurementResponseSchema>;

/** One Fitatu body measurement entry, always bound to a single calendar date. */
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
	public readonly weightUnit: string | null;
	public readonly sizeUnit: string | null;

	private constructor(date: string, data: BodyMeasurementResponse) {
		this.date = date;
		this.weight = roundMeasurement(data.weight);
		this.neck = roundMeasurement(data.neck);
		this.chest = roundMeasurement(data.chest);
		this.waist = roundMeasurement(data.waist);
		this.stomach = roundMeasurement(data.stomach);
		this.hips = roundMeasurement(data.hips);
		this.thigh = roundMeasurement(data.thigh);
		this.calf = roundMeasurement(data.calf);
		this.biceps = roundMeasurement(data.biceps);
		this.fatPercentage = roundMeasurement(data.fatPercentage);
		this.weightUnit = data.weightUnit ?? null;
		this.sizeUnit = data.sizeUnit ?? null;
	}

	public static fromApiResponse(date: string, data: unknown): BodyMeasurement {
		const result = bodyMeasurementResponseSchema.safeParse(data);
		if (!result.success) {
			throw new FitatuResponseDecodeError("Fitatu body measurement response was invalid");
		}

		return new BodyMeasurement(date, result.data);
	}
}

function roundMeasurement(value: number | null | undefined): number | null {
	if (value === null || value === undefined) {
		return null;
	}

	const factor = 10 ** MEASUREMENT_DECIMAL_PLACES;
	return Math.round(value * factor) / factor;
}
