import { describe, expect, it } from "bun:test";
import { clientIp, createRateLimiter, MAX_KEYS } from "../src/lib/rate-limit";

describe("createRateLimiter", () => {
  it("deixa passar até o máximo na janela e barra o seguinte", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect([1, 2, 3, 4].map(() => limiter.hit("ip", 1000))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("a janela recomeça depois do prazo", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.hit("ip", 0)).toBe(true);
    expect(limiter.hit("ip", 59_999)).toBe(false);
    expect(limiter.hit("ip", 60_000)).toBe(true);
  });

  it("cada chave tem a sua janela", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("b", 0)).toBe(true);
  });

  it("cheio de chaves vivas, uma nova é barrada (a memória tem teto)", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
    for (let i = 0; i < MAX_KEYS; i += 1) {
      expect(limiter.hit(`ip-${i}`, 0)).toBe(true);
    }
    expect(limiter.hit("one-more", 0)).toBe(false);
    // Once those windows ran out, the sweep makes room again.
    expect(limiter.hit("one-more", 60_000)).toBe(true);
  });

  it("o teto global barra mesmo com chaves diferentes", () => {
    const global = createRateLimiter({ max: 2, windowMs: 60_000 });
    expect(["a", "b", "c"].map(() => global.hit("all", 0))).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("clientIp", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost/api/invites/x/preview", { headers });

  it("o Fly-Client-IP, que a borda do Fly grava a partir da conexão", () => {
    expect(clientIp(request({ "fly-client-ip": " 198.51.100.2 " }))).toBe(
      "198.51.100.2"
    );
  });

  it("nunca o x-forwarded-for: numa chamada direta ao fly, ele é do cliente", () => {
    expect(
      clientIp(
        request({
          "x-forwarded-for": "203.0.113.7",
          "fly-client-ip": "198.51.100.2",
        })
      )
    ).toBe("198.51.100.2");
    expect(
      clientIp(request({ "x-forwarded-for": "203.0.113.7" }), "192.0.2.1")
    ).toBe("192.0.2.1");
  });

  it("sem Fly-Client-IP, o IP do socket; sem nada, unknown", () => {
    expect(clientIp(request({}), "192.0.2.1")).toBe("192.0.2.1");
    expect(clientIp(request({}))).toBe("unknown");
  });
});
