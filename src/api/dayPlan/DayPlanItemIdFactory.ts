import { randomBytes } from "node:crypto";

let uuidSequence = 0n;

export function createPlanDayDietItemId(): string {
	const uuidEpochOffset = 122_192_928_000_000_000n;
	const timestamp = BigInt(Date.now()) * 10_000n + uuidEpochOffset + (uuidSequence++ % 10_000n);
	const timeLow = Number(timestamp & 0xffffffffn);
	const timeMid = Number((timestamp >> 32n) & 0xffffn);
	const timeHighAndVersion = Number((timestamp >> 48n) & 0x0fffn) | 0x1000;
	const clockSequence = randomBytes(2);
	const clockSequenceHigh = (clockSequence[0] & 0x3f) | 0x80;
	const clockSequenceLow = clockSequence[1];
	const node = randomBytes(6).toString("hex");

	return [
		timeLow.toString(16).padStart(8, "0"),
		timeMid.toString(16).padStart(4, "0"),
		timeHighAndVersion.toString(16).padStart(4, "0"),
		`${clockSequenceHigh.toString(16).padStart(2, "0")}${clockSequenceLow.toString(16).padStart(2, "0")}`,
		node,
	].join("-");
}
