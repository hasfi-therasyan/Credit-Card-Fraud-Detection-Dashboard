import clsx from "clsx";

export function RiskBadge({ level }: { level: "Low Risk" | "Medium Risk" | "High Risk" }) {
  const styles =
    level === "High Risk"
      ? "bg-red-500/15 text-red-300 ring-red-500/30"
      : level === "Medium Risk"
        ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
        : "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        styles,
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          level === "High Risk" ? "bg-red-400" : level === "Medium Risk" ? "bg-amber-300" : "bg-emerald-300",
        )}
      />
      {level}
    </span>
  );
}

