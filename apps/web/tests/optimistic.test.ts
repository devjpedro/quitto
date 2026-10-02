import { describe, expect, it } from "vitest";
import { optimisticUpdate } from "@/lib/optimistic";
import { makeTestQueryClient } from "./test-utils";

describe("optimisticUpdate", () => {
  it("applies the update and the returned rollback restores the snapshot", async () => {
    const client = makeTestQueryClient();
    client.setQueryData(["item", "1"], { status: "pending" });
    const rollback = await optimisticUpdate<{ status: string }>(
      client,
      ["item", "1"],
      (c) => (c ? { ...c, status: "paid" } : c)
    );
    expect(client.getQueryData(["item", "1"])).toEqual({ status: "paid" });
    rollback();
    expect(client.getQueryData(["item", "1"])).toEqual({ status: "pending" });
  });

  it("is a no-op when nothing is cached", async () => {
    const client = makeTestQueryClient();
    const rollback = await optimisticUpdate<{ status: string }>(
      client,
      ["item", "2"],
      (c) => c
    );
    expect(client.getQueryData(["item", "2"])).toBeUndefined();
    rollback();
    expect(client.getQueryData(["item", "2"])).toBeUndefined();
  });
});
