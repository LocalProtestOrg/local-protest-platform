export default function PageHeader({
  title,
  subtitle,
  imageUrl,
}: {
  title: string;
  subtitle?: string;
  imageUrl: string;
}) {
  const ALT_TEXT =
    "Peaceful protest gathering around the nation unite for a common cause.";

  return (
    <section
      aria-label={ALT_TEXT}
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
        alt={ALT_TEXT}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      />

      {/* Dark overlay (visual only) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          pointerEvents: "none",
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
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: 24,
            color: "white",
          }}
        >
          <h1 style={{ fontSize: 38, fontWeight: 800, margin: 0 }}>{title}</h1>

          {subtitle && (
            <p
              style={{
                fontSize: 18,
                marginTop: 10,
                maxWidth: 700,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
