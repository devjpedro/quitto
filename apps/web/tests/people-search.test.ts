import { describe, expect, it } from "vitest";
import { peopleSearch } from "@/features/people/lib/people-search";

describe("peopleSearch", () => {
  it("person com 16 hex fica; qualquer outro valor some", () => {
    expect(peopleSearch({ person: "0123456789abcdef" }).person).toBe(
      "0123456789abcdef"
    );
    expect(peopleSearch({ person: "0123456789ABCDEF" }).person).toBeUndefined();
    expect(peopleSearch({ person: "abc" }).person).toBeUndefined();
    expect(
      peopleSearch({ person: ["0123456789abcdef"] }).person
    ).toBeUndefined();
  });
});
