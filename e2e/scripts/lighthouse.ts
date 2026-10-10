import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { dirname, join } from "node:path";
import { constants, createBrotliCompress, createGzip } from "node:zlib";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

// Lighthouse per route, on a phone and on a desktop, against a production
// build served locally (see README-lighthouse.md). Run from e2e/:
//
//   bun scripts/lighthouse.ts proxy          the :3001 front (see below)
//   bun scripts/lighthouse.ts [options]      the measurement
//
// Options:
//   --runs N          runs per route and form factor; the median run of the
//                     performance score is kept (default 1);
//   --out <dir>       where baseline.json and baseline.md go
//                     (default ../.superpowers/sdd/2026-10-09-lighthouse);
//   --only <a,b>      only the routes whose name contains one of these;
//   --forms <a,b>     mobile, desktop or both (default both);
//   --name <file>     the files' base name (default "baseline");
//   --render <json>   no measurement: rewrite that JSON's .md next to it.
// Env: WEB_URL (default http://localhost:3001), API_URL (http://localhost:3000).
const WEB = process.env.WEB_URL ?? "http://localhost:3001";
const API = process.env.API_URL ?? "http://localhost:3000";

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? fallback) : fallback;
}

// ---------------------------------------------------------------- proxy ----

/**
 * The Vercel build rewrites /api/* to the API; the local Nitro preset does
 * not. This front takes :3001 (the origin the app and the cookies expect),
 * sends /api/* to the API (:3000) and the rest to the Nitro server (:3002),
 * streaming the bytes as they come. The Nitro server sends text bytes raw;
 * Vercel's CDN sends Brotli, so the proxy compresses text (br, else gzip) to
 * stay close to it. NO_COMPRESS=1 turns that off (the raw-bytes baseline).
 */
const COMPRESSIBLE = /text\/|javascript|json|svg|xml|font\/(ttf|otf)/;

function runProxy(): void {
  const WEB_PORT = Number(process.env.NITRO_PORT ?? 3002);
  const listen = Number(new URL(WEB).port || 3001);
  const api = new URL(API);
  createServer((req, res) => {
    const toApi = req.url?.startsWith("/api/") ?? false;
    const upstream = httpRequest(
      {
        host: toApi ? api.hostname : "127.0.0.1",
        port: toApi ? Number(api.port) : WEB_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (up) => {
        const headers = { ...up.headers };
        const type = String(headers["content-type"] ?? "");
        const wants = String(req.headers["accept-encoding"] ?? "");
        const encoding =
          !(headers["content-encoding"] || process.env.NO_COMPRESS) &&
          COMPRESSIBLE.test(type)
            ? ["br", "gzip"].find((e) => wants.includes(e))
            : undefined;
        if (!encoding) {
          res.writeHead(up.statusCode ?? 502, headers);
          up.pipe(res);
          return;
        }
        headers["content-encoding"] = encoding;
        headers.vary = "Accept-Encoding";
        const { "content-length": _length, ...streamed } = headers;
        res.writeHead(up.statusCode ?? 502, streamed);
        up.pipe(
          encoding === "br"
            ? createBrotliCompress({
                flush: constants.BROTLI_OPERATION_FLUSH,
                params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
              })
            : createGzip({ flush: constants.Z_SYNC_FLUSH })
        ).pipe(res);
      }
    );
    upstream.on("error", () => {
      res.writeHead(502).end("bad gateway");
    });
    req.pipe(upstream);
  }).listen(listen, () => {
    console.log(`proxy :${listen} -> /api ${API}, resto :${WEB_PORT}`);
  });
}

if (process.argv[2] === "proxy") {
  runProxy();
  await new Promise(() => undefined);
}

// ------------------------------------------------------------ the routes ----

/** The seed's links: apps/api/src/lib/demo-seed-kit.ts computes the same. */
const receiptToken = (key: string, sequence: number) =>
  createHash("sha256")
    .update(`quitto-demo-receipt:${key}:${sequence}`)
    .digest("base64url");
const inviteToken = (key: string) =>
  createHash("sha256").update(`quitto-demo-invite:${key}`).digest("hex");

interface Route {
  auth: boolean;
  name: string;
  path: string;
}

async function sessionCookie(): Promise<string> {
  const res = await fetch(`${WEB}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB },
    body: JSON.stringify({
      email: "agora@demo.quitto.dev",
      password: "quitto123",
    }),
  });
  if (!res.ok) {
    throw new Error(`login falhou (${res.status}): rodou o seed:demo?`);
  }
  return res.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
}

async function buildRoutes(cookie: string): Promise<Route[]> {
  const res = await fetch(`${WEB}/api/contracts`, { headers: { cookie } });
  const contracts = (await res.json()) as {
    id: string;
    title: string;
    installmentsCount: number;
  }[];
  const contract =
    contracts.find((c) => c.title === "Moto do Rafa") ??
    contracts.find((c) => c.installmentsCount > 0);
  if (!contract) {
    throw new Error("nenhum contrato com parcelas: rodou o seed:demo?");
  }
  return [
    { name: "login", path: "/login", auth: false },
    { name: "forgot-password", path: "/forgot-password", auth: false },
    {
      name: "recibo-publico",
      path: `/r/${receiptToken("moto", 1)}`,
      auth: false,
    },
    {
      name: "convite",
      path: `/invites/${inviteToken("floripa")}`,
      auth: false,
    },
    { name: "home", path: "/", auth: true },
    { name: "contratos", path: "/contracts", auth: true },
    { name: "contrato", path: `/contracts/${contract.id}`, auth: true },
    { name: "parcelas", path: "/installments", auth: true },
    { name: "pessoas", path: "/people", auth: true },
    { name: "ajustes", path: "/settings", auth: true },
    { name: "novo-contrato", path: "/contracts/new", auth: true },
  ];
}

// ------------------------------------------------------------ one run ----

type Form = "mobile" | "desktop";
const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const;
type Category = (typeof CATEGORIES)[number];

interface FailedAudit {
  categories: Category[];
  displayValue?: string;
  example: string;
  id: string;
  savingsBytes: number;
  savingsMs: number;
  score: number | null;
  title: string;
}

interface Result {
  failed: FailedAudit[];
  finalUrl: string;
  form: Form;
  jsBytes: number;
  largest: { url: string; bytes: number } | null;
  metrics: { lcp: number; tbt: number; cls: number; fcp: number; si: number };
  path: string;
  route: string;
  runs: number;
  scores: Record<Category, number>;
  scoresPerRun: Record<Category, number>[];
  totalBytes: number;
}

type Lhr =
  Awaited<ReturnType<typeof lighthouse>> extends infer R
    ? R extends { lhr: infer L }
      ? L
      : never
    : never;

const STRUCTURED = /^[{[]/;

/** A node, a source location or a plain value, as a short string. */
function textOf(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return textOf(v.snippet ?? v.url ?? v.selector ?? v.source);
  }
  return;
}

function describeExample(audit: Lhr["audits"][string]): string {
  const items = (audit.details as { items?: Record<string, unknown>[] })?.items;
  const first = items?.[0];
  if (!first) {
    return audit.displayValue ?? "";
  }
  const pick =
    textOf(first.node) ??
    textOf(first.url) ??
    textOf(first.source) ??
    textOf(first.description) ??
    textOf(first.label) ??
    JSON.stringify(first);
  // A tree or a table of data is no example: the audit's own title says more.
  return STRUCTURED.test(pick)
    ? (audit.displayValue ?? audit.title)
    : pick.replace(/\s+/g, " ").slice(0, 160);
}

function summarize(lhr: Lhr): Omit<Result, "route" | "path" | "form" | "runs"> {
  const scores = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    scores[c] = Math.round((lhr.categories[c]?.score ?? 0) * 100);
  }
  const num = (id: string) => lhr.audits[id]?.numericValue ?? 0;
  const requests =
    (
      lhr.audits["network-requests"]?.details as {
        items?: {
          url: string;
          resourceType?: string;
          transferSize?: number;
        }[];
      }
    )?.items ?? [];
  const sized = requests.filter((r) => (r.transferSize ?? 0) > 0);
  const jsBytes = sized
    .filter((r) => r.resourceType === "Script")
    .reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  const totalBytes = sized.reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  const biggest = [...sized].sort(
    (a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0)
  )[0];

  const failed: FailedAudit[] = [];
  for (const category of CATEGORIES) {
    for (const ref of lhr.categories[category]?.auditRefs ?? []) {
      const audit = lhr.audits[ref.id];
      if (
        !audit ||
        audit.score === null ||
        audit.score >= 0.9 ||
        audit.scoreDisplayMode === "notApplicable" ||
        audit.scoreDisplayMode === "manual" ||
        audit.scoreDisplayMode === "informative"
      ) {
        continue;
      }
      const details = audit.details as
        | { overallSavingsMs?: number; overallSavingsBytes?: number }
        | undefined;
      const existing = failed.find((f) => f.id === ref.id);
      if (existing) {
        existing.categories.push(category);
        continue;
      }
      failed.push({
        id: ref.id,
        title: audit.title,
        categories: [category],
        score: audit.score,
        displayValue: audit.displayValue,
        savingsMs: details?.overallSavingsMs ?? audit.metricSavings?.LCP ?? 0,
        savingsBytes: details?.overallSavingsBytes ?? 0,
        example: describeExample(audit),
      });
    }
  }
  return {
    finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl,
    scores,
    scoresPerRun: [],
    metrics: {
      lcp: num("largest-contentful-paint"),
      tbt: num("total-blocking-time"),
      cls: num("cumulative-layout-shift"),
      fcp: num("first-contentful-paint"),
      si: num("speed-index"),
    },
    jsBytes,
    totalBytes,
    largest: biggest
      ? { url: biggest.url, bytes: biggest.transferSize ?? 0 }
      : null,
    failed,
  };
}

/** Network.setCookie over the browser's DevTools socket (Playwright's CDP client hangs under Bun). */
async function setCookies(port: number, cookie: string): Promise<void> {
  const version = (await (
    await fetch(`http://127.0.0.1:${port}/json/version`)
  ).json()) as { webSocketDebuggerUrl: string };
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve));
  const cookies = cookie.split("; ").map((pair) => {
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: WEB };
  });
  const done = new Promise<void>((resolve, reject) => {
    socket.addEventListener("message", (event) => {
      const reply = JSON.parse(String(event.data));
      if (reply.id === 1) {
        if (reply.error) {
          reject(new Error(reply.error.message));
        } else {
          resolve();
        }
      }
    });
  });
  socket.send(
    JSON.stringify({ id: 1, method: "Storage.setCookies", params: { cookies } })
  );
  await done;
  socket.close();
}

async function runOnce(
  route: Route,
  form: Form,
  cookie: string
): Promise<ReturnType<typeof summarize>> {
  const chrome = await launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    if (route.auth) {
      // Real cookies in the profile: Lighthouse's extraHeaders only reach the
      // document, and the browser's own /api calls came back 401.
      await setCookies(chrome.port, cookie);
    }
    const result = await lighthouse(
      new URL(route.path, WEB).toString(),
      {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: [...CATEGORIES],
        // Keep the cookies set above (the default wipes the origin's storage).
        disableStorageReset: route.auth,
      },
      form === "desktop" ? desktopConfig : undefined
    );
    if (!result) {
      throw new Error("lighthouse sem resultado");
    }
    const summary = summarize(result.lhr);
    if (result.lhr.runtimeError) {
      throw new Error(
        `${route.name}/${form}: ${result.lhr.runtimeError.message}`
      );
    }
    const landed = new URL(summary.finalUrl).pathname;
    if (landed !== new URL(route.path, WEB).pathname) {
      console.warn(
        `  ! ${route.name}/${form} terminou em ${landed} (pedido ${route.path})`
      );
    }
    return summary;
  } finally {
    await chrome.kill();
  }
}

// ------------------------------------------------------------ reporting ----

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kB`;
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function fileName(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() || u.pathname;
  } catch {
    return url;
  }
}

interface Tally {
  bytes: number;
  count: number;
  example: string;
  ms: number;
  title: string;
  where: string;
}

/** The category's 10 worst audits, summed over every route and form factor. */
function topAudits(results: Result[], category: Category): string[] {
  const byId = new Map<string, Tally>();
  for (const r of results) {
    for (const f of r.failed) {
      if (!f.categories.includes(category)) {
        continue;
      }
      const entry = byId.get(f.id) ?? {
        title: f.title,
        count: 0,
        ms: 0,
        bytes: 0,
        example: f.example,
        where: `${r.route}/${r.form}`,
      };
      entry.count += 1;
      entry.ms += f.savingsMs;
      entry.bytes += f.savingsBytes;
      byId.set(f.id, entry);
    }
  }
  const top = [...byId.entries()]
    .sort(
      (a, b) =>
        b[1].ms - a[1].ms || b[1].count - a[1].count || b[1].bytes - a[1].bytes
    )
    .slice(0, 10);
  const lines = [`### ${category}`, ""];
  if (top.length === 0) {
    return [...lines, "Nenhuma auditoria falha.", ""];
  }
  lines.push(
    "| Auditoria | Afeta | Economia | Exemplo |",
    "|---|---:|---|---|"
  );
  for (const [id, e] of top) {
    const savings = [
      e.ms ? `${Math.round(e.ms)} ms` : "",
      e.bytes ? kb(e.bytes) : "",
    ]
      .filter(Boolean)
      .join(" / ");
    lines.push(
      `| \`${id}\` | ${e.count}/${results.length} | ${savings || "-"} | ${e.example.replace(/\|/g, "\\|")} (${e.where}) |`
    );
  }
  return [...lines, ""];
}

function markdown(results: Result[]): string {
  const lines: string[] = [];
  const worst = {} as Record<Category, number>;
  for (const c of CATEGORIES) {
    worst[c] = Math.min(...results.map((r) => r.scores[c]));
  }
  const cell = (c: Category, value: number) =>
    value === worst[c] && value < 100 ? `**${value}**` : String(value);

  lines.push("# Lighthouse: linha de base", "");
  lines.push(
    `Medido em ${new Date().toISOString().slice(0, 10)}, build de produção local. ` +
      `Rodadas por combinação: ${results[0]?.runs ?? 1} (mediana da Performance). ` +
      "Negrito = pior valor da coluna.",
    ""
  );
  lines.push(
    "| Rota | Forma | Perf | A11y | Boas práticas | SEO |",
    "|---|---|---:|---:|---:|---:|"
  );
  for (const r of results) {
    lines.push(
      `| ${r.route} | ${r.form === "mobile" ? "celular" : "desktop"} | ${CATEGORIES.map((c) => cell(c, r.scores[c])).join(" | ")} |`
    );
  }
  lines.push("", "## Performance: métricas e peso por rota", "");
  lines.push(
    "| Rota | Forma | LCP | TBT | CLS | FCP | SI | JS | Total | Maior recurso |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---|"
  );
  for (const r of results) {
    lines.push(
      `| ${r.route} | ${r.form === "mobile" ? "celular" : "desktop"} | ${sec(r.metrics.lcp)} | ${Math.round(r.metrics.tbt)} ms | ${r.metrics.cls.toFixed(3)} | ${sec(r.metrics.fcp)} | ${sec(r.metrics.si)} | ${kb(r.jsBytes)} | ${kb(r.totalBytes)} | ${r.largest ? `${fileName(r.largest.url)} (${kb(r.largest.bytes)})` : "-"} |`
    );
  }
  lines.push(
    "",
    "## As 10 auditorias que mais derrubam cada categoria",
    "",
    `Somadas entre as ${results.length} combinações rota × forma. "Afeta" é o número de combinações em que a auditoria falha; a economia é a soma das estimativas do Lighthouse.`,
    ""
  );
  for (const category of CATEGORIES) {
    lines.push(...topAudits(results, category));
  }
  return lines.join("\n");
}

// ----------------------------------------------------------------- main ----

const renderFrom = arg("render", "");
if (renderFrom) {
  const { readFileSync } = await import("node:fs");
  const saved = JSON.parse(readFileSync(renderFrom, "utf8")) as {
    results: Result[];
  };
  writeFileSync(
    renderFrom.replace(/\.json$/, ".md"),
    `${markdown(saved.results)}\n`
  );
  process.exit(0);
}

const runs = Math.max(1, Number(arg("runs", "1")));
const outDir = arg("out", "../.superpowers/sdd/2026-10-09-lighthouse");
const only = arg("only", "").split(",").filter(Boolean);
const forms = arg("forms", "mobile,desktop")
  .split(",")
  .filter(Boolean) as Form[];
const base = arg("name", "baseline");

process.env.CHROME_PATH ??= chromium.executablePath();
const cookie = await sessionCookie();
const routes = (await buildRoutes(cookie)).filter(
  (r) => only.length === 0 || only.some((o) => r.name.includes(o))
);

const results: Result[] = [];
for (const route of routes) {
  for (const form of forms) {
    const attempts: ReturnType<typeof summarize>[] = [];
    for (let i = 0; i < runs; i++) {
      attempts.push(await runOnce(route, form, cookie));
    }
    const kept = [...attempts].sort(
      (a, b) => a.scores.performance - b.scores.performance
    )[Math.floor(attempts.length / 2)];
    if (!kept) {
      continue;
    }
    const result: Result = {
      route: route.name,
      path: route.path,
      form,
      runs,
      ...kept,
      scores: {
        performance: median(attempts.map((a) => a.scores.performance)),
        accessibility: median(attempts.map((a) => a.scores.accessibility)),
        "best-practices": median(
          attempts.map((a) => a.scores["best-practices"])
        ),
        seo: median(attempts.map((a) => a.scores.seo)),
      },
      scoresPerRun: attempts.map((a) => a.scores),
    };
    results.push(result);
    console.log(
      `${route.name.padEnd(16)} ${form.padEnd(8)} ${CATEGORIES.map((c) => result.scores[c]).join(" / ")}`
    );
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, `${base}.json`),
  `${JSON.stringify({ web: WEB, runs, results }, null, 2)}\n`
);
writeFileSync(join(outDir, `${base}.md`), `${markdown(results)}\n`);
console.log(`salvo em ${dirname(join(outDir, base))}/${base}.{json,md}`);
