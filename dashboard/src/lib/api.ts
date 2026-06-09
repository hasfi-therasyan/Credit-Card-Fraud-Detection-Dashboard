export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type Summary = {
  total_transactions: number;
  total_fraud_detected: number;
  total_medium_risk: number;
  fraud_detection_rate: number;
  estimated_prevented_losses: number;
};

export type TransactionItem = {
  id: number;
  transaction_id: string;
  amount: number | null;
  fraud_probability: number;
  risk_level: "Low Risk" | "Medium Risk" | "High Risk";
  why_flagged: string[];
  reviewed: boolean;
  investigation_status: "Pending" | "Under Review" | "Resolved";
  notes: string;
  updated_at: string;
};

export type UploadFileItem = {
  id: number;
  uploaded_at: string;
  filename: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string;
  role: string;
  status: string;
  summary?: Summary;
};

export async function fetchSummary(uploadId?: number): Promise<Summary> {
  const sp = new URLSearchParams();
  if (uploadId !== undefined && uploadId !== null) {
    sp.set("upload_id", String(uploadId));
  }
  const url = sp.toString() ? `${API_BASE}/api/summary?${sp.toString()}` : `${API_BASE}/api/summary`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchUploads(): Promise<UploadFileItem[]> {
  const res = await fetch(`${API_BASE}/api/uploads`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTransactions(params: {
  q?: string;
  risk?: string;
  min_amount?: number;
  max_amount?: number;
  limit?: number;
  offset?: number;
  upload_id?: number;
}): Promise<{ total: number; items: TransactionItem[] }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.risk) sp.set("risk", params.risk);
  if (params.min_amount != null) sp.set("min_amount", String(params.min_amount));
  if (params.max_amount != null) sp.set("max_amount", String(params.max_amount));
  if (params.upload_id != null) sp.set("upload_id", String(params.upload_id));
  sp.set("limit", String(params.limit ?? 50));
  sp.set("offset", String(params.offset ?? 0));
  const res = await fetch(`${API_BASE}/api/transactions?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadCsv(file: File, role: "Analyst" | "Auditor" = "Analyst") {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload?role=${encodeURIComponent(role)}`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ insights: string[] }>;
}

export async function markReviewed(args: {
  id: number;
  reviewed: boolean;
  status: "Pending" | "Under Review" | "Resolved";
  role: "Analyst" | "Auditor";
}) {
  const sp = new URLSearchParams();
  sp.set("reviewed", String(args.reviewed));
  sp.set("status", args.status);
  sp.set("role", args.role);
  const res = await fetch(`${API_BASE}/api/transactions/${args.id}/review?${sp.toString()}`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateNote(args: { id: number; note: string; role: "Analyst" | "Auditor" }) {
  const sp = new URLSearchParams();
  sp.set("note", args.note);
  sp.set("role", args.role);
  const res = await fetch(`${API_BASE}/api/transactions/${args.id}/note?${sp.toString()}`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

