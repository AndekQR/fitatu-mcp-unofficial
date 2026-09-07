import { z } from "zod";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

const measurementApiResponseSchema = z.object({
	weight: z.number().nullable(),
	neck: z.number().nullable(),
	chest: z.number().nullable(),
	waist: z.number().nullable(),
	stomach: z.number().nullable(),
	hips: z.number().nullable(),
	thigh: z.number().nullable(),
	calf: z.number().nullable(),
	biceps: z.number().nullable(),
	fatPercentage: z.number().nullable(),
	weightUnit: z.string().trim().min(1),
	sizeUnit: z.string().trim().min(1),
});

type MeasurementApiResponseData = z.infer<typeof measurementApiResponseSchema>;

export class MeasurementApiResponse {
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

	private constructor(data: MeasurementApiResponseData) {
		this.weight = data.weight;
		this.neck = data.neck;
		this.chest = data.chest;
		this.waist = data.waist;
		this.stomach = data.stomach;
		this.hips = data.hips;
		this.thigh = data.thigh;
		this.calf = data.calf;
		this.biceps = data.biceps;
		this.fatPercentage = data.fatPercentage;
		this.weightUnit = data.weightUnit;
		this.sizeUnit = data.sizeUnit;
	}

	public static fromApiResponse(data: unknown): MeasurementApiResponse {
		const result = measurementApiResponseSchema.safeParse(data);
		if (!result.success) {
			throw new FitatuResponseDecodeError("Fitatu measurement response was invalid");
		}

		return new MeasurementApiResponse(result.data);
	}
}
