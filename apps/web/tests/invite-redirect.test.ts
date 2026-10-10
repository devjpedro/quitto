import { describe, expect, it } from "vitest";
import {
  invitePath,
  inviteTokenOf,
} from "@/features/invites/lib/invite-redirect";

describe("inviteTokenOf", () => {
  it("o token de um redirect para o convite", () => {
    expect(inviteTokenOf(invitePath("abc123"))).toBe("abc123");
  });

  it("nada para outro caminho, um caminho mais fundo ou nenhum", () => {
    expect(inviteTokenOf("/contracts/x")).toBeNull();
    expect(inviteTokenOf("/invites/abc/accept")).toBeNull();
    expect(inviteTokenOf("/invites/")).toBeNull();
    expect(inviteTokenOf(undefined)).toBeNull();
  });
});
