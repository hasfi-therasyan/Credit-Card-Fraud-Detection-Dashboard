"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import {
  fetchSummary,
  fetchTransactions,
  fetchTrend,
  fetchUploads,
  markReviewed,
  updateNote,
  uploadCsv,
  type Summary,
  type TransactionItem,
  type TrendPoint,
  type UploadFileItem,
} from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";

const LOADING_TIMEOUT = 60000; // 60 seconds

export default function Home() {
  const [selectedUpload, setSelectedUpload] = useState<{ id: number; filename: string } | null>(null);
  const [isUploadCycle, setIsUploadCycle] = useState(false);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({
    kpi: false,
    charts: false,
    table: false,
    history: false,
  });

  const isAnyPending = Object.values(loadingMap).some((v) => !v);
  const handleKpiLoading = useCallback((loaded: boolean) => setLoadingMap((m) => ({ ...m, kpi: loaded })), []);
  const handleChartsLoading = useCallback((loaded: boolean) => setLoadingMap((m) => ({ ...m, charts: loaded })), []);
  const handleTableLoading = useCallback((loaded: boolean) => setLoadingMap((m) => ({ ...m, table: loaded })), []);
  const handleHistoryLoading = useCallback((loaded: boolean) => setLoadingMap((m) => ({ ...m, history: loaded })), []);

  // Auto-close upload cycle when all panels finish loading
  useEffect(() => {
    if (isUploadCycle && !isAnyPending) {
      Promise.resolve().then(() => setIsUploadCycle(false));
    }
  }, [isUploadCycle, isAnyPending]);

  // Compute loading progress (0..1) based on panels in `loadingMap`.
  const progress = useMemo(() => {
    const vals = Object.values(loadingMap);
    const total = vals.length;
    const done = vals.filter(Boolean).length;
    return total ? done / total : 1;
  }, [loadingMap]);

  return (
    <div className="min-h-full bg-paper text-ink relative">
      <LoadingScreen active={isUploadCycle && isAnyPending} progress={progress} />

      {/* Top Console Instrument Bar */}
      <header className="border-b border-rule bg-paper-2">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-rule bg-paper-3 text-cool">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-medium tracking-tight text-ink">FraudShield Console</h1>
                <span className="text-[11px] text-muted border border-rule px-1.5 py-0.2 rounded font-mono">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-muted">
                Audit analytics and machine-learning fraud telemetry
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <RoleSwitcher />
            <UploadPanel
              onStart={() => {
                setIsUploadCycle(true);
                setLoadingMap({ kpi: false, charts: false, table: false, history: false });
              }}
              onEnd={(success) => {
                if (!success) {
                  setIsUploadCycle(false);
                }
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Active Analysis Filter Pill */}
        {selectedUpload && (
          <div className="flex items-center justify-between rounded border border-cool/40 bg-cool-soft/30 px-4 py-2.5 text-xs text-ink">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-cool shrink-0" />
              <div>
                <span className="text-muted mr-1.5">Filter aktif:</span>
                <span className="font-mono font-medium text-ink">{selectedUpload.filename}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedUpload(null)}
              className="rounded border border-rule-2 bg-paper-2 px-2.5 py-1 text-xs text-ink-2 hover:border-rule hover:text-ink transition-colors"
            >
              Tampilkan semua berkas
            </button>
          </div>
        )}

        {/* Section 1: KPI Telemetry Row */}
        <KpiRow uploadId={selectedUpload?.id} onLoading={handleKpiLoading} />

        {/* Section 2: Charts Telemetry */}
        <ChartsRow uploadId={selectedUpload?.id} onLoading={handleChartsLoading} />

        {/* Section 3: Workbench & File Ledger */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2">
            <SuspiciousTable uploadId={selectedUpload?.id} onLoading={handleTableLoading} />
          </div>
          <div className="lg:col-span-1">
            <FileHistory
              selectedId={selectedUpload?.id}
              onSelect={setSelectedUpload}
              onLoading={handleHistoryLoading}
            />
          </div>
        </div>

        <footer className="pt-6 border-t border-rule text-xs text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>FraudShield Audit System • Console Theme</div>
          <div className="font-mono text-[11px] text-muted">
            API endpoint: http://localhost:8000
          </div>
        </footer>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const [role, setRole] = useState<"Analyst" | "Auditor">(() => {
    if (typeof window === "undefined") return "Analyst";
    const saved = window.localStorage.getItem("fraudshield_role");
    return saved === "Auditor" ? "Auditor" : "Analyst";
  });

  useEffect(() => {
    window.localStorage.setItem("fraudshield_role", role);
  }, [role]);

  return (
    <div className="flex items-center gap-1.5 rounded border border-rule bg-paper-3 px-2 py-1 text-xs">
      <span className="text-muted text-[11px]">Operator</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value === "Auditor" ? "Auditor" : "Analyst")}
        className="rounded bg-paper-2 px-2 py-1 text-xs text-ink outline-none border border-rule focus-visible:border-accent"
      >
        <option value="Analyst">Analyst</option>
        <option value="Auditor">Auditor</option>
      </select>
    </div>
  );
}

function UploadPanel({
  onStart,
  onEnd,
}: {
  onStart: () => void;
  onEnd: (success: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);

  async function onPick(f: File | null) {
    if (!f) return;
    setBusy(true);
    onStart();
    setInsights([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);
    let success = false;

    try {
      const storedRole = window.localStorage.getItem("fraudshield_role");
      const role = storedRole === "Auditor" ? "Auditor" : "Analyst";
      const res = await uploadCsv(f, role);
      setInsights(res.insights ?? []);
      window.dispatchEvent(new Event("fraudshield_refresh"));
      success = true;
    } catch (err) {
      console.error("Upload failed", err);
      setInsights([]);
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
      onEnd(success);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-rule-2 bg-paper-2 hover:bg-paper-3 px-3 py-1.5 text-xs font-medium text-ink transition-colors">
        <FileUp className="h-3.5 w-3.5 text-accent" />
        {busy ? "Memproses…" : "Unggah CSV Transaksi"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={busy}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
      {insights.length ? (
        <div className="rounded border border-rule bg-paper-3 p-3">
          <div className="text-xs font-medium text-ink">Catatan intelijen transaksi</div>
          <ul className="mt-1.5 space-y-1 text-xs text-muted">
            {insights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent shrink-0 font-mono text-[11px]">{i + 1}.</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function KpiRow({
  uploadId,
  onLoading,
}: {
  uploadId?: number | null;
  onLoading: (l: boolean) => void;
}) {
  const [kpi, setKpi] = useState<{
    total_transactions?: number;
    total_fraud_detected?: number;
    fraud_detection_rate?: number;
    estimated_prevented_losses?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    onLoading(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);

    try {
      const data = await fetchSummary(uploadId ?? undefined);
      setKpi(data);
    } catch (err) {
      console.error("Failed to load KPI", err);
      setKpi(null);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      onLoading(true);
    }
  }, [onLoading, uploadId]);

  useEffect(() => {
    const h = () => {
      void load();
    };
    window.addEventListener("fraudshield_refresh", h);
    Promise.resolve().then(() => load());
    return () => window.removeEventListener("fraudshield_refresh", h);
  }, [load]);

  const fmtMoney = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <section className="grid grid-cols-1 gap-px bg-rule border border-rule rounded overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Transactions */}
      <div className="bg-paper-2 p-4 flex flex-col justify-between">
        <div className="text-xs text-muted">Total transaksi</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-normal tabular-nums text-ink">
            {loading ? "…" : (kpi?.total_transactions?.toLocaleString("en-US") ?? "—")}
          </span>
          <span className="text-[11px] text-muted font-mono">rekaman</span>
        </div>
      </div>

      {/* High Risk Detected */}
      <div className="bg-paper-2 p-4 flex flex-col justify-between">
        <div className="text-xs text-muted">Terdeteksi risiko tinggi</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-normal tabular-nums text-bad">
            {loading ? "…" : (kpi?.total_fraud_detected?.toLocaleString("en-US") ?? "—")}
          </span>
          <span className="text-[11px] text-bad font-mono">anomali</span>
        </div>
      </div>

      {/* Detection Rate */}
      <div className="bg-paper-2 p-4 flex flex-col justify-between">
        <div className="text-xs text-muted">Tingkat deteksi fraud</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-normal tabular-nums text-cool">
            {loading
              ? "…"
              : kpi?.fraud_detection_rate != null
              ? `${(kpi.fraud_detection_rate * 100).toFixed(2)}%`
              : "—"}
          </span>
          <span className="text-[11px] text-muted font-mono">rasio model</span>
        </div>
      </div>

      {/* Estimated Prevented Losses */}
      <div className="bg-paper-2 p-4 flex flex-col justify-between">
        <div className="text-xs text-muted">Estimasi kerugian dicegah</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-2xl font-normal tabular-nums text-ok">
            {loading
              ? "…"
              : kpi?.estimated_prevented_losses != null
              ? fmtMoney(kpi.estimated_prevented_losses)
              : "—"}
          </span>
          <span className="text-[11px] text-muted font-mono">USD</span>
        </div>
        <div className="mt-1 text-[11px] text-muted">
          Perhitungan: total nominal risiko tinggi × 0.9
        </div>
      </div>
    </section>
  );
}

function ChartsRow({
  uploadId,
  onLoading,
}: {
  uploadId?: number | null;
  onLoading: (l: boolean) => void;
}) {
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [summaryData, setSummaryData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    onLoading(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);

    try {
      const [trendRes, sumRes] = await Promise.all([
        fetchTrend(uploadId ?? undefined),
        fetchSummary(uploadId ?? undefined),
      ]);
      setTrendPoints(trendRes.points ?? []);
      setSummaryData(sumRes);
    } catch (err) {
      console.error("Failed to load charts analytics", err);
      setTrendPoints([]);
      setSummaryData(null);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      onLoading(true);
    }
  }, [onLoading, uploadId]);

  useEffect(() => {
    const h = () => {
      void load();
    };
    window.addEventListener("fraudshield_refresh", h);
    Promise.resolve().then(() => load());
    return () => window.removeEventListener("fraudshield_refresh", h);
  }, [load]);

  const riskData = useMemo(() => {
    const high = summaryData?.total_fraud_detected ?? 0;
    const medium = summaryData?.total_medium_risk ?? 0;
    const total = summaryData?.total_transactions ?? 0;
    const low = Math.max(0, total - high - medium);

    return [
      { name: "Low Risk", value: low, color: "var(--color-ok)" },
      { name: "Medium Risk", value: medium, color: "var(--color-accent)" },
      { name: "High Risk", value: high, color: "var(--color-bad)" },
    ];
  }, [summaryData]);

  const tooltipCardStyle = {
    background: "var(--color-paper-2)",
    border: "1px solid var(--color-rule)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
    color: "var(--color-ink)",
    fontSize: "12px",
  };

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Cumulative Risk Line */}
      <div className="rounded border border-rule bg-paper-2 p-4 lg:col-span-2 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-rule">
          <div>
            <h2 className="text-sm font-medium text-ink">Tren kumulatif anomali</h2>
            <p className="text-xs text-muted">Akumulasi transaksi risiko tinggi dan risiko sedang</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-bad font-medium">
              <span className="h-2 w-2 rounded-full bg-bad" /> Risiko tinggi
            </span>
            <span className="flex items-center gap-1.5 text-accent font-medium">
              <span className="h-2 w-2 rounded-full bg-accent" /> Risiko sedang
            </span>
          </div>
        </div>

        <div className="mt-4 w-full" style={{ height: "240px", minHeight: 240 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              Memuat data grafik…
            </div>
          ) : !trendPoints.length ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              Belum ada data anomali untuk divisualisasikan.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="x"
                  stroke="var(--color-muted)"
                  tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                />
                <YAxis
                  stroke="var(--color-muted)"
                  tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                />
                <RTooltip contentStyle={tooltipCardStyle} />
                <Line
                  type="monotone"
                  dataKey="high"
                  name="Risiko Tinggi"
                  stroke="var(--color-bad)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  name="Risiko Sedang"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="rounded border border-rule bg-paper-2 p-4 flex flex-col justify-between shadow-sm">
        <div className="pb-3 border-b border-rule">
          <h2 className="text-sm font-medium text-ink">Distribusi tingkat risiko</h2>
          <p className="text-xs text-muted">Proporsi klasifikasi fraud di seluruh rekaman</p>
        </div>

        <div className="my-2 w-full flex-1" style={{ height: "200px", minHeight: 200 }}>
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
              Memuat data proporsi…
            </div>
          ) : !summaryData?.total_transactions ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              Tidak ada data.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <RTooltip contentStyle={tooltipCardStyle} />
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  stroke="var(--color-paper-2)"
                  strokeWidth={2}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-rule text-center">
          <div className="rounded border border-rule bg-paper-3 p-1.5">
            <div className="text-[11px] text-muted">Rendah</div>
            <div className="font-mono text-xs font-semibold text-ok">
              {riskData.find((r) => r.name === "Low Risk")?.value.toLocaleString("en-US") ?? 0}
            </div>
          </div>
          <div className="rounded border border-accent/20 bg-accent-soft p-1.5">
            <div className="text-[11px] text-accent">Sedang</div>
            <div className="font-mono text-xs font-semibold text-accent">
              {riskData.find((r) => r.name === "Medium Risk")?.value.toLocaleString("en-US") ?? 0}
            </div>
          </div>
          <div className="rounded border border-bad/20 bg-bad-soft p-1.5">
            <div className="text-[11px] text-bad">Tinggi</div>
            <div className="font-mono text-xs font-semibold text-bad">
              {riskData.find((r) => r.name === "High Risk")?.value.toLocaleString("en-US") ?? 0}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SuspiciousTable({
  uploadId,
  onLoading,
}: {
  uploadId?: number | null;
  onLoading: (l: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<string>("");
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onLoading(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);

    try {
      const res = await fetchTransactions({
        q: q || undefined,
        risk: risk || undefined,
        limit: 50,
        offset: 0,
        upload_id: uploadId ?? undefined,
      });
      setItems(res.items);
    } catch (err) {
      console.error("Failed to load transactions", err);
      setItems([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      onLoading(true);
    }
  }, [q, risk, uploadId, onLoading]);

  useEffect(() => {
    const h = () => {
      void load();
    };
    window.addEventListener("fraudshield_refresh", h);
    Promise.resolve().then(() => load());
    return () => window.removeEventListener("fraudshield_refresh", h);
  }, [load]);

  async function onReview(t: TransactionItem, status: TransactionItem["investigation_status"]) {
    const storedRole = window.localStorage.getItem("fraudshield_role");
    const role = storedRole === "Analyst" ? "Analyst" : "Auditor";
    await markReviewed({ id: t.id, reviewed: true, status, role });
    window.dispatchEvent(new Event("fraudshield_refresh"));
  }

  async function onSaveNote(t: TransactionItem) {
    setSavingNoteId(t.id);
    try {
      const storedRole = window.localStorage.getItem("fraudshield_role");
      const role = storedRole === "Analyst" ? "Analyst" : "Auditor";
      await updateNote({ id: t.id, note: noteDraft[t.id] ?? t.notes ?? "", role });
      window.dispatchEvent(new Event("fraudshield_refresh"));
    } finally {
      setSavingNoteId(null);
    }
  }

  return (
    <section className="rounded border border-rule bg-paper-2">
      {/* Workbench Header */}
      <div className="p-4 border-b border-rule flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-ink">Buku kerja investigasi transaksi</h2>
          <p className="text-xs text-muted">
            Diurutkan berdasarkan probabilitas fraud tertinggi. Klik ID untuk inspeksi indikator AI.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari ID transaksi…"
              className="h-8 w-44 rounded border border-rule bg-paper-3 pl-8 pr-2.5 text-xs text-ink placeholder:text-muted focus-visible:border-accent outline-none"
            />
          </div>

          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="h-8 rounded border border-rule bg-paper-3 px-2 text-xs text-ink focus-visible:border-accent outline-none"
          >
            <option value="">Semua tingkat risiko</option>
            <option value="Low Risk">Low Risk</option>
            <option value="Medium Risk">Medium Risk</option>
            <option value="High Risk">High Risk</option>
          </select>

          <button
            onClick={load}
            disabled={loading}
            className="h-8 inline-flex items-center gap-1.5 rounded border border-rule-2 bg-paper-3 hover:bg-paper px-3 text-xs font-medium text-ink transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Memuat…" : "Terapkan"}
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-rule bg-paper-3 text-muted">
              <th className="py-2.5 px-4 font-medium">ID Transaksi</th>
              <th className="py-2.5 px-4 font-medium text-right">Nominal</th>
              <th className="py-2.5 px-4 font-medium">Probabilitas</th>
              <th className="py-2.5 px-4 font-medium">Klasifikasi</th>
              <th className="py-2.5 px-4 font-medium">Status Audit</th>
              <th className="py-2.5 px-4 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {items.map((t) => {
              const isRowExpanded = expanded === t.id;
              return (
                <Fragment key={t.id}>
                  <tr
                    className={`hover:bg-paper-3/50 transition-colors ${
                      isRowExpanded ? "bg-paper-3" : ""
                    }`}
                  >
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => setExpanded(isRowExpanded ? null : t.id)}
                        className="inline-flex items-center gap-1.5 font-mono text-cool hover:underline focus-visible:outline-none"
                      >
                        {isRowExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted" />
                        )}
                        <span>{t.transaction_id}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink">
                      {(t.amount ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums font-medium text-ink w-12">
                          {(t.fraud_probability * 100).toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 bg-paper-3 rounded overflow-hidden border border-rule">
                          <div
                            className={`h-full ${
                              t.risk_level === "High Risk"
                                ? "bg-bad"
                                : t.risk_level === "Medium Risk"
                                ? "bg-accent"
                                : "bg-ok"
                            }`}
                            style={{ width: `${Math.min(100, t.fraud_probability * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <RiskBadge level={t.risk_level} />
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-2">{t.investigation_status}</span>
                        {t.reviewed && (
                          <span className="inline-flex items-center text-[10px] text-ok font-mono">
                            [diverifikasi]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onReview(t, "Under Review")}
                          className="rounded border border-rule px-2 py-1 text-[11px] text-muted hover:text-ink hover:border-rule-2 transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => onReview(t, "Resolved")}
                          className="rounded border border-ok/40 bg-ok-soft/30 px-2 py-1 text-[11px] text-ok hover:bg-ok-soft/50 transition-colors"
                        >
                          Selesai
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Inspection Drawer */}
                  {isRowExpanded && (
                    <tr className="bg-paper-3">
                      <td colSpan={6} className="p-4 border-b border-rule">
                        <div className="rounded border border-rule bg-paper-2 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Explainability Indications */}
                          <div>
                            <div className="text-xs font-medium text-ink flex items-center gap-1.5 mb-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                              Indikator Anomali AI (Explainable Factors)
                            </div>
                            {t.why_flagged?.length ? (
                              <ul className="space-y-1.5 text-xs text-muted">
                                {t.why_flagged.map((r, i) => (
                                  <li key={i} className="flex gap-2 items-start">
                                    <span className="text-accent font-mono text-[11px]">#{i + 1}</span>
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-muted">
                                Tidak ada indikator anomali khusus.
                              </div>
                            )}
                          </div>

                          {/* Investigation Notes Form */}
                          <div>
                            <div className="text-xs font-medium text-ink flex items-center gap-1.5 mb-2">
                              <UserCheck className="h-3.5 w-3.5 text-cool" />
                              Catatan Audit & Justifikasi Investigasi
                            </div>
                            <textarea
                              value={noteDraft[t.id] ?? t.notes ?? ""}
                              onChange={(e) =>
                                setNoteDraft((s) => ({ ...s, [t.id]: e.target.value }))
                              }
                              placeholder="Masukkan hasil penelusuran bukti transaksi, kontak nasabah, atau tindakan…"
                              className="w-full h-20 rounded border border-rule bg-paper-3 p-2.5 text-xs text-ink placeholder:text-muted focus-visible:border-accent outline-none resize-none font-mono"
                            />
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[11px] text-muted font-mono">
                                Terakhir diperbarui: {t.updated_at ? t.updated_at.substring(0, 19).replace("T", " ") : "—"}
                              </span>
                              <button
                                onClick={() => onSaveNote(t)}
                                disabled={savingNoteId === t.id}
                                className="rounded border border-accent bg-accent text-accent-ink px-3 py-1 text-xs font-medium hover:opacity-90 transition-opacity"
                              >
                                {savingNoteId === t.id ? "Menyimpan…" : "Simpan Catatan"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {!items.length && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-muted">
                  Belum ada data transaksi. Silakan unggah berkas CSV untuk memulai audit.
                </td>
              </tr>
            )}
            {loading && !items.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-muted font-mono">
                  Memuat data transaksi…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileHistory({
  selectedId,
  onSelect,
  onLoading,
}: {
  selectedId?: number | null;
  onSelect: (upload: { id: number; filename: string } | null) => void;
  onLoading: (l: boolean) => void;
}) {
  const [uploads, setUploads] = useState<UploadFileItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onLoading(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);

    try {
      const data = await fetchUploads();
      const uploadsWithSummary = await Promise.all(
        data.map(async (item) => {
          try {
            const summary = await fetchSummary(item.id);
            return { ...item, summary };
          } catch {
            return item;
          }
        })
      );
      setUploads(uploadsWithSummary);
    } catch (err) {
      console.error("Failed to fetch uploads history", err);
      setUploads([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      onLoading(true);
    }
  }, [onLoading]);

  useEffect(() => {
    const h = () => {
      void load();
    };
    window.addEventListener("fraudshield_refresh", h);
    Promise.resolve().then(() => load());
    return () => window.removeEventListener("fraudshield_refresh", h);
  }, [load]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <section className="rounded border border-rule bg-paper-2 flex flex-col">
      <div className="p-4 border-b border-rule flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-ink">Histori berkas audit</h2>
          <p className="text-xs text-muted">Daftar batch CSV yang di-scan</p>
        </div>
        <Clock className="h-4 w-4 text-muted" />
      </div>

      <div className="p-4 flex-1 overflow-y-auto max-h-[580px] space-y-3">
        {loading && uploads.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted font-mono">
            Memuat riwayat berkas…
          </div>
        ) : !uploads.length ? (
          <div className="py-6 text-center text-xs text-muted">
            Belum ada berkas yang dianalisis.
          </div>
        ) : (
          <>
            {/* Summary Mini Bar Chart */}
            {uploads.some((item) => item.summary != null) && (
              <div className="rounded border border-rule bg-paper-3 p-3 mb-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-ink font-medium">Volume transaksi per berkas</span>
                  <span className="text-muted text-[11px]">8 terbaru</span>
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={uploads.slice(0, 8).map((item) => ({
                        name: new Date(item.uploaded_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        }),
                        total: item.summary?.total_transactions ?? 0,
                      }))}
                      margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="var(--color-muted)"
                        tick={{ fontSize: 9, fill: "var(--color-muted)" }}
                      />
                      <YAxis
                        stroke="var(--color-muted)"
                        tick={{ fontSize: 9, fill: "var(--color-muted)" }}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "var(--color-paper-2)",
                          border: "1px solid var(--color-rule)",
                          borderRadius: "4px",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                          color: "var(--color-ink)",
                          fontSize: "11px",
                        }}
                      />
                      <Bar dataKey="total" fill="var(--color-cool)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* List of Files */}
            {uploads.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSelected) {
                      onSelect(null);
                    } else {
                      onSelect({ id: item.id, filename: item.filename });
                    }
                  }}
                  className={`rounded border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-cool bg-cool-soft/30"
                      : "border-rule bg-paper-3 hover:border-rule-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileSpreadsheet
                        className={`h-4 w-4 shrink-0 ${isSelected ? "text-cool" : "text-muted"}`}
                      />
                      <span
                        className={`truncate text-xs font-medium ${
                          isSelected ? "text-ink" : "text-ink-2"
                        }`}
                        title={item.filename}
                      >
                        {item.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="rounded border border-cool px-1.5 py-0.2 text-[9px] font-mono text-cool">
                          AKTIF
                        </span>
                      )}
                      <span
                        className={`rounded border px-1.5 py-0.2 text-[9px] font-mono ${
                          item.status === "SUCCESS"
                            ? "border-ok/40 text-ok"
                            : "border-bad/40 text-bad"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-[11px] text-muted">
                    <div>
                      <span className="text-[10px] text-muted block">Tanggal</span>
                      <span className="font-mono">{formatDate(item.uploaded_at)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Ukuran</span>
                      <span className="font-mono">{formatSize(item.size_bytes)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Operator</span>
                      <span className="truncate block max-w-full text-ink-2">
                        {item.uploaded_by} ({item.role})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Hash</span>
                      <span className="font-mono text-[10px] text-muted" title={item.sha256}>
                        {item.sha256.substring(0, 8)}…
                      </span>
                    </div>
                  </div>

                  {item.summary && (
                    <div className="mt-3 pt-2 border-t border-rule">
                      <div className="flex items-center justify-between text-[10px] text-muted mb-1.5 font-mono">
                        <span className="text-bad">Tinggi: {item.summary.total_fraud_detected}</span>
                        <span className="text-accent">Sedang: {item.summary.total_medium_risk}</span>
                        <span className="text-ok">
                          Rendah:{" "}
                          {Math.max(
                            0,
                            (item.summary.total_transactions ?? 0) -
                              (item.summary.total_fraud_detected ?? 0) -
                              (item.summary.total_medium_risk ?? 0)
                          )}
                        </span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded bg-paper">
                        <div
                          className="h-full bg-bad"
                          style={{
                            width: `${
                              item.summary.total_transactions
                                ? (item.summary.total_fraud_detected /
                                    item.summary.total_transactions) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${
                              item.summary.total_transactions
                                ? (item.summary.total_medium_risk /
                                    item.summary.total_transactions) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                        <div
                          className="h-full bg-ok"
                          style={{
                            width: `${
                              item.summary.total_transactions
                                ? (((item.summary.total_transactions -
                                    item.summary.total_fraud_detected -
                                    item.summary.total_medium_risk) /
                                    item.summary.total_transactions) *
                                    100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}

function LoadingScreen({ active, progress }: { active: boolean; progress: number }) {
  if (!active) return null;

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-paper/90 transition-opacity">
      <div className="flex flex-col items-center gap-4 rounded border border-rule bg-paper-2 p-6 max-w-sm w-full text-center">
        {/* Loading Spinner */}
        <div className="h-10 w-10 rounded-full border-2 border-rule border-t-accent animate-spin motion-reduce:animate-none" />

        <div>
          <h3 className="text-sm font-medium text-ink">Memproses analisis fraud</h3>
          <p className="text-xs text-muted mt-1">Mengaplikasikan model machine learning…</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-muted">Proses validasi</span>
            <span className="font-mono font-medium text-ink">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-paper-3 rounded overflow-hidden border border-rule">
            <div
              className="h-full bg-accent duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
