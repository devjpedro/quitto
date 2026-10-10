import { describe, expect, it } from "vitest";
import { contractsListSearch } from "@/features/contracts/lib/contracts-list-search";

describe("contractsListSearch", () => {
  it("show e side válidos ficam; qualquer outro valor some", () => {
    expect(contractsListSearch({ show: "done", side: "pay" })).toEqual({
      show: "done",
      side: "pay",
    });
    expect(contractsListSearch({ side: "receive" })).toEqual({
      show: undefined,
      side: "receive",
    });
    expect(contractsListSearch({ show: "active", side: "all" })).toEqual({
      show: undefined,
      side: undefined,
    });
    expect(contractsListSearch({ show: 1, side: ["pay"] })).toEqual({
      show: undefined,
      side: undefined,
    });
  });
});
