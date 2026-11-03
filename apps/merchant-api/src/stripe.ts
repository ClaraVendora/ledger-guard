import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key && key.startsWith("sk_test_") ? new Stripe(key) : null;

/**
 * Card leg only. Called only after Ledger Guard has returned allow or review.
 * With no test key configured, returns a fake intent so local dev runs without Stripe.
 */
export async function chargeCardLeg(amount: number, orderId: string, paymentMethodId?: string) {
  if (amount <= 0) return null;
  if (!stripe) return { id: `pi_fake_${orderId}`, status: "succeeded", fake: true };
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    payment_method: paymentMethodId ?? "pm_card_visa",
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { orderId },
  });
  return { id: pi.id, status: pi.status, fake: false };
}
