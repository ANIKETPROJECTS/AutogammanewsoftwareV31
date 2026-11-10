import { useDashboard } from "@/hooks/use-dashboard";
import { PAYMENT_METHODS, LEGACY_PAYMENT_METHODS } from "@shared/payment-methods";
import { Layout } from "@/components/layout/layout";
import { StatCard } from "@/components/ui/stat-card";
import {
  IndianRupee,
  MessageCircle,
  Activity,
  History,
  Calendar,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Phone,
  FileText,
  CreditCard,
  Trash2,
  Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Invoice } from "@shared/schema";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BalanceInvoice = Invoice & { paidAmount: number; balanceAmount: number };
type SortKey = "balance-desc" | "balance-asc" | "name-asc" | "name-desc" | "invoices-desc" | "date-desc" | "date-asc";

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function safeFmt(dateStr?: string) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMM yyyy"); } catch { return dateStr; }
}

// Map item types to badge colors
const TYPE_STYLES: Record<string, string> = {
  PPF: "bg-blue-50 text-blue-700 border-blue-200",
  Service: "bg-purple-50 text-purple-700 border-purple-200",
  Accessory: "bg-amber-50 text-amber-700 border-amber-200",
  Labor: "bg-slate-50 text-slate-600 border-slate-200",
};

function ItemTypeBadges({ items }: { items: Invoice["items"] }) {
  const types = Array.from(new Set((items || []).map(i => i.type).filter(Boolean)));
  if (!types.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {types.map(t => (
        <span
          key={t}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_STYLES[t] || "bg-muted text-muted-foreground border-border"}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────
function PaymentDialog({
  invoice,
  open,
  onClose,
}: {
  invoice: BalanceInvoice | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [newPayments, setNewPayments] = useState<{ amount: number | string; method: string; date: string }[]>([
    { amount: "", method: "Cash", date: today },
  ]);

  const reset = () => setNewPayments([{ amount: "", method: "Cash", date: today }]);

  const alreadyPaid = invoice ? (invoice.payments || []).reduce((s, p) => s + (p.amount || 0), 0) : 0;
  const newTotal = newPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = invoice ? Math.max(0, invoice.totalAmount - alreadyPaid - newTotal) : 0;

  const mutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { payments: { amount: number; method: string; date: string }[] } }) => {
      const existingPayments = invoice?.payments || [];
      const updatedPayments = [...existingPayments, ...data.payments];
      const totalPaid = updatedPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const isFullyPaid = totalPaid >= (invoice?.totalAmount || 0);
      await apiRequest("PATCH", `/api/invoices/${id}`, { payments: updatedPayments, isPaid: isFullyPaid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/balance-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment recorded successfully" });
      reset();
      onClose();
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  const handleConfirm = () => {
    if (!invoice?.id) return;
    const valid = newPayments
      .filter(p => Number(p.amount) > 0)
      .map(p => ({ amount: Number(p.amount), method: p.method, date: p.date }));
    if (!valid.length) {
      toast({ title: "Enter at least one payment amount", variant: "destructive" });
      return;
    }
    mutation.mutate({ id: invoice.id, data: { payments: valid } });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoice?.invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Summary strip */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 uppercase font-bold mb-1">
              <span>Total</span>
              <span className="text-center">Total Paid</span>
              <span className="text-right">Remaining</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-base font-black">
              <span className="text-slate-900">{formatINR(invoice?.totalAmount || 0)}</span>
              <span className="text-center text-emerald-600">{formatINR(alreadyPaid + newTotal)}</span>
              <span className="text-right text-red-600">{formatINR(remaining)}</span>
            </div>
          </div>

          {/* Customer info */}
          <div className="text-xs text-muted-foreground flex items-center gap-4 px-1">
            <span className="font-medium text-foreground">{invoice?.customerName}</span>
            <span>•</span>
            <span>{invoice?.phoneNumber}</span>
            <span>•</span>
            <span className="font-mono">{invoice?.invoiceNo}</span>
          </div>

          {/* Payment rows */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Payment Details</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setNewPayments(prev => [...prev, { amount: "", method: "Cash", date: today }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Method
              </Button>
            </div>
            {newPayments.map((p, i) => (
              <div key={i} className="flex items-end gap-2 bg-slate-50 p-3 rounded-md">
                <div className="flex-1 min-w-[110px] space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Method</label>
                  <Select
                    value={p.method}
                    onValueChange={v => setNewPayments(prev => prev.map((r, idx) => idx === i ? { ...r, method: v } : r))}
                  >
                    <SelectTrigger className="h-9" data-testid={`select-pay-method-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                      {LEGACY_PAYMENT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[120px] space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date</label>
                  <Input
                    type="date"
                    className="h-9"
                    value={p.date}
                    onChange={e => setNewPayments(prev => prev.map((r, idx) => idx === i ? { ...r, date: e.target.value } : r))}
                    data-testid={`input-pay-date-${i}`}
                  />
                </div>
                <div className="flex-1 min-w-[100px] space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amount (₹)</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-9"
                    placeholder="0"
                    value={p.amount}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      setNewPayments(prev => prev.map((r, idx) => idx === i ? { ...r, amount: v } : r));
                    }}
                    data-testid={`input-pay-amount-${i}`}
                  />
                </div>
                {newPayments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNewPayments(prev => prev.filter((_, idx) => idx !== i))}
                    className="h-9 w-9 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            data-testid="button-confirm-payment"
          >
            {mutation.isPending ? "Saving…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Per-customer collapsible row ────────────────────────────────────────────
function CustomerBalanceRow({
  name, phone, invoices,
  onPayment,
}: {
  name: string; phone: string; invoices: BalanceInvoice[];
  onPayment: (inv: BalanceInvoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalBalance = invoices.reduce((s, i) => s + i.balanceAmount, 0);
  const [, navigate] = useLocation();

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      {/* Customer header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-4 py-3 bg-background hover:bg-muted/40 transition-colors text-left"
      >
        <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-red-600">{name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{name}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Phone className="h-3 w-3" />
            <span>{phone || "—"}</span>
          </div>
        </div>
        <div className="text-right mr-3">
          <p className="text-xs text-muted-foreground mb-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
          <p className="text-base font-bold text-red-600">{formatINR(totalBalance)}</p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {/* Invoices detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="invoices"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60 bg-muted/20">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Business</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Types</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-red-500 uppercase tracking-wide">Balance</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {invoices.map(inv => {
                      const isPartial = inv.paidAmount > 0 && inv.balanceAmount > 0;
                      const isPaid = inv.totalAmount <= 0 || inv.balanceAmount <= 0;
                      return (
                      <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{inv.invoiceNo}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs font-medium">{inv.business}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {isPaid ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                              Paid
                            </span>
                          ) : isPartial ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              Partial Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ItemTypeBadges items={inv.items} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{safeFmt(inv.date)}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium">{formatINR(inv.totalAmount)}</td>
                        <td className="px-4 py-3 text-right text-xs text-emerald-600 font-medium">{formatINR(inv.paidAmount)}</td>
                        <td className="px-4 py-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-red-600">{formatINR(inv.balanceAmount)}</div>
                            {isPartial && (
                              <div className="text-[10px] text-muted-foreground">of {formatINR(inv.totalAmount)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); navigate(`/invoice/${inv.id}`); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors whitespace-nowrap"
                              data-testid={`link-invoice-${inv.id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              View Invoice
                            </button>
                            <span className="text-border/70">|</span>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); onPayment(inv); }}
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors whitespace-nowrap"
                              data-testid={`button-pay-${inv.id}`}
                            >
                              <CreditCard className="h-3 w-3" />
                              Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border/40">
                {invoices.map(inv => (
                  <div key={inv.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-foreground">{inv.invoiceNo}</span>
                      <div className="flex items-center gap-1.5">
                        {inv.paidAmount > 0 && inv.balanceAmount > 0 ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">Partial Paid</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">Unpaid</span>
                        )}
                        <Badge variant="outline" className="text-xs">{inv.business}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <ItemTypeBadges items={inv.items} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{safeFmt(inv.date)}</span>
                      <span>Total: {formatINR(inv.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600">Paid: {formatINR(inv.paidAmount)}</span>
                        <span className="text-red-600 font-bold">Due: {formatINR(inv.balanceAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); navigate(`/invoice/${inv.id}`); }}
                          className="inline-flex items-center gap-1 text-xs text-primary font-medium"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Invoice
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onPayment(inv); }}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"
                        >
                          <CreditCard className="h-3 w-3" />
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Balance Accounts Panel ───────────────────────────────────────────────────
function BalanceAccountsPanel() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("balance-desc");
  const [payingInvoice, setPayingInvoice] = useState<BalanceInvoice | null>(null);

  const { data: balanceInvoices = [], isLoading } = useQuery<BalanceInvoice[]>({
    queryKey: ["/api/dashboard/balance-invoices"],
    refetchInterval: 30000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; invoices: BalanceInvoice[]; newestDate: string }>();
    for (const inv of balanceInvoices) {
      const key = `${inv.customerName}||${inv.phoneNumber}`;
      if (!map.has(key)) map.set(key, { name: inv.customerName, phone: inv.phoneNumber, invoices: [], newestDate: inv.date || "" });
      const entry = map.get(key)!;
      entry.invoices.push(inv);
      if ((inv.date || "") > entry.newestDate) entry.newestDate = inv.date || "";
    }
    return Array.from(map.values());
  }, [balanceInvoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? grouped.filter(g =>
          g.name.toLowerCase().includes(q) ||
          g.phone.includes(q) ||
          g.invoices.some(i => i.invoiceNo.toLowerCase().includes(q))
        )
      : [...grouped];

    result.sort((a, b) => {
      const balA = a.invoices.reduce((s, i) => s + i.balanceAmount, 0);
      const balB = b.invoices.reduce((s, i) => s + i.balanceAmount, 0);
      switch (sortBy) {
        case "balance-desc": return balB - balA;
        case "balance-asc":  return balA - balB;
        case "name-asc":     return a.name.localeCompare(b.name);
        case "name-desc":    return b.name.localeCompare(a.name);
        case "invoices-desc":return b.invoices.length - a.invoices.length;
        case "date-desc":    return b.newestDate.localeCompare(a.newestDate);
        case "date-asc":     return a.newestDate.localeCompare(b.newestDate);
        default: return 0;
      }
    });
    return result;
  }, [grouped, search, sortBy]);

  const grandTotal = useMemo(() =>
    balanceInvoices.reduce((s, i) => s + i.balanceAmount, 0),
    [balanceInvoices]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                data-testid="input-balance-search"
                placeholder="Search customer, phone, invoice…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="h-8 text-xs border border-input rounded-md bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="select-balance-sort"
            >
              <option value="balance-desc">↓ Highest Balance</option>
              <option value="balance-asc">↑ Lowest Balance</option>
              <option value="name-asc">A → Z Customer</option>
              <option value="name-desc">Z → A Customer</option>
              <option value="invoices-desc">Most Invoices</option>
              <option value="date-desc">Newest Invoice</option>
              <option value="date-asc">Oldest Invoice</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="text-muted-foreground">{filtered.length} customer{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-muted-foreground">•</span>
            <span className="font-bold text-red-600">{formatINR(grandTotal)} total due</span>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
            <AlertCircle className="h-10 w-10 mb-3 opacity-25" />
            <p className="font-medium text-sm">
              {search ? "No results match your search" : "All clear — no outstanding balances"}
            </p>
            {!search && <p className="text-xs mt-1 opacity-70">Every invoice is fully paid.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(g => (
              <CustomerBalanceRow
                key={`${g.name}||${g.phone}`}
                name={g.name}
                phone={g.phone}
                invoices={g.invoices}
                onPayment={setPayingInvoice}
              />
            ))}
          </div>
        )}
      </div>

      {/* Payment dialog — single instance at panel level */}
      <PaymentDialog
        invoice={payingInvoice}
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
      />
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;

  const getIcon = (key: string) => {
    switch (key) {
      case "Balance Amount": return <IndianRupee className="h-6 w-6" />;
      case "Inquiries Today": return <MessageCircle className="h-6 w-6" />;
      default: return <Activity className="h-6 w-6" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-muted-foreground mt-1">Welcome back, here's what's happening at Auto Gamma today.</p>
          </div>
          <div className="hidden sm:block text-sm text-muted-foreground font-medium bg-white px-4 py-2 rounded-lg border border-border">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {data?.stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <StatCard
                label={stat.label}
                value={stat.label.includes("Amount") ? `₹${stat.value}` : stat.value}
                subtext={stat.subtext}
                icon={getIcon(stat.label)}
              />
            </motion.div>
          ))}
        </div>

        {/* Balance Accounts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-red-50/60 border-b py-3 px-6 flex flex-row items-center gap-2">
              <IndianRupee className="h-4 w-4 text-red-600" />
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex-1">
                Balance Accounts
              </CardTitle>
              <Link href="/invoice">
                <button type="button" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors" data-testid="link-all-invoices">
                  <FileText className="h-3.5 w-3.5" />
                  All Invoices
                </button>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              <BalanceAccountsPanel />
            </CardContent>
          </Card>
        </motion.div>

        {/* Tickets + Appointments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <Link href="/tickets">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6 flex flex-row items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors">
                <History className="h-4 w-4 text-red-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Tickets</CardTitle>
              </CardHeader>
            </Link>
            <CardContent className="p-0">
              <div className="divide-y">
                {data?.activeJobs && data.activeJobs.length > 0 ? (
                  data.activeJobs.map(job => (
                    <Link key={job.id} href={`/tickets?id=${job.id}`}>
                      <div className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer">
                        <div>
                          <p className="font-bold text-slate-900">{job.customerName}</p>
                          <p className="text-sm text-slate-500">{job.vehicleInfo}</p>
                        </div>
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100 font-bold">{job.status}</Badge>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No tickets currently.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <Link href="/appointments">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6 flex flex-row items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors">
                <Calendar className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming Appointments</CardTitle>
              </CardHeader>
            </Link>
            <CardContent className="p-0">
              <div className="divide-y">
                {data?.upcomingAppointments && data.upcomingAppointments.length > 0 ? (
                  data.upcomingAppointments.map(appt => (
                    <Link key={appt.id} href="/appointments">
                      <div className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer">
                        <div>
                          <p className="font-bold text-slate-900">{appt.customerName}</p>
                          <p className="text-sm text-slate-500">{appt.vehicleInfo} • {appt.serviceType}</p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{appt.date} at {appt.time}</p>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold">Scheduled</Badge>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No upcoming appointments.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function DashboardSkeleton() {
  return (
    <Layout>
      <div className="p-6 space-y-8">
        <div className="flex justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {[1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </Layout>
  );
}
