import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

async function loadConfigWithEnv(env: NodeJS.ProcessEnv) {
  vi.resetModules();
  process.env = { ...originalEnv, ...env };
  return import("./config.ts");
}

describe("getConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env = originalEnv;
  });

  it("reads Fitatu credentials from environment variables", async () => {
    const { getConfig, getFitatuPassword, getFitatuUsername } =
      await loadConfigWithEnv({
        FITATU_EMAIL: "test@example.com",
        FITATU_PASSWORD: "test-password",
      });

    expect(getConfig()).toMatchObject({
      FITATU_EMAIL: "test@example.com",
      FITATU_PASSWORD: "test-password",
    });
    expect(getFitatuUsername()).toBe("test@example.com");
    expect(getFitatuPassword()).toBe("test-password");
  });

  it("exits when Fitatu email is invalid", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    const { getConfig } = await loadConfigWithEnv({
      FITATU_EMAIL: "not-an-email",
      FITATU_PASSWORD: "test-password",
    });

    expect(() => getConfig()).toThrow("process.exit called");
    expect(exit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalled();
  });
});
