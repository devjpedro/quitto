export function receiptPublicUrl(origin: string, token: string): string {
  return `${origin}/r/${token}`;
}

export function receiptShareMessage(i: {
  sequence: number;
  installmentsCount: number;
  title: string;
  url: string;
}): string {
  return `Recibo da parcela ${i.sequence}/${i.installmentsCount} de ${i.title}: ${i.url}`;
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** mailto usa encodeURIComponent (%20), não URLSearchParams (+ vira literal em clientes de e-mail). */
export function mailtoShareUrl(i: {
  title: string;
  sequence: number;
  installmentsCount: number;
  message: string;
}): string {
  const subject = `Recibo da parcela ${i.sequence}/${i.installmentsCount} — ${i.title}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(i.message)}`;
}
