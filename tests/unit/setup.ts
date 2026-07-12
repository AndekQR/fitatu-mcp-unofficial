import { beforeEach, vi } from "vitest";

const rejectUnexpectedNetworkRequest: typeof fetch = async () => {
	throw new Error("Unexpected network request in a unit test. Inject an explicit fetchFn test double.");
};

vi.stubGlobal("fetch", rejectUnexpectedNetworkRequest);

beforeEach(() => {
	vi.stubGlobal("fetch", rejectUnexpectedNetworkRequest);
});
