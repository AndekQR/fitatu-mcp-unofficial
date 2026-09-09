import { z } from "zod";
import type { UserSettingsSnapshot } from "../../services/userSettings/UserSettingsSnapshot.ts";
import { isoCalendarDateSchema } from "../shared/ToolSchemas.ts";

const macroPercentageOutputSchema = z.number().finite().nullable().optional();

const energyTargetOutputSchema = (mode: "manual" | "automatic") =>
	z
		.object({
			mode: z.literal(mode).describe("How the daily energy target is determined."),
			kcal: z.number().finite().describe("Effective daily energy target returned by Fitatu, in kcal."),
			proteinPercentage: macroPercentageOutputSchema.describe(
				"Protein share returned by Fitatu. All three macro percentages are present together or omitted together.",
			),
			fatPercentage: macroPercentageOutputSchema.describe(
				"Fat share returned by Fitatu. All three macro percentages are present together or omitted together.",
			),
			carbohydratePercentage: macroPercentageOutputSchema.describe(
				"Carbohydrate share returned by Fitatu. All three macro percentages are present together or omitted together.",
			),
		})
		.strict()
		.refine(
			(target) => {
				const supplied = [target.proteinPercentage, target.fatPercentage, target.carbohydratePercentage].filter(
					(value) => value !== undefined,
				).length;
				return supplied === 0 || supplied === 3;
			},
			{ message: "Fitatu macro percentages must be returned together" },
		);

export const userSettingsSnapshotOutputSchema = z
	.object({
		requestedDate: isoCalendarDateSchema().describe(
			"Calendar date requested from Fitatu when resolving this snapshot. For update responses, which are not date-addressed, this equals effectiveDate.",
		),
		effectiveDate: isoCalendarDateSchema().describe(
			"Calendar date of the settings snapshot returned by Fitatu. It can be earlier than requestedDate when older settings remain effective.",
		),
		energyTarget: z.discriminatedUnion("mode", [
			energyTargetOutputSchema("manual"),
			energyTargetOutputSchema("automatic"),
		]),
		calculatedValues: z
			.object({
				basalMetabolicRateKcal: z.number().finite().describe("Basal metabolic rate calculated by Fitatu."),
				totalMetabolicRateKcal: z.number().finite().describe("Total metabolic rate calculated by Fitatu."),
				physicalActivityLevel: z.number().finite().describe("Physical activity level calculated by Fitatu."),
				calculatedEnergyKcal: z
					.number()
					.finite()
					.describe("Automatic daily energy target calculated by Fitatu."),
				energyDeficitKcal: z.number().finite().describe("Energy deficit calculated by Fitatu."),
				activityEnergyKcal: z.number().finite().describe("Activity energy calculated by Fitatu."),
			})
			.strict()
			.optional(),
		waterServingSizeMl: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Volume in millilitres represented by one default water serving."),
	})
	.strict();

export const userSettingsNullKeys = ["proteinPercentage", "fatPercentage", "carbohydratePercentage"] as const;

export function toUserSettingsForMcp(settings: UserSettingsSnapshot): z.infer<typeof userSettingsSnapshotOutputSchema> {
	const distribution = settings.energyTarget.macronutrientDistribution;
	return {
		requestedDate: settings.requestedDate,
		effectiveDate: settings.effectiveDate,
		energyTarget: {
			mode: settings.energyTarget.mode,
			kcal: settings.energyTarget.kcal,
			proteinPercentage: distribution?.proteinPercentage,
			fatPercentage: distribution?.fatPercentage,
			carbohydratePercentage: distribution?.carbohydratePercentage,
		},
		calculatedValues: settings.calculatedValues,
		waterServingSizeMl: settings.waterServingSizeMl,
	};
}
