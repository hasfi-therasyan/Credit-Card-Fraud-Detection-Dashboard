export function RiskBadge({ level }: { level: "Low Risk" | "Medium Risk" | "High Risk" }) {
  const styles =
    level === "High Risk"
      ? "border-bad/40 text-bad bg-bad-soft/40"
      : level === "Medium Risk"
        ? "border-accent/40 text-accent bg-accent-soft/40"
        : "border-ok/40 text-ok bg-ok-soft/40";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${styles}`}
    >
      {level}
    </span>
  );
}
