import { describe, expect, it } from "bun:test";
import {
  resolveApproverUserIds,
  resolvePayerUserIds,
} from "../src/lib/notifications";

const OWNER = "owner-1";

describe("resolvePayerUserIds", () => {
  it("returns linked buyers", () => {
    const set = resolvePayerUserIds(
      [{ role: "buyer", linkedUserId: "buyer-1" }],
      OWNER
    );
    expect([...set]).toEqual(["buyer-1"]);
  });

  it("owner (seller slot) inherits payer when no linked buyer", () => {
    const set = resolvePayerUserIds(
      [
        { role: "seller", linkedUserId: OWNER },
        { role: "buyer", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([OWNER]);
  });

  it("owner does NOT inherit payer once a buyer is linked", () => {
    const set = resolvePayerUserIds(
      [
        { role: "seller", linkedUserId: OWNER },
        { role: "buyer", linkedUserId: "buyer-1" },
      ],
      OWNER
    );
    expect([...set]).toEqual(["buyer-1"]);
  });
});

describe("resolveApproverUserIds", () => {
  it("returns linked sellers", () => {
    const set = resolveApproverUserIds(
      [{ role: "seller", linkedUserId: "seller-1" }],
      OWNER
    );
    expect([...set]).toEqual(["seller-1"]);
  });

  it("owner (buyer slot) inherits approver when no linked seller", () => {
    const set = resolveApproverUserIds(
      [
        { role: "buyer", linkedUserId: OWNER },
        { role: "seller", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([OWNER]);
  });

  it("ignores unlinked and viewer participants", () => {
    const set = resolveApproverUserIds(
      [
        { role: "viewer", linkedUserId: "v-1" },
        { role: "seller", linkedUserId: null },
      ],
      OWNER
    );
    expect([...set]).toEqual([]);
  });
});
