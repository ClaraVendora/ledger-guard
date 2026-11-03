import { Event } from "@lg/events";
import { fromShopify } from "./shopify.js";

/**
 * Adapters turn a source payload into one or more common events.
 * X-Source header picks the adapter. "generic" and "merchant" are already in
 * the common shape and are validated as-is.
 */
export function adapt(source: string | undefined, body: unknown): Event[] {
  switch (source) {
    case "shopify":
      return fromShopify(body);
    case "generic":
    case "merchant":
    case "generator":
    default: {
      const arr = Array.isArray(body) ? body : [body];
      return arr.map((b) => Event.parse(b));
    }
  }
}
