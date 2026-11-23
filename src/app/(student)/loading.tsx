export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: "2rem", width: "50%" }} />
      <div className="card-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: "14rem" }} />
        ))}
      </div>
    </div>
  );
}