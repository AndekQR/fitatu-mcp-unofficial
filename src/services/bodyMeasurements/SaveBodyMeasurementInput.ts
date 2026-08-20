import type { BodyMeasurementValues } from "../../api/bodyMeasurements/BodyMeasurementValueField.ts";

/** Measurement values a caller wants merged into one calendar date. */
export class SaveBodyMeasurementInput {
	public readonly date: string;
	public readonly values: BodyMeasurementValues;

	public constructor(date: string, values: BodyMeasurementValues) {
		this.date = date;
		this.values = values;
	}
}
