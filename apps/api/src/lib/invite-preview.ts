export interface InvitePreview {
  installmentsCount: number;
  parties: { displayName: string; role: string }[];
  totalAmountCents: number;
}

export function buildInvitePreview(input: {
  installments: { amountCents: number }[];
  participants: { displayName: string; role: string }[];
}): InvitePreview {
  const totalAmountCents = input.installments.reduce(
    (sum, i) => sum + i.amountCents,
    0
  );
  return {
    totalAmountCents,
    installmentsCount: input.installments.length,
    parties: input.participants.map((p) => ({
      displayName: p.displayName,
      role: p.role,
    })),
  };
}
