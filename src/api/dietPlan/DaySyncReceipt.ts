import { DateUtils } from "../../shared/DateUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";

export class DaySyncReceipt {
	public readonly date: string;
	public readonly revision: string | null;
	public readonly errorMessage: string | null;

	private constructor(date: string, revision: string | null, errorMessage: string | null) {
		this.date = date;
		this.revision = revision;
		this.errorMessage = errorMessage;
	}

	public static fromApiResponse(data: unknown): DaySyncReceipt {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuResponseDecodeError("Fitatu day synchronization receipt was not a JSON object");
		}

		try {
			const date = DateUtils.validateIsoDate(data.date, { fieldName: "receipt date" });
			const errorMessage = parseErrorMessage(data.errorMessage);
			const revision =
				data.revision === null || data.revision === undefined
					? null
					: StringUtils.parseNonEmptyString(
							data.revision,
							"Fitatu day synchronization receipt revision is required",
						);
			if (revision === null && errorMessage === null) {
				throw new ValidationError("Fitatu day synchronization receipt revision is required");
			}
			return new DaySyncReceipt(date, revision, errorMessage);
		} catch (error) {
			if (!(error instanceof ValidationError)) {
				throw error;
			}
			throw new FitatuResponseDecodeError(error.message);
		}
	}
}

function parseErrorMessage(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value !== "string") {
		throw new ValidationError("Fitatu day synchronization receipt errorMessage must be a string or null");
	}
	return value.trim() || null;
}
