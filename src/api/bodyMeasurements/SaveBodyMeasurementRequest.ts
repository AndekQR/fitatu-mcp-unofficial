import type { BodyMeasurementValues } from "./BodyMeasurementValueField.ts";

export interface SaveBodyMeasurementRequest {
	readonly userId: string;
	readonly date: string;
	readonly weightUnit: string;
	readonly sizeUnit: string;
	readonly values: BodyMeasurementValues;
}
