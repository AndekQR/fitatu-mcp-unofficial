export interface SaveMeasurementRequest {
	readonly userId: string;
	readonly date: string;
	readonly weightUnit: string;
	readonly sizeUnit: string;
	readonly weight?: number;
	readonly neck?: number;
	readonly chest?: number;
	readonly waist?: number;
	readonly stomach?: number;
	readonly hips?: number;
	readonly thigh?: number;
	readonly calf?: number;
	readonly biceps?: number;
	readonly fatPercentage?: number;
}
