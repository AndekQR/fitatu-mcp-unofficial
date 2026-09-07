import { z } from "zod";
import type { BodyMeasurement } from "../../services/bodyMeasurements/BodyMeasurement.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

const nullableMeasurementValueSchema = z.number().nullable();

export const bodyMeasurementSchema = z
	.object({
		date: isoCalendarDateSchema().describe("Measurement date in YYYY-MM-DD format."),
		weight: nullableMeasurementValueSchema.describe("Body weight in weightUnit, or null when unset."),
		neck: nullableMeasurementValueSchema.describe("Neck circumference in sizeUnit, or null when unset."),
		chest: nullableMeasurementValueSchema.describe("Chest circumference in sizeUnit, or null when unset."),
		waist: nullableMeasurementValueSchema.describe("Waist circumference in sizeUnit, or null when unset."),
		stomach: nullableMeasurementValueSchema.describe("Abdominal circumference in sizeUnit, or null when unset."),
		hips: nullableMeasurementValueSchema.describe("Hip circumference in sizeUnit, or null when unset."),
		thigh: nullableMeasurementValueSchema.describe("Thigh circumference in sizeUnit, or null when unset."),
		calf: nullableMeasurementValueSchema.describe("Calf circumference in sizeUnit, or null when unset."),
		biceps: nullableMeasurementValueSchema.describe("Upper-arm circumference in sizeUnit, or null when unset."),
		fatPercentage: nullableMeasurementValueSchema.describe("Body fat percentage, or null when unset."),
		weightUnit: z.string().trim().min(1).describe("Weight unit configured in the Fitatu profile."),
		sizeUnit: z.string().trim().min(1).describe("Circumference unit configured in the Fitatu profile."),
	})
	.strict();

export const bodyMeasurementNullKeys = [
	"weight",
	"neck",
	"chest",
	"waist",
	"stomach",
	"hips",
	"thigh",
	"calf",
	"biceps",
	"fatPercentage",
] as const;

type BodyMeasurementForMcp = z.infer<typeof bodyMeasurementSchema>;

export function toBodyMeasurementForMcp(measurement: BodyMeasurement): BodyMeasurementForMcp {
	return {
		date: measurement.date,
		weight: measurement.weight,
		neck: measurement.neck,
		chest: measurement.chest,
		waist: measurement.waist,
		stomach: measurement.stomach,
		hips: measurement.hips,
		thigh: measurement.thigh,
		calf: measurement.calf,
		biceps: measurement.biceps,
		fatPercentage: measurement.fatPercentage,
		weightUnit: measurement.weightUnit,
		sizeUnit: measurement.sizeUnit,
	};
}
