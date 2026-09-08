import { describe, expect, it } from "vitest";
import type { BodyMeasurement } from "../../../src/services/bodyMeasurements/BodyMeasurement.ts";
import { BodyMeasurementService } from "../../../src/services/bodyMeasurements/BodyMeasurementService.ts";
import { BodyMeasurementUpdate } from "../../../src/services/bodyMeasurements/BodyMeasurementUpdate.ts";
import { IntegrationTestContext } from "../helpers/IntegrationTestContext.ts";

const date = "2000-01-01";
const initialWeight = 70;
const context = IntegrationTestContext.fromEnvironment();
const service = new BodyMeasurementService(context.measurementsClient, context.userClient);

const measurementFields = [
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

type MeasurementField = (typeof measurementFields)[number];

describe.sequential("Fitatu body measurement integration workflow", () => {
	it("creates a measurement when needed, partially updates, reads, and restores it", async () => {
		const existing = await service.getBodyMeasurement(date);
		const original =
			existing ?? (await service.saveBodyMeasurement(new BodyMeasurementUpdate(date, initialWeight)));
		const field = selectRestorableField(original);
		const originalValue = original[field];
		if (originalValue === null) throw new Error("Selected body measurement field must have a value");
		const temporaryValue = createTemporaryValue(field, originalValue);
		let changed = false;

		try {
			changed = true;
			const saved = await service.saveBodyMeasurement(createUpdate(date, field, temporaryValue));
			expect(saved[field] === temporaryValue).toBe(true);

			const read = await service.getBodyMeasurement(date);
			expect(read !== null).toBe(true);
			expect(read?.[field] === temporaryValue).toBe(true);
			expect(read !== null && omittedValuesArePreserved(read, original, field)).toBe(true);
		} finally {
			if (changed) {
				await service.saveBodyMeasurement(createUpdate(date, field, originalValue));
				const restored = await service.getBodyMeasurement(date);
				expect(restored?.[field] === originalValue).toBe(true);
			}
		}
	});
});

function selectRestorableField(measurement: BodyMeasurement): MeasurementField {
	const field = measurementFields.find((candidate) => {
		const value = measurement[candidate];
		return value !== null && value > 0.01;
	});
	if (!field) throw new Error("Configured measurement must contain a restorable positive value");
	return field;
}

function createTemporaryValue(field: MeasurementField, originalValue: number): number {
	return field === "fatPercentage" && originalValue >= 99.99
		? Math.round((originalValue - 0.01) * 100) / 100
		: Math.round((originalValue + 0.01) * 100) / 100;
}

function omittedValuesArePreserved(
	actual: BodyMeasurement,
	expected: BodyMeasurement,
	changedField: MeasurementField,
): boolean {
	return measurementFields.every((field) => field === changedField || actual[field] === expected[field]);
}

function createUpdate(date: string, field: MeasurementField, value: number): BodyMeasurementUpdate {
	switch (field) {
		case "weight":
			return new BodyMeasurementUpdate(date, value);
		case "neck":
			return new BodyMeasurementUpdate(date, undefined, value);
		case "chest":
			return new BodyMeasurementUpdate(date, undefined, undefined, value);
		case "waist":
			return new BodyMeasurementUpdate(date, undefined, undefined, undefined, value);
		case "stomach":
			return new BodyMeasurementUpdate(date, undefined, undefined, undefined, undefined, value);
		case "hips":
			return new BodyMeasurementUpdate(date, undefined, undefined, undefined, undefined, undefined, value);
		case "thigh":
			return new BodyMeasurementUpdate(
				date,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				value,
			);
		case "calf":
			return new BodyMeasurementUpdate(
				date,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				value,
			);
		case "biceps":
			return new BodyMeasurementUpdate(
				date,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				value,
			);
		case "fatPercentage":
			return new BodyMeasurementUpdate(
				date,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				value,
			);
	}
}
