import { describe, expect, it } from "bun:test";
import { parseEnv } from "../src/env";

const DATABASE_URL_ERROR = /DATABASE_URL/;

describe("parseEnv", () => {
  it("rejects when DATABASE_URL is missing", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: "x".repeat(32) })).toThrow(
      DATABASE_URL_ERROR
    );
  });

  it("accepts a valid env and returns it typed", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3001",
    });
    expect(env.DATABASE_URL).toContain("postgres://");
  });

  it("accepts optional Google credentials", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3001",
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    });
    expect(env.GOOGLE_CLIENT_ID).toBe("gid");
  });

  it("is valid without Google credentials (dev)", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3001",
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  describe("lembretes por e-mail", () => {
    const base = {
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3001",
    };

    it("CRON_SECRET exige 32+ caracteres", () => {
      expect(() =>
        parseEnv({ ...base, CRON_SECRET: "x".repeat(31) })
      ).toThrow();
      expect(
        parseEnv({ ...base, CRON_SECRET: "x".repeat(32) }).CRON_SECRET
      ).toBe("x".repeat(32));
    });

    it("EMAIL_REMINDERS_ENABLED só aceita 'true'", () => {
      expect(
        parseEnv({ ...base, EMAIL_REMINDERS_ENABLED: "true" })
          .EMAIL_REMINDERS_ENABLED
      ).toBe("true");
      expect(() =>
        parseEnv({ ...base, EMAIL_REMINDERS_ENABLED: "yes" })
      ).toThrow();
      expect(parseEnv(base).EMAIL_REMINDERS_ENABLED).toBeUndefined();
    });
  });
});
