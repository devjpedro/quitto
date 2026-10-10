const PRELOAD = /<link rel="modulepreload" href="([^"]+)"\/>/g;
const ENTRY = /<script type="module" async="" src="([^"]+)"><\/script>/;

/**
 * The loader that takes the entry's place: in the frame after the first paint
 * it adds the preloads and the entry. A hidden tab never paints, so it goes at once.
 */
function loader(entry: string, preloads: string[]): string {
  return `<script>(function(){var go=function(){${JSON.stringify(preloads)}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.appendChild(l)});var s=document.createElement("script");s.type="module";s.src=${JSON.stringify(entry)};document.body.appendChild(s)};if(document.visibilityState==="hidden"){go()}else{requestAnimationFrame(function(){setTimeout(go,0)})}})()</script>`;
}

/**
 * The SSR HTML paints before the JS is asked for. As Start writes it, the
 * <head> preloads every chunk of the route (modulepreload): on a slow phone
 * they share the line with the CSS and the fonts, and the first paint waits
 * for all of them. Here the preloads leave the <head> and go, with the entry
 * script, into the frame after the first paint. The page looks the same; it
 * hydrates when the JS arrives, as before. Streamed: a tag cut by a chunk
 * waits for the next one, and once the entry is replaced the rest passes as is.
 */
export function paintFirst(
  body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const preloads: string[] = [];
  let pending = "";
  let replaced = false;
  const rewrite = (html: string) =>
    html
      .replace(PRELOAD, (_tag, href: string) => {
        preloads.push(href);
        return "";
      })
      .replace(ENTRY, (_tag, entry: string) => {
        replaced = true;
        return loader(entry, preloads);
      });
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        if (replaced) {
          controller.enqueue(encoder.encode(pending));
          pending = "";
          return;
        }
        const open = pending.lastIndexOf("<");
        const cut = open > pending.lastIndexOf(">") ? open : pending.length;
        const ready = rewrite(pending.slice(0, cut));
        pending = pending.slice(cut);
        controller.enqueue(encoder.encode(ready));
      },
      flush(controller) {
        pending += decoder.decode();
        if (pending) {
          controller.enqueue(
            encoder.encode(replaced ? pending : rewrite(pending))
          );
        }
      },
    })
  );
}

/** An HTML response, rewritten by paintFirst; anything else as it came. */
export function withPaintFirst(res: Response): Response {
  if (!(res.body && res.headers.get("content-type")?.includes("text/html"))) {
    return res;
  }
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return new Response(paintFirst(res.body), {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
