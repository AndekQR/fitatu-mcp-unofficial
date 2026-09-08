import type { AutomaticEnergyTarget } from "./AutomaticEnergyTarget.ts";
import type { ManualEnergyTarget } from "./ManualEnergyTarget.ts";

export type EnergyTarget = AutomaticEnergyTarget | ManualEnergyTarget;
export type EnergyTargetMode = EnergyTarget["mode"];
