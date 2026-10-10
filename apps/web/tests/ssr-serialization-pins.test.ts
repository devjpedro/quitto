import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// timeout-ssr-serialization.test.ts rebuilds the two halves of the Start's
// SSR serialization with @tanstack/router-core and seroval, pinned exact in
// the devDependencies. A router update that moves the app to other copies
// would keep that test green on the old format while the app ships the new
// one. These fail first, and say which pin to move.

const SERIALIZATION_TEST = join(
  import.meta.dirname,
  "timeout-ssr-serialization.test.ts"
);

const MOVE_THE_PIN =
  "move its exact pin in apps/web/package.json devDependencies";

interface Installed {
  dir: string;
  version: string;
}

function readManifest(dir: string): { name?: string; version?: string } {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

/** The copy of `name` that a bare import from `fromFile` loads (symlinks followed). */
function installed(name: string, fromFile: string): Installed {
  // The entry file sits somewhere inside the package: walk up to its manifest.
  let dir = dirname(createRequire(fromFile).resolve(name));
  for (;;) {
    const manifest = readManifest(dir);
    if (manifest.name === name && manifest.version) {
      return { dir, version: manifest.version };
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`no package.json of ${name} above ${fromFile}`);
    }
    dir = parent;
  }
}

describe("the SSR serialization test runs the app's own copies", () => {
  const appRouter = installed("@tanstack/react-router", SERIALIZATION_TEST);
  const appRouterCore = installed(
    "@tanstack/router-core",
    join(appRouter.dir, "package.json")
  );

  it("@tanstack/router-core is the version the app's router runs", () => {
    const pinned = installed("@tanstack/router-core", SERIALIZATION_TEST);
    expect(
      pinned.version,
      `@tanstack/react-router ${appRouter.version} runs router-core ${appRouterCore.version}, the test imports ${pinned.version}: ${MOVE_THE_PIN}`
    ).toBe(appRouterCore.version);
  });

  it("seroval is the version that router-core serializes with", () => {
    const pinned = installed("seroval", SERIALIZATION_TEST);
    const appSeroval = installed(
      "seroval",
      join(appRouterCore.dir, "package.json")
    );
    expect(
      pinned.version,
      `router-core ${appRouterCore.version} serializes with seroval ${appSeroval.version}, the test imports ${pinned.version}: ${MOVE_THE_PIN}`
    ).toBe(appSeroval.version);
  });
});
