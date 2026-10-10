import { createFileRoute, notFound } from "@tanstack/react-router";
import { PublicReceiptPage } from "@/features/receipts/components/public-receipt-page";
import { ReceiptUnavailable } from "@/features/receipts/components/receipt-unavailable";
import { getPublicReceiptSSR } from "@/lib/public-receipt-ssr";
import { m } from "@/paraglide/messages.js";

function PublicReceiptRoute() {
  const receipt = Route.useLoaderData();
  const { token } = Route.useParams();
  return <PublicReceiptPage receipt={receipt} token={token} />;
}

export const Route = createFileRoute("/r/$token")({
  // The page is the data, and an unknown token must answer HTTP 404: the one
  // loader that waits (planner's decision 14).
  loader: async ({ params }) => {
    const receipt = await getPublicReceiptSSR({ data: params.token });
    if (!receipt) {
      throw notFound(); // Start responde HTTP 404
    }
    return receipt;
  },
  head: () => ({
    meta: [
      { title: m.page_title_receipt() },
      { name: "robots", content: "noindex" },
      // OG genérico: valor e nomes nunca vão pro preview do chat.
      { property: "og:title", content: m.public_receipt_og_title() },
      {
        property: "og:description",
        content: m.public_receipt_og_description(),
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicReceiptRoute,
  notFoundComponent: ReceiptUnavailable,
});
