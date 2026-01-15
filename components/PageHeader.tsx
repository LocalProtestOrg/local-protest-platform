export default function PageHeader({
  title,
  subtitle,
  imageUrl,
}: {
  title: string;
  subtitle?: string;
  imageUrl: string;
}) {
  return (
    <section
      aria-label="Peaceful protest gathering around the nation unite for a common cause."
      style={{
        width: "100%",
        height: 280,
        backgroundImage: `url("${imageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Accessible alt text for screen readers */}
      <img
        src={imageUrl}
        alt="Peaceful protest gathering around the nation unite for a common cause."
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      />

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "white" }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0 }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 18, marginTop: 10, maxWidth: 700, lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
