import Link from "next/link";

export function Breadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: "0.9rem" }}>
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          margin: 0,
          padding: 0,
          listStyle: "none",
          fontSize: "0.85rem",
          color: "var(--muted)",
        }}
      >
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} style={{ display: "flex", gap: "0.35rem" }}>
            {item.href ? (
              <Link href={item.href} className="text-link">{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}