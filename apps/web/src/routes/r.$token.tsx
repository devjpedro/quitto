import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  PublicReceiptPage,
  PublicReceiptUnavailable,
} from "@/features/receipts/public-receipt-page";
import { PAGE_TITLE } from "@/lib/page-title";
import { getPublicReceiptSSR } from "@/lib/public-receipt-ssr";

function PublicReceiptRoute() {
  const receipt = Route.useLoaderData();
  const { token } = Route.useParams();
  return <PublicReceiptPage receipt={receipt} token={token} />;
}

export const Route = createFileRoute("/r/$token")({
  loader: async ({ params }) => {
    const receipt = await getPublicReceiptSSR({ data: params.token });
    if (!receipt) {
      throw notFound(); // Start responde HTTP 404
    }
    return receipt;
  },
  head: () => ({
    meta: [
      { title: PAGE_TITLE.publicReceipt },
      { name: "robots", content: "noindex" },
      // OG genérico: valor e nomes nunca vão pro preview do chat.
      { property: "og:title", content: "Recibo de pagamento · Quitto" },
      { property: "og:description", content: "Recibo emitido pelo Quitto." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicReceiptRoute,
  notFoundComponent: PublicReceiptUnavailable,
});
