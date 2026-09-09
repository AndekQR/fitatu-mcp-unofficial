import { describe, expect, it } from "vitest";
import { AutomaticEnergyTargetUpdate } from "../../../src/services/userSettings/AutomaticEnergyTargetUpdate.ts";
import { ManualEnergyTargetUpdate } from "../../../src/services/userSettings/ManualEnergyTargetUpdate.ts";
import { UserSettingsService } from "../../../src/services/userSettings/UserSettingsService.ts";
import type { UserSettingsSnapshot } from "../../../src/services/userSettings/UserSettingsSnapshot.ts";
import { UserSettingsUpdate } from "../../../src/services/userSettings/UserSettingsUpdate.ts";
import { IntegrationTestContext } from "../helpers/IntegrationTestContext.ts";

const context = IntegrationTestContext.fromEnvironment();
const service = new UserSettingsService(context.userSettingsClient, context.userClient);

describe.sequential("Fitatu user settings integration workflow", () => {
	it("reads the current settings and resolves the same snapshot for an explicit date", async () => {
		const current = await service.getUserSettings();
		const explicit = await service.getUserSettings(current.requestedDate);

		expect(current.requestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(current.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(explicit).toMatchObject({
			requestedDate: current.requestedDate,
			effectiveDate: current.effectiveDate,
			energyTarget: current.energyTarget,
			waterServingSizeMl: current.waterServingSizeMl,
		});
	});

	it("updates manual and automatic energy settings with water, then restores the original settings", async () => {
		const original = await service.getUserSettings();
		const restoration = createRestorationUpdate(original);
		const temporaryKcal = original.energyTarget.kcal === 2_001 ? 2_002 : 2_001;
		const temporaryWaterServingSizeMl = original.waterServingSizeMl === 251 ? 252 : 251;
		let mutationAttempted = false;

		try {
			mutationAttempted = true;
			const manual = await service.updateUserSettings(
				new UserSettingsUpdate(
					new ManualEnergyTargetUpdate(temporaryKcal, 25, 25, 50),
					temporaryWaterServingSizeMl,
				),
			);
			expect(manual).toMatchObject({
				energyTarget: {
					mode: "manual",
					kcal: temporaryKcal,
					macronutrientDistribution: {
						proteinPercentage: 25,
						fatPercentage: 25,
						carbohydratePercentage: 50,
					},
				},
				waterServingSizeMl: temporaryWaterServingSizeMl,
			});

			const manualRead = await service.getUserSettings(manual.effectiveDate);
			expect(manualRead).toMatchObject({
				energyTarget: { mode: "manual", kcal: temporaryKcal },
				waterServingSizeMl: temporaryWaterServingSizeMl,
			});

			const automatic = await service.updateUserSettings(
				new UserSettingsUpdate(new AutomaticEnergyTargetUpdate()),
			);
			expect(automatic.energyTarget.mode).toBe("automatic");
			expect(automatic.waterServingSizeMl).toBe(temporaryWaterServingSizeMl);

			const automaticRead = await service.getUserSettings(automatic.effectiveDate);
			expect(automaticRead.energyTarget.mode).toBe("automatic");
			expect(automaticRead.waterServingSizeMl).toBe(temporaryWaterServingSizeMl);
		} finally {
			if (mutationAttempted) {
				await service.updateUserSettings(restoration);
				const restored = await service.getUserSettings(original.effectiveDate);
				expectSupportedSettings(restored, original);
			}
		}
	});
});

function createRestorationUpdate(settings: UserSettingsSnapshot): UserSettingsUpdate {
	const waterServingSizeMl = settings.waterServingSizeMl;
	if (waterServingSizeMl === undefined) {
		throw new Error("The integration-test account must have a restorable water serving size");
	}

	if (settings.energyTarget.mode === "automatic") {
		return new UserSettingsUpdate(new AutomaticEnergyTargetUpdate(), waterServingSizeMl);
	}

	const distribution = settings.energyTarget.macronutrientDistribution;
	if (
		distribution === undefined ||
		distribution.proteinPercentage === null ||
		distribution.fatPercentage === null ||
		distribution.carbohydratePercentage === null
	) {
		throw new Error("The integration-test account must have a restorable macronutrient distribution");
	}

	return new UserSettingsUpdate(
		new ManualEnergyTargetUpdate(
			settings.energyTarget.kcal,
			distribution.proteinPercentage,
			distribution.fatPercentage,
			distribution.carbohydratePercentage,
		),
		waterServingSizeMl,
	);
}

function expectSupportedSettings(actual: UserSettingsSnapshot, expected: UserSettingsSnapshot): void {
	expect(actual.energyTarget).toEqual(expected.energyTarget);
	expect(actual.waterServingSizeMl).toBe(expected.waterServingSizeMl);
}
