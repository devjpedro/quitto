import { expect, test, vi } from "vitest";
import { warmChunk } from "@/components/ui/motion-scope";

test("aquecer um chunk que sumiu no deploy não vira rejeição solta", async () => {
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  let calls = 0;
  // A plain function, not vi.fn: the spy subscribes to the promise it returns,
  // which would mark the rejection as handled.
  const load = () => {
    calls += 1;
    return Promise.reject(
      new TypeError(
        "Failed to fetch dynamically imported module: https://usequitto.vercel.app/assets/command-palette-R7J5_JA5.js"
      )
    );
  };

  warmChunk(load);
  await new Promise((resolve) => setTimeout(resolve, 0));
  process.off("unhandledRejection", unhandled);

  expect(calls).toBe(1);
  expect(unhandled).not.toHaveBeenCalled();
});
