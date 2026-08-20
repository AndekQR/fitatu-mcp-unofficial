import { z } from "zod";
import type { BodyMeasurement } from "../../api/bodyMeasurements/BodyMeasurement.ts";

const optionalMeasurementValue = z.number().optional();

export const bodyMeasurementSchema = z
	.object({
		date: z.string().describe("Measurement date in YYYY-MM-DD format."),
		weight: optionalMeasurementValue.describe("Body weight in weightUnit, when recorded."),
		neck: optionalMeasurementValue.describe("Neck circumference in sizeUnit, when recorded."),
		chest: optionalMeasurementValue.describe("Chest circumference in sizeUnit, when recorded."),
		waist: optionalMeasurementValue.describe("Waist circumference in sizeUnit, when recorded."),
		stomach: optionalMeasurementValue.describe("Stomach circumference in sizeUnit, when recorded."),
		hips: optionalMeasurementValue.describe("Hips circumference in sizeUnit, when recorded."),
		thigh: optionalMeasurementValue.describe("Thigh circumference in sizeUnit, when recorded."),
		calf: optionalMeasurementValue.describe("Calf circumference in sizeUnit, when recorded."),
		biceps: optionalMeasurementValue.describe("Biceps circumference in sizeUnit, when recorded."),
		fatPercentage: optionalMeasurementValue.describe("Body fat percentage, when recorded."),
		weightUnit: z.string().optional().describe("Unit of the weight value, for example KG."),
		sizeUnit: z.string().optional().describe("Unit of the circumference values, for example CM."),
	})
	.describe("Body measurement stored by Fitatu for a single date.");

export type BodyMeasurementForMcp = z.infer<typeof bodyMeasurementSchema>;

export function toBodyMeasurementForMcp(measurement: BodyMeasurement): BodyMeasurementForMcp {
	return {
		date: measurement.date,
		weight: measurement.weight ?? undefined,
		neck: measurement.neck ?? undefined,
		chest: measurement.chest ?? undefined,
		waist: measurement.waist ?? undefined,
		stomach: measurement.stomach ?? undefined,
		hips: measurement.hips ?? undefined,
		thigh: measurement.thigh ?? undefined,
		calf: measurement.calf ?? undefined,
		biceps: measurement.biceps ?? undefined,
		fatPercentage: measurement.fatPercentage ?? undefined,
		weightUnit: measurement.weightUnit ?? undefined,
		sizeUnit: measurement.sizeUnit ?? undefined,
	};
}
