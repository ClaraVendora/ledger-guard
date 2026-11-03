/**
 * Shopify adapter: maps Shopify webhook payloads (orders/create, refunds/create,
 * customers/update, gift_cards/create) to common events. Only the fields Ledger
 * Guard needs are read. Stored-value tenders arrive as gateway names on
 * Shopify ("gift_card", "store_credit", or a loyalty app's gateway), which is
 * why the mapping lives here and not in the engine.
 */
import { Event, type Tender, type LineItem } from "@lg/events";

type ShopifyWebhook = { topic: string; shop: string; payload: Record<string, any> };

const gatewayToKind = (gateway: string): Tender["kind"] => {
  const g = gateway.toLowerCase();
  if (g.includes("gift")) return "gift_card";
  if (g.includes("credit")) return "credit";
  if (g.includes("point") || g.includes("loyalty") || g.includes("reward")) return "points";
  return "card";
};

export function fromShopify(body: unknown): Event[] {
  const w = body as ShopifyWebhook;
  const p = w.payload;
  const storeId = w.shop;
  switch (w.topic) {
    case "orders/create": {
      const tenders: Tender[] = (p.transactions ?? [])
        .filter((t: any) => t.kind === "sale" && t.status === "success")
        .map((t: any) => ({
          kind: gatewayToKind(t.gateway ?? ""),
          amount: Number(t.amount),
          instrumentId: t.receipt?.gift_card_id ? String(t.receipt.gift_card_id) : undefined,
          cardFingerprint: t.payment_details?.credit_card_bin ? `${t.payment_details.credit_card_bin}-${t.payment_details.credit_card_number?.slice(-4)}` : undefined,
          avs: t.payment_details?.avs_result_code === "Y" ? "pass" : t.payment_details?.avs_result_code ? "fail" : "unavailable",
          cvc: t.payment_details?.cvv_result_code === "M" ? "pass" : t.payment_details?.cvv_result_code ? "fail" : "unavailable",
        }));
      const lineItems: LineItem[] = (p.line_items ?? []).map((l: any) => ({
        sku: String(l.sku ?? l.variant_id),
        category: String(l.product_type ?? "unknown"),
        qty: Number(l.quantity),
        unitPrice: Number(l.price),
        resalable: /wine|spirit|liquor|whisk|formula|cosmetic|beauty/i.test(String(l.product_type ?? l.title ?? "")),
      }));
      const riskMap: Record<string, "low" | "medium" | "high"> = { low: "low", medium: "medium", high: "high" };
      return [
        Event.parse({
          id: `shopify:${w.topic}:${p.id}`,
          source: "shopify",
          storeId,
          occurredAt: p.created_at,
          customerId: String(p.customer?.id),
          email: p.email,
          deviceId: p.client_details?.browser_ip ? undefined : undefined,
          ip: p.client_details?.browser_ip,
          type: "order.created",
          orderId: String(p.id),
          total: Number(p.total_price),
          tenders,
          lineItems,
          shippingAddressId: `${p.shipping_address?.address1 ?? ""}|${p.shipping_address?.zip ?? ""}`.toLowerCase(),
          newShippingAddress: Boolean(p.note_attributes?.find?.((n: any) => n.name === "lg_new_address")?.value === "true"),
          platformRisk: riskMap[p.risk_level ?? ""],
        }),
      ];
    }
    case "refunds/create": {
      const amount = (p.transactions ?? []).reduce((a: number, t: any) => a + Number(t.amount ?? 0), 0);
      const gateway = p.transactions?.[0]?.gateway ?? "card";
      const dest = gatewayToKind(gateway);
      return [
        Event.parse({
          id: `shopify:${w.topic}:${p.id}`,
          source: "shopify",
          storeId,
          occurredAt: p.created_at,
          customerId: String(p.order?.customer?.id ?? p.customer_id),
          type: "refund.created",
          refundId: String(p.id),
          orderId: String(p.order_id),
          amount,
          reason: /not received|missing/i.test(p.note ?? "") ? "item_not_received" : /spoil|damag/i.test(p.note ?? "") ? "spoiled" : "other",
          destination: dest === "card" ? "card" : dest,
        }),
      ];
    }
    case "gift_cards/create": {
      return [
        Event.parse({
          id: `shopify:${w.topic}:${p.id}`,
          source: "shopify",
          storeId,
          occurredAt: p.created_at,
          customerId: String(p.customer_id ?? "anonymous"),
          type: "value.load",
          kind: "gift_card",
          amount: Number(p.initial_value),
          instrumentId: String(p.id),
        }),
      ];
    }
    default:
      return [];
  }
}
