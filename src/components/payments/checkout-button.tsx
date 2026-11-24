"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
type RazorpayInstance = {
  open(): void;
  on(event: string, cb: (r: { error?: { description?: string } }) => void): void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CheckoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm(response: RazorpayResponse, attempt = 0): Promise<void> {
    const res = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.status === "paid") {
      toast.success("Payment confirmed. Welcome aboard!");
      router.push("/learn");
      router.refresh();
      return;
    }
    if (res.ok && data.status === "pending" && attempt < 5) {
      await sleep(3000);
      return confirm(response, attempt + 1);
    }
    setMessage(
      "We received your payment but could not confirm it yet. Your access will activate automatically within a few minutes. If it does not, please contact support.",
    );
  }

  async function startCheckout() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/create-order", { method: "POST" });
      const order = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(order.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      if (!(await loadCheckoutScript()) || !window.Razorpay) {
        toast.error("Could not load the payment window. Check your connection.");
        setBusy(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "EM ROUNDS with PK",
        description: order.name,
        prefill: order.email ? { email: order.email } : undefined,
        theme: { color: "#ad741e" },
        handler: async (response: RazorpayResponse) => {
          setMessage("Confirming your payment…");
          try {
            await confirm(response);
          } catch {
            setMessage("Could not confirm the payment. Please refresh in a minute.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on("payment.failed", (r) => {
        toast.error(r.error?.description ?? "Payment failed. You can try again.");
        setBusy(false);
      });
      rzp.open();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="primary-button btn-compact" onClick={startCheckout} disabled={busy}>
        <Lock size={18} aria-hidden /> {busy ? "Please wait…" : "Pay securely"}
      </button>
      {message && (
        <p className="muted-copy" role="status" style={{ marginTop: "0.75rem" }}>
          {message}
        </p>
      )}
    </div>
  );
}