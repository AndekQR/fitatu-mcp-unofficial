import { beforeEach, vi } from "vitest";

process.env.LOG_LEVEL = "silent";

const rejectUnexpectedNetworkRequest: typeof fetch = async () => {
	throw new Error("Unexpected network request in a unit test. Inject an explicit fetchFn test double.");
};

vi.stubGlobal("fetch", rejectUnexpectedNetworkRequest);

beforeEach(() => {
	vi.stubGlobal("fetch", rejectUnexpectedNetworkRequest);
});
