import type { DaySyncPayload } from "./DaySyncPayload.ts";

export abstract class DayPlanSyncProvider {
	public abstract getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload>;
	public abstract syncSingleDay(userId: string, date: string, dayPayload: DaySyncPayload): Promise<void>;
	public abstract syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<void>;
}
