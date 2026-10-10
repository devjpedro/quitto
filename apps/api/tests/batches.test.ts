import { describe, expect, it } from "bun:test";
import { batches, inBatches } from "../src/lib/batches";

describe("batches", () => {
  it("fatia em pedaços de até `size`, na ordem", () => {
    expect(batches([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
    expect(batches([], 3)).toEqual([]);
  });

  it("inBatches roda uma vez por fatia, em sequência, e junta as linhas", async () => {
    const seen: number[][] = [];
    const rows = await inBatches([1, 2, 3, 4, 5], 2, (slice) => {
      seen.push(slice);
      return Promise.resolve(slice.map((n) => n * 10));
    });
    expect(seen).toEqual([[1, 2], [3, 4], [5]]);
    expect(rows).toEqual([10, 20, 30, 40, 50]);
  });
});
