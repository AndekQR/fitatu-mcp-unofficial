import { DateUtils } from "../../shared/DateUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import type { DaySyncReceipt } from "../dietPlan/DaySyncReceipt.ts";

export class DayRevisions {
	private readonly entries: readonly (readonly [string, string])[];

	private constructor(entries: readonly (readonly [string, string])[]) {
		this.entries = Object.freeze(entries.map(([date, revision]) => Object.freeze([date, revision] as const)));
	}

	public static empty(): DayRevisions {
		return new DayRevisions([]);
	}

	public static fromReceipts(receipts: readonly DaySyncReceipt[]): DayRevisions {
		const entries: [string, string][] = [];
		const dates = new Set<string>();

		for (const receipt of receipts) {
			if (receipt.errorMessage !== null || receipt.revision === null) {
				throw new ValidationError("Only successful Fitatu day synchronization receipts have revisions");
			}
			if (dates.has(receipt.date)) {
				throw new ValidationError(`Fitatu returned duplicate synchronization receipts for ${receipt.date}`);
			}
			dates.add(receipt.date);
			entries.push([receipt.date, receipt.revision]);
		}

		return new DayRevisions(entries);
	}

	public static fromRecord(revisions: Readonly<Record<string, string>>): DayRevisions {
		const entries = Object.entries(revisions).map(
			([date, revision]) =>
				[
					DateUtils.validateIsoDate(date, { fieldName: "day revision date" }),
					StringUtils.parseNonEmptyString(revision, "day revision is required"),
				] as const,
		);
		return new DayRevisions(entries);
	}

	public toRecord(): Readonly<Record<string, string>> {
		return Object.freeze(Object.fromEntries(this.entries));
	}
}
