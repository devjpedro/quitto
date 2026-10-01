import { NOTIFICATION_TYPE } from "@quitto/shared";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPE_LABEL } from "../src/lib/labels";

describe("NOTIFICATION_TYPE_LABEL (lado a receber)", () => {
  it("rotula os lembretes do recebedor", () => {
    expect(
      NOTIFICATION_TYPE_LABEL[NOTIFICATION_TYPE.installmentDueSoonReceivable]
    ).toBe("Parcela a receber vence em breve");
    expect(
      NOTIFICATION_TYPE_LABEL[NOTIFICATION_TYPE.installmentOverdueReceivable]
    ).toBe("Parcela a receber está vencida");
  });
});
