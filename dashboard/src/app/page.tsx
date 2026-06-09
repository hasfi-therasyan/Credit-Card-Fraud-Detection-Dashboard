"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { AlertTriangle, FileUp, Shield, Search, ClipboardCheck, Clock, FileSpreadsheet } from "lucide-react";
import { fetchSummary, fetchTransactions, fetchUploads, markReviewed, updateNote, uploadCsv, type TransactionItem, type UploadFileItem } from "@/lib/api";
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
    <div className="min-h-full bg-[#070A12] text-zinc-100 relative">
      <LoadingScreen active={isUploadCycle && isAnyPending} progress={progress} />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-sky-300/80">
              ENTERPRISE FRAUD MONITORING • AUDIT ANALYTICS
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">FraudShield Analytics</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              Upload transaksi (CSV Kaggle format) → AI fraud scoring → explainable indicators + audit investigation workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
        </header>

        <main className="mt-8 grid grid-cols-1 gap-6">
          {selectedUpload && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/5 px-5 py-4 text-sm text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.05)]">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-500/10 p-2 text-sky-300">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-sky-300/70 uppercase tracking-wider">Filter Analisis Aktif</div>
                  <div className="font-semibold text-zinc-100 mt-0.5">{selectedUpload.filename}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUpload(null)}
                className="rounded-xl bg-sky-500/15 hover:bg-sky-500/25 px-4 py-2 text-xs font-semibold text-sky-100 ring-1 ring-sky-500/30 transition-all duration-200"
              >
                Tampilkan Semua Berkas
              </button>
            </div>
          )}

          <KpiRow 
            uploadId={selectedUpload?.id} 
            onLoading={handleKpiLoading}
          />
          <ChartsRow 
            uploadId={selectedUpload?.id} 
            onLoading={handleChartsLoading}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2">
              <SuspiciousTable 
                uploadId={selectedUpload?.id} 
                onLoading={handleTableLoading}
              />
            </div>
            <div className="lg:col-span-1">
              <FileHistory 
                selectedId={selectedUpload?.id}
                onSelect={setSelectedUpload}
                onLoading={handleHistoryLoading}
              />
            </div>
          </div>
        </main>

        <footer className="mt-10 text-xs text-zinc-500">
          Local demo. API default: <span className="font-mono text-zinc-400">http://localhost:8000</span>
        </footer>
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-zinc-300">{title}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          {sub ? <div className="mt-1 text-xs text-zinc-400">{sub}</div> : null}
        </div>
        <div className="rounded-xl bg-white/5 p-2 text-sky-200">{icon}</div>
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
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
      <span className="px-2 text-xs font-semibold text-zinc-300">Role</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value === "Auditor" ? "Auditor" : "Analyst")}
        className="rounded-xl bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-white/10"
      >
        <option>Analyst</option>
        <option>Auditor</option>
      </select>
    </div>
  );
}

function UploadPanel({ onStart, onEnd }: { onStart: () => void; onEnd: (success: boolean) => void }) {
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
      <label className="group flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 shadow-sm hover:border-white/20">
        <FileUp className="h-4 w-4 text-sky-200" />
        {busy ? "Processing..." : "Upload Transaction CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={busy}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
      {insights.length ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold tracking-wide text-zinc-300">Business Insights</div>
          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
            {insights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-300/80" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function KpiRow({ uploadId, onLoading }: { uploadId?: number | null; onLoading: (l: boolean) => void }) {
  const [kpi, setKpi] = useState<{
    total_transactions?: number;
    total_fraud_detected?: number;
    fraud_detection_rate?: number;
    estimated_prevented_losses?: number;
  } | null>(null);

  const load = useCallback(async () => {
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
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card title="Total Transactions" value={String(kpi?.total_transactions ?? "—")} icon={<Shield className="h-5 w-5" />} />
      <Card
        title="Total Fraud Detected (High Risk)"
        value={String(kpi?.total_fraud_detected ?? "—")}
        icon={<AlertTriangle className="h-5 w-5" />}
      />
      <Card
        title="Fraud Detection Rate"
        value={kpi?.fraud_detection_rate != null ? `${(kpi.fraud_detection_rate * 100).toFixed(2)}%` : "—"}
        icon={<ClipboardCheck className="h-5 w-5" />}
      />
      <Card
        title="Estimated Prevented Losses"
        value={kpi?.estimated_prevented_losses != null ? fmtMoney(kpi.estimated_prevented_losses) : "—"}
        sub="Proxy: sum(high risk amount) × 0.9"
        icon={<Shield className="h-5 w-5" />}
      />
    </section>
  );
}

function ChartsRow({ uploadId, onLoading }: { uploadId?: number | null; onLoading: (l: boolean) => void }) {
  const [items, setItems] = useState<TransactionItem[]>([]);

  const load = useCallback(async () => {
    onLoading(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOADING_TIMEOUT);
    
    try {
      const res = await fetchTransactions({ limit: 200, offset: 0, upload_id: uploadId ?? undefined });
      setItems(res.items);
    } catch (err) {
      console.error("Failed to load charts transactions", err);
      setItems([]);
    } finally {
      clearTimeout(timeoutId);
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
    const c = { "Low Risk": 0, "Medium Risk": 0, "High Risk": 0 } as Record<string, number>;
    for (const t of items) c[t.risk_level] = (c[t.risk_level] ?? 0) + 1;
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [items]);

  const trend = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const buckets: { idx: number; high: number; medium: number }[] = [];
    sorted.forEach((t, i) => {
      const b = buckets[i] ?? { idx: i + 1, high: 0, medium: 0 };
      if (t.risk_level === "High Risk") b.high += 1;
      if (t.risk_level === "Medium Risk") b.medium += 1;
      buckets[i] = b;
    });
    // cumulative
    let ch = 0,
      cm = 0;
    return buckets.map((b) => {
      ch += b.high;
      cm += b.medium;
      return { x: b.idx, high: ch, medium: cm };
    });
  }, [items]);

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
        <div className="text-sm font-semibold">Fraud Trend (Cumulative)</div>
        <div className="mt-4 w-full" style={{ height: '256px', minHeight: 256 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={trend}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="x" stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 12 }} />
              <RTooltip contentStyle={{ background: "#0b1020", border: "1px solid rgba(255,255,255,0.12)" }} />
              <Line type="monotone" dataKey="high" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="medium" stroke="#fbbf24" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-zinc-400">High Risk (red) & Medium Risk (amber) over latest records.</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold">Risk Distribution</div>
        <div className="mt-4 w-full" style={{ height: '256px', minHeight: 256 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <RTooltip contentStyle={{ background: "#0b1020", border: "1px solid rgba(255,255,255,0.12)" }} />
              <Pie
                data={riskData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                stroke="rgba(255,255,255,0.08)"
                fill="#38bdf8"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-xs text-zinc-400">Split by Low/Medium/High risk levels.</div>
      </div>
    </section>
  );
}

function SuspiciousTable({ uploadId, onLoading }: { uploadId?: number | null; onLoading: (l: boolean) => void }) {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<string>("");
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

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
    const storedRole = window.localStorage.getItem("fraudshield_role");
    const role = storedRole === "Analyst" ? "Analyst" : "Auditor";
    await updateNote({ id: t.id, note: noteDraft[t.id] ?? t.notes ?? "", role });
    window.dispatchEvent(new Event("fraudshield_refresh"));
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">Recent Suspicious Transactions</div>
          <div className="mt-1 text-xs text-zinc-400">Sorted by highest fraud probability. Click a row for “Why This Transaction Was Flagged”.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Transaction ID"
              className="w-56 rounded-xl bg-black/30 py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-white/10 focus:ring-sky-500/40"
            />
          </div>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-sky-500/40"
          >
            <option value="">All Risk Levels</option>
            <option value="Low Risk">Low Risk</option>
            <option value="Medium Risk">Medium Risk</option>
            <option value="High Risk">High Risk</option>
          </select>
          <button
            onClick={load}
            className="rounded-xl bg-sky-500/20 px-3 py-2 text-sm font-semibold text-sky-100 ring-1 ring-sky-500/30 hover:bg-sky-500/25"
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-400">
            <tr className="border-b border-white/10">
              <th className="py-3 pr-4">Transaction ID</th>
              <th className="py-3 pr-4">Amount</th>
              <th className="py-3 pr-4">Fraud Probability</th>
              <th className="py-3 pr-4">Risk</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {items.map((t) => (
              <Fragment key={t.id}>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                      className="font-mono text-xs text-sky-200 hover:underline"
                    >
                      {t.transaction_id}
                    </button>
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-zinc-200">{(t.amount ?? 0).toFixed(2)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    <span className="font-semibold text-zinc-100">{(t.fraud_probability * 100).toFixed(2)}%</span>
                  </td>
                  <td className="py-3 pr-4">
                    <RiskBadge level={t.risk_level} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-semibold text-zinc-200">{t.investigation_status}</span>
                    {t.reviewed ? <span className="ml-2 text-xs text-emerald-300/90">Reviewed</span> : null}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onReview(t, "Under Review")}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-semibold ring-1 ring-white/10 hover:bg-white/10"
                      >
                        Mark Under Review
                      </button>
                      <button
                        onClick={() => onReview(t, "Resolved")}
                        className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/25 hover:bg-emerald-500/15"
                      >
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded === t.id ? (
                  <tr key={`${t.id}-expanded`} className="bg-white/5">
                    <td colSpan={6} className="pb-4">
                      <div className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                        <div>
                          <div className="text-xs font-semibold tracking-wide text-zinc-300">
                            Why This Transaction Was Flagged
                          </div>
                          <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                            {(t.why_flagged ?? []).map((r, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-xs font-semibold tracking-wide text-zinc-300">Investigation Notes</div>
                          <textarea
                            value={noteDraft[t.id] ?? t.notes ?? ""}
                            onChange={(e) => setNoteDraft((s) => ({ ...s, [t.id]: e.target.value }))}
                            placeholder="Add investigator note / justification / evidence..."
                            className="mt-2 h-24 w-full resize-none rounded-xl bg-black/30 p-3 text-sm outline-none ring-1 ring-white/10 focus:ring-sky-500/40"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => onSaveNote(t)}
                              className="rounded-xl bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-100 ring-1 ring-sky-500/30 hover:bg-sky-500/25"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-zinc-400">
                  No data yet. Upload a CSV to start fraud monitoring.
                </td>
              </tr>
            ) : null}
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
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Histori Analisis File</div>
          <div className="mt-1 text-xs text-zinc-400">Daftar berkas transaksi yang di-scan AI.</div>
        </div>
        <Clock className="h-4 w-4 text-zinc-400" />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
        {loading && uploads.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 animate-pulse">Loading history...</div>
        ) : !uploads.length ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            Belum ada riwayat analisis. Silakan unggah file CSV.
          </div>
        ) : (
          <>
            {uploads.some((item) => item.summary != null) ? (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">Riwayat Upload</div>
                    <div className="text-[10px] text-zinc-400">Grafik total transaksi per berkas.</div>
                  </div>
                  <div className="text-[10px] text-zinc-400">Latest {Math.min(8, uploads.length)} uploads</div>
                </div>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={uploads.map((item) => ({
                        name: new Date(item.uploaded_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
                        total: item.summary?.total_transactions ?? 0,
                        fraud: item.summary?.total_fraud_detected ?? 0,
                      }))}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 10 }} />
                      <YAxis stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 10 }} />
                      <RTooltip contentStyle={{ background: "#0b1020", border: "1px solid rgba(255,255,255,0.12)" }} />
                      <Bar dataKey="total" fill="#38bdf8" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
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
                className={`flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "border-sky-500 bg-sky-500/10 shadow-[0_0_15px_rgba(56,189,248,0.15)]"
                    : "border-white/5 bg-black/10 hover:border-white/10 hover:bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isSelected ? "text-sky-400" : "text-zinc-400"}`} />
                    <span className={`truncate text-xs font-semibold ${isSelected ? "text-sky-200" : "text-zinc-200"}`} title={item.filename}>
                      {item.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold text-sky-300 ring-1 ring-sky-500/30">
                        VIEWING
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        item.status === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                          : "bg-red-500/10 text-red-300 ring-red-500/20"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-[11px] text-zinc-400">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Tanggal</span>
                    <span>{formatDate(item.uploaded_at)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Ukuran</span>
                    <span>{formatSize(item.size_bytes)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Pengunggah</span>
                    <span className="truncate block max-w-full">
                      {item.uploaded_by} ({item.role})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">SHA256 Hash</span>
                    <span className="font-mono text-[10px] text-zinc-300" title={item.sha256}>
                      {item.sha256.substring(0, 8)}...
                    </span>
                  </div>
                </div>
                {item.summary ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Risk distribution</span>
                      <span>
                        {item.summary.total_fraud_detected} high • {item.summary.total_medium_risk} medium • {Math.max(0, (item.summary.total_transactions ?? 0) - (item.summary.total_fraud_detected ?? 0) - (item.summary.total_medium_risk ?? 0))} low
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-red-400"
                        style={{ width: `${item.summary.total_transactions ? ((item.summary.total_fraud_detected / item.summary.total_transactions) * 100) : 0}%` }}
                      />
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${item.summary.total_transactions ? ((item.summary.total_medium_risk / item.summary.total_transactions) * 100) : 0}%` }}
                      />
                      <div
                        className="h-full bg-sky-400"
                        style={{ width: `${item.summary.total_transactions ? (((item.summary.total_transactions - item.summary.total_fraud_detected - item.summary.total_medium_risk) / item.summary.total_transactions) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-sky-500/30 bg-[#070A12]/95 p-8 shadow-[0_0_50px_rgba(56,189,248,0.2)] max-w-md text-center">
        {/* Loading Spinner */}
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-sky-500/10"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-sky-400 animate-spin"></div>
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-semibold text-zinc-100 tracking-tight">
          Memproses Analisis AI
        </h3>
        
        {/* Progress Bar */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400">Memperbarui data...</p>
            <span className="text-xs font-semibold text-sky-300">{progressPercent}%</span>
          </div>
          <div className="relative w-full h-2 bg-sky-500/10 rounded-full overflow-hidden border border-sky-500/20">
            <div 
              className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(56,189,248,0.8)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
