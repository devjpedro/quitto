import { describe, expect, it } from "vitest";
import {
  verifyCallback,
  verifyTarget,
} from "@/features/auth/lib/verify-redirect";

const BACKSLASH = String.fromCharCode(92);

describe("verify-redirect", () => {
  it("verifyCallback leva o alvo codificado", () => {
    expect(verifyCallback("/invites/tok?x=1")).toBe(
      "/verify-email?redirect=%2Finvites%2Ftok%3Fx%3D1"
    );
  });

  it("verifyTarget: caminho da casa passa (com search e hash)", () => {
    expect(verifyTarget("/contracts?tab=a#x")).toBe("/contracts?tab=a#x");
  });

  it("verifyTarget: outra origem, // e caminhos tortos viram /", () => {
    for (const raw of [
      undefined,
      "",
      "https://evil.example/x",
      "//evil.example/x",
      `/${BACKSLASH}evil.example`,
      "javascript:alert(1)",
    ]) {
      expect(verifyTarget(raw)).toBe("/");
    }
  });
});
