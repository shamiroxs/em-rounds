import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { CheckoutButton } from "@/components/payments/checkout-button";

export default async function CheckoutPage() {
  const { supabase } = await requireUser();

  const [accessRes, productRes] = await Promise.all([
    supabase.rpc("has_platform_access"),
    supabase
      .from("access_products")
      .select("name, description, amount_minor, currency")
      .eq("code", "lifetime_platform")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (accessRes.data === true) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={32} aria-hidden />
        <h1 className="section-title">You have lifetime access</h1>
        <Link href="/learn" className="primary-button">Go to Learn</Link>
      </div>
    );
  }

  const product = productRes.data;
  if (!product) {
    return (
      <div className="empty-state">
        <h1 className="section-title">Not available yet</h1>
        <p>Lifetime access is not open for purchase right now.</p>
      </div>
    );
  }

  const price = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: String(product.currency).trim(),
    maximumFractionDigits: 0,
  }).format(Number(product.amount_minor) / 100);

  return (
    <div className="surface-card" style={{ maxWidth: "30rem", margin: "0 auto" }}>
      <p className="eyebrow">One-time payment</p>
      <h1 className="page-title" style={{ marginTop: "0.5rem" }}>{product.name}</h1>
      {product.description && (
        <p className="muted-copy" style={{ marginTop: "0.5rem" }}>{product.description}</p>
      )}
      <p className="page-title" style={{ margin: "1.25rem 0" }}>{price}</p>
      <ul className="muted-copy" style={{ paddingLeft: "1.1rem", marginBottom: "1.25rem", lineHeight: 1.7 }}>
        <li>Pay once. No subscription and no renewal.</li>
        <li>Access to the entire platform, forever.</li>
      </ul>
      <CheckoutButton />
    </div>
  );
}