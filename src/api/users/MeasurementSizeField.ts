export const MEASUREMENT_SIZE_FIELDS = [
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

export type MeasurementSizeField = (typeof MEASUREMENT_SIZE_FIELDS)[number];
