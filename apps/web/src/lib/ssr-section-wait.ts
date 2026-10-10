/** How long the SSR waits for a section's data before letting it stream. */
export const SSR_SECTION_WAIT_MS = 250;

/**
 * On the server, a loader waits a moment for its section's read: a warm API
 * answers in tens of ms, and the section is drawn in the first HTML. A
 * streamed section is revealed by React no sooner than 300 ms after its
 * skeleton paints, after the JS, and an update in that window makes it render
 * again in the browser. A cold API still streams once the wait is over. In
 * the browser it never waits: navigation stays instant.
 */
export async function waitOnServer(read: Promise<unknown>): Promise<void> {
  if (typeof document !== "undefined") {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    read,
    new Promise((resolve) => {
      timer = setTimeout(resolve, SSR_SECTION_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
}
