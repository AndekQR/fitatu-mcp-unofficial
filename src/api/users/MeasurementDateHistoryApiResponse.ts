import { DateUtils } from "../../shared/DateUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export class MeasurementDateHistoryApiResponse {
	public readonly dates: readonly string[];

	private constructor(dates: readonly string[]) {
		this.dates = dates;
	}

	public static fromApiResponse(data: unknown): MeasurementDateHistoryApiResponse {
		if (!Array.isArray(data)) {
			throw new FitatuResponseDecodeError("Fitatu measurement history response was not a valid JSON array");
		}

		try {
			return new MeasurementDateHistoryApiResponse(
				data.map((entry) => {
					if (typeof entry !== "object" || entry === null || !("date" in entry)) {
						throw new FitatuResponseDecodeError("Fitatu measurement history entry was invalid");
					}
					return DateUtils.validateIsoDate(entry.date, { fieldName: "measurement history date" });
				}),
			);
		} catch (error) {
			if (error instanceof FitatuResponseDecodeError) throw error;
			if (!(error instanceof ValidationError)) throw error;
			throw new FitatuResponseDecodeError("Fitatu measurement history entry date was invalid");
		}
	}
}
