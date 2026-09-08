export class UserSettingsCalculatedValues {
	public readonly basalMetabolicRateKcal: number;
	public readonly totalMetabolicRateKcal: number;
	public readonly physicalActivityLevel: number;
	public readonly calculatedEnergyKcal: number;
	public readonly energyDeficitKcal: number;
	public readonly activityEnergyKcal: number;

	public constructor(
		basalMetabolicRateKcal: number,
		totalMetabolicRateKcal: number,
		physicalActivityLevel: number,
		calculatedEnergyKcal: number,
		energyDeficitKcal: number,
		activityEnergyKcal: number,
	) {
		this.basalMetabolicRateKcal = basalMetabolicRateKcal;
		this.totalMetabolicRateKcal = totalMetabolicRateKcal;
		this.physicalActivityLevel = physicalActivityLevel;
		this.calculatedEnergyKcal = calculatedEnergyKcal;
		this.energyDeficitKcal = energyDeficitKcal;
		this.activityEnergyKcal = activityEnergyKcal;
	}
}
