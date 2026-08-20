import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import type { FitatuApiClientBaseOptions } from "../fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS, type FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { BodyMeasurement } from "./BodyMeasurement.ts";
import { BODY_MEASUREMENT_VALUE_FIELDS } from "./BodyMeasurementValueField.ts";
import type { GetBodyMeasurementRequest } from "./GetBodyMeasurementRequest.ts";
import type { SaveBodyMeasurementRequest } from "./SaveBodyMeasurementRequest.ts";

const MEASUREMENT_ENDPOINT_TEMPLATE = "/users/:userId/measurements/:date";
const MEASUREMENT_NOT_FOUND_STATUS_CODE = 404;

/**
 * HTTP adapter for the Fitatu body measurement endpoints.
 *
 * `PUT` merges the submitted fields into the day's existing measurement: omitted
 * and null fields keep their stored value, so a weight-only call never clears
 * circumferences. There is no range endpoint; history is read one date at a time.
 */
export class BodyMeasurementClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	/** Returns the measurement stored for the date, or null when the day has none. */
	public async findMeasurement(request: GetBodyMeasurementRequest): Promise<BodyMeasurement | null> {
		const operation = FITATU_CLIENT_OPERATIONS.bodyMeasurementGet;
		const userId = requireUserId(request.userId, operation);
		const date = normalizeDate(request.date, operation);

		try {
			return await this.performCallout({
				operation,
				method: "GET",
				path: createMeasurementPath(userId, date),
				endpointTemplate: MEASUREMENT_ENDPOINT_TEMPLATE,
				failureMessage: "Fitatu body measurement request failed",
				invalidResponseMessage: "Fitatu body measurement response was invalid",
				decoder: (data) => BodyMeasurement.fromApiResponse(date, data),
			});
		} catch (error) {
			if (isMeasurementNotFound(error)) {
				return null;
			}

			throw error;
		}
	}

	/** Merges the requested values into the date's measurement and returns the persisted entry. */
	public async saveMeasurement(request: SaveBodyMeasurementRequest): Promise<BodyMeasurement> {
		const operation = FITATU_CLIENT_OPERATIONS.bodyMeasurementSave;
		const userId = requireUserId(request.userId, operation);
		const date = normalizeDate(request.date, operation);
		const weightUnit = requireUnit(request.weightUnit, "weightUnit", operation);
		const sizeUnit = requireUnit(request.sizeUnit, "sizeUnit", operation);
		const values = requireValues(request, operation);

		return this.performCallout({
			operation,
			method: "PUT",
			path: createMeasurementPath(userId, date),
			endpointTemplate: MEASUREMENT_ENDPOINT_TEMPLATE,
			failureMessage: "Fitatu body measurement update failed",
			invalidResponseMessage: "Fitatu body measurement update response was invalid",
			body: JSON.stringify({ date, ...values, weightUnit, sizeUnit }),
			decoder: (data) => BodyMeasurement.fromApiResponse(date, data),
		});
	}
}

function createMeasurementPath(userId: string, date: string): string {
	return `/users/${encodeURIComponent(userId)}/measurements/${date}`;
}

function requireUserId(value: string, operation: FitatuClientOperation): string {
	const userId = StringUtils.firstNonEmptyString(value);
	if (!userId) {
		throw FitatuClientError.invalidRequest({ operation, message: "Fitatu user id is required" });
	}

	return userId;
}

function requireUnit(value: string, fieldName: string, operation: FitatuClientOperation): string {
	const unit = StringUtils.firstNonEmptyString(value);
	if (!unit) {
		throw FitatuClientError.invalidRequest({ operation, message: `${fieldName} is required` });
	}

	return unit;
}

function requireValues(request: SaveBodyMeasurementRequest, operation: FitatuClientOperation): Record<string, number> {
	const values: Record<string, number> = {};

	for (const field of BODY_MEASUREMENT_VALUE_FIELDS) {
		const value = request.values[field];
		if (value === undefined) {
			continue;
		}
		if (!Number.isFinite(value) || value <= 0) {
			throw FitatuClientError.invalidRequest({
				operation,
				message: `${field} must be a positive finite number`,
			});
		}

		values[field] = value;
	}

	if (Object.keys(values).length === 0) {
		throw FitatuClientError.invalidRequest({
			operation,
			message: "At least one measurement value is required",
		});
	}

	return values;
}

function normalizeDate(value: string, operation: FitatuClientOperation): string {
	try {
		return DateUtils.validateIsoDate(value);
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}

		throw FitatuClientError.invalidRequest({ operation, message: error.message });
	}
}

function isMeasurementNotFound(error: unknown): boolean {
	return (
		error instanceof FitatuClientError &&
		error.failure.kind === "http" &&
		error.failure.statusCode === MEASUREMENT_NOT_FOUND_STATUS_CODE
	);
}
