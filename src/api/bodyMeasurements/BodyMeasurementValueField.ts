/** Circumference fields reported in the account's size unit. */
export const BODY_MEASUREMENT_SIZE_FIELDS = [
	"neck",
	"chest",
	"waist",
	"stomach",
	"hips",
	"thigh",
	"calf",
	"biceps",
] as const;

/** Every numeric field the measurement endpoint accepts, in Fitatu payload order. */
export const BODY_MEASUREMENT_VALUE_FIELDS = ["weight", ...BODY_MEASUREMENT_SIZE_FIELDS, "fatPercentage"] as const;

export type BodyMeasurementValueField = (typeof BODY_MEASUREMENT_VALUE_FIELDS)[number];

/** Numeric measurement values addressed by field name; omitted fields stay untouched in Fitatu. */
export type BodyMeasurementValues = Readonly<Partial<Record<BodyMeasurementValueField, number>>>;
