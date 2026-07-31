import type { DayRevisions } from "./DayRevisions.ts";
import type { DaySyncPayload } from "./DaySyncPayload.ts";

export abstract class DayPlanSyncProvider {
	public abstract getDaySyncPayload(userId: string, date: string): Promise<DaySyncPayload>;
	public abstract syncSingleDay(userId: string, date: string, dayPayload: DaySyncPayload): Promise<DayRevisions>;
	public abstract syncDays(userId: string, daysPayload: Record<string, unknown>): Promise<DayRevisions>;
}
