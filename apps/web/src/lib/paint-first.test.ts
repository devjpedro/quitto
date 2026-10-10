import { describe, expect, it } from "vitest";
import { paintFirst, withPaintFirst } from "@/lib/paint-first";

const HEAD =
  '<html><head><link rel="stylesheet" href="/assets/app.css"/><link rel="modulepreload" href="/assets/entry.js"/><link rel="modulepreload" href="/assets/react.js"/></head>';
const BODY =
  '<body><h1>Oi</h1><script type="module" async="" src="/assets/entry.js"></script><script>$_TSR.e()</script></body></html>';

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

const read = (stream: ReadableStream<Uint8Array>) =>
  new Response(stream).text();

describe("paintFirst", () => {
  it("tira os preloads do <head> e troca o script de entrada pelo carregador", async () => {
    const html = await read(paintFirst(streamOf([HEAD, BODY])));
    expect(html).not.toContain('<link rel="modulepreload"');
    expect(html).not.toContain('<script type="module" async=""');
    expect(html).toContain('<link rel="stylesheet" href="/assets/app.css"/>');
    expect(html).toContain('["/assets/entry.js","/assets/react.js"]');
    expect(html).toContain('s.src="/assets/entry.js"');
    expect(html).toContain("requestAnimationFrame");
    expect(html).toContain("<h1>Oi</h1>");
    expect(html).toContain("<script>$_TSR.e()</script>");
  });

  it("uma tag cortada entre dois pedaços espera o próximo", async () => {
    const whole = HEAD + BODY;
    const cuts = [
      whole.indexOf("modulepreload") + 4,
      whole.indexOf('async=""') + 3,
    ];
    const chunks = [
      whole.slice(0, cuts[0]),
      whole.slice(cuts[0], cuts[1]),
      whole.slice(cuts[1]),
    ];
    expect(await read(paintFirst(streamOf(chunks)))).toBe(
      await read(paintFirst(streamOf([whole])))
    );
  });

  it("sem script de entrada, o HTML passa só sem os preloads", async () => {
    const html = await read(paintFirst(streamOf(["<p>a < b</p>", "<p>c</p>"])));
    expect(html).toBe("<p>a < b</p><p>c</p>");
  });
});

describe("withPaintFirst", () => {
  it("reescreve HTML e tira o content-length", async () => {
    const res = withPaintFirst(
      new Response(HEAD + BODY, {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-length": "999",
        },
      })
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("content-length")).toBeNull();
    expect(await res.text()).not.toContain('<link rel="modulepreload"');
  });

  it("não toca no que não é HTML", () => {
    const json = new Response("{}", {
      headers: { "content-type": "application/json" },
    });
    expect(withPaintFirst(json)).toBe(json);
  });
});
