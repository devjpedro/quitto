import { expect, test } from "vitest";
import { decideClientGate } from "@/lib/app-guard";

test("query 401 → redireciona pra /login", () => {
  expect(decideClientGate({ isError: true, status: 401 })).toEqual({
    kind: "redirect",
    to: "/login",
  });
});

test("carregando → loader", () => {
  expect(decideClientGate({ isPending: true })).toEqual({ kind: "loader" });
});

test("sucesso → render", () => {
  expect(decideClientGate({ data: { id: "u1" } })).toEqual({ kind: "render" });
});

test("erro transitório (não-401) → loader (cliente re-tenta)", () => {
  expect(decideClientGate({ isError: true, status: 503 })).toEqual({
    kind: "loader",
  });
});
