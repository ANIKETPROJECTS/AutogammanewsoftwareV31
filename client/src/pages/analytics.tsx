import { Layout } from "@/components/layout/layout";
import { useQuery } from "@tanstack/react-query";
import { Invoice, Expense, JobCard, VendorPurchase, Technician } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  TrendingUp, IndianRupee, ShoppingCart, Wrench, Users,
  FileText, TrendingDown, BarChart2, Package,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { getVendorPurchaseRecordSubtotal } from "@shared/vendor-purchase-pricing";

const COLORS = ["#e11d48","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

function fmtINR(n: number) { return `₹${n.toLocaleString("en-IN")}`; }
function fmtINRShort(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

type Period = "3m" | "6m" | "12m" | "all";

function getPeriodMonths(period: Period): number | null {
  if (period === "3m") return 3;
  if (period === "6m") return 6;
  if (period === "12m") return 12;
  return null;
}

function getMonthKey(dateStr: string) {
  try { return format(parseISO(dateStr), "MMM yy"); } catch { return ""; }
}

function getDateFromStr(dateStr: string): Date | null {
  try { return parseISO(dateStr); } catch { return null; }
}

function getPurchaseCost(p: any): number {
  return getVendorPurchaseRecordSubtotal(p);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      {label && <p className="font-semibold text-slate-700 mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" && p.value > 100 ? fmtINR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>
        {typeof payload[0].value === "number" && payload[0].value > 100 ? fmtINR(payload[0].value) : payload[0].value}
      </p>
    </div>
  );
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("12m");

  const { data: invoices = [], isLoading: invLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: expenses = [], isLoading: expLoading } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: jobCards = [], isLoading: jcLoading } = useQuery<JobCard[]>({ queryKey: ["/api/job-cards"] });
  const { data: vendorPurchases = [] } = useQuery<VendorPurchase[]>({ queryKey: ["/api/vendor-purchases"] });
  const { data: technicians = [] } = useQuery<Technician[]>({ queryKey: ["/api/technicians"] });

  const isLoading = invLoading || expLoading || jcLoading;

  const cutoffDate = useMemo(() => {
    const months = getPeriodMonths(period);
    return months ? subMonths(new Date(), months) : null;
  }, [period]);

  const filteredInvoices = useMemo(() => {
    if (!cutoffDate) return invoices;
    return invoices.filter(inv => {
      const d = getDateFromStr(inv.date);
      return d && d >= cutoffDate;
    });
  }, [invoices, cutoffDate]);

  const filteredExpenses = useMemo(() => {
    if (!cutoffDate) return expenses;
    return expenses.filter(e => {
      const d = getDateFromStr(e.date);
      return d && d >= cutoffDate;
    });
  }, [expenses, cutoffDate]);

  const filteredJobCards = useMemo(() => {
    if (!cutoffDate) return jobCards;
    return jobCards.filter(jc => {
      const d = getDateFromStr(jc.date);
      return d && d >= cutoffDate;
    });
  }, [jobCards, cutoffDate]);

  const filteredPurchases = useMemo(() => {
    if (!cutoffDate) return vendorPurchases;
    return vendorPurchases.filter(p => {
      const d = getDateFromStr(p.purchaseDate);
      return d && d >= cutoffDate;
    });
  }, [vendorPurchases, cutoffDate]);

  // ── KPI Summary ─────────────────────────────────────────────────────────────
  const totalRevenue = useMemo(() => filteredInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0), [filteredInvoices]);
  const totalExpense = useMemo(() => filteredExpenses.reduce((s, e) => s + (e.price || 0), 0), [filteredExpenses]);
  const netProfit = totalRevenue - totalExpense;
  const totalPaidRevenue = useMemo(() => filteredInvoices.reduce((s, i) => {
    const paid = (i.payments || []).reduce((p, x) => p + (x.amount || 0), 0);
    return s + paid;
  }, 0), [filteredInvoices]);
  const totalBalance = totalRevenue - totalPaidRevenue;

  // ── 1. Revenue over time (monthly) ──────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map: Record<string, { revenue: number; expense: number }> = {};
    filteredInvoices.forEach(inv => {
      const k = getMonthKey(inv.date);
      if (!k) return;
      if (!map[k]) map[k] = { revenue: 0, expense: 0 };
      map[k].revenue += inv.totalAmount || 0;
    });
    filteredExpenses.forEach(e => {
      const k = getMonthKey(e.date);
      if (!k) return;
      if (!map[k]) map[k] = { revenue: 0, expense: 0 };
      map[k].expense += e.price || 0;
    });
    return Object.entries(map)
      .sort((a, b) => {
        const pa = new Date("01 " + a[0]); const pb = new Date("01 " + b[0]);
        return pa.getTime() - pb.getTime();
      })
      .map(([name, v]) => ({ name, ...v }));
  }, [filteredInvoices, filteredExpenses]);

  // ── 2. Expense breakdown by category ────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category?.trim() || "Uncategorized";
      map[cat] = (map[cat] || 0) + (e.price || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  // ── 3. Top customers by revenue ──────────────────────────────────────────────
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      const name = inv.customerName || "Unknown";
      map[name] = (map[name] || 0) + (inv.totalAmount || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  // ── 4. Service/PPF/Accessory sales breakdown ─────────────────────────────────
  const itemTypeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const type = item.type || "Other";
        map[type] = (map[type] || 0) + ((item.price || 0) * (item.quantity || 1));
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  // ── 5. Job card status summary ───────────────────────────────────────────────
  const jobCardStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredJobCards.forEach(jc => {
      const s = jc.status || "Unknown";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredJobCards]);

  // ── 6. Vendor purchase spend ─────────────────────────────────────────────────
  const vendorSpend = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPurchases.forEach(p => {
      const name = p.vendorName || "Unknown";
      map[name] = (map[name] || 0) + getPurchaseCost(p);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [filteredPurchases]);

  // ── 7. Invoice payment status ────────────────────────────────────────────────
  const paymentStatus = useMemo(() => {
    let paid = 0, partial = 0, unpaid = 0;
    filteredInvoices.forEach(inv => {
      const paidAmt = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      if (paidAmt >= (inv.totalAmount || 0)) paid++;
      else if (paidAmt > 0) partial++;
      else unpaid++;
    });
    return [
      { name: "Fully Paid", value: paid },
      { name: "Partial", value: partial },
      { name: "Unpaid", value: unpaid },
    ].filter(x => x.value > 0);
  }, [filteredInvoices]);

  // ── 8. Technician performance (revenue from invoice items with technician) ───
  const techPerformance = useMemo(() => {
    const map: Record<string, { revenue: number; jobs: number }> = {};
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        if (item.technician) {
          if (!map[item.technician]) map[item.technician] = { revenue: 0, jobs: 0 };
          map[item.technician].revenue += (item.price || 0) * (item.quantity || 1);
          map[item.technician].jobs += 1;
        }
      });
    });
    // Also count from job cards
    filteredJobCards.forEach(jc => {
      const tech = jc.technician;
      if (tech) {
        if (!map[tech]) map[tech] = { revenue: 0, jobs: 0 };
        map[tech].jobs += 1;
      }
    });
    return Object.entries(map)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, v]) => ({ name, revenue: v.revenue, jobs: v.jobs }));
  }, [filteredInvoices, filteredJobCards]);

  const PERIOD_LABELS: Record<Period, string> = { "3m": "3 Months", "6m": "6 Months", "12m": "12 Months", "all": "All Time" };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground text-sm">Loading analytics...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" />
              Analytics
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Business insights across all modules</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            {(["3m","6m","12m","all"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === p
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total Revenue</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{fmtINRShort(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{filteredInvoices.length} invoices</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total Expenses</span>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{fmtINRShort(totalExpense)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{filteredExpenses.length} entries</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Net Profit</span>
                <IndianRupee className="h-4 w-4 text-emerald-600" />
              </div>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {fmtINRShort(Math.abs(netProfit))}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{netProfit >= 0 ? "Surplus" : "Deficit"}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Pending Balance</span>
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600">{fmtINRShort(totalBalance)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Unpaid amount</div>
            </CardContent>
          </Card>
        </div>

        {/* 1. Revenue & Expense over time */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Revenue vs Expenses — Monthly
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByMonth.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No data for selected period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByMonth} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtINRShort} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#e11d48" radius={[3,3,0,0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Row: Job Card Status + Invoice Payment Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 5. Job Card Status */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Job Card Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobCardStatus.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No job cards in this period</div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={jobCardStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                        {jobCardStatus.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {jobCardStatus.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-sm text-slate-700">{s.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{s.value}</Badge>
                      </div>
                    ))}
                    <div className="pt-1 border-t text-xs text-muted-foreground">
                      Total: {jobCardStatus.reduce((s, x) => s + x.value, 0)} job cards
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7. Invoice Payment Status */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Invoice Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentStatus.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No invoices in this period</div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={paymentStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                        {paymentStatus.map((entry) => {
                          const c = entry.name === "Fully Paid" ? "#10b981" : entry.name === "Partial" ? "#f59e0b" : "#e11d48";
                          return <Cell key={entry.name} fill={c} />;
                        })}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {paymentStatus.map((s) => {
                      const c = s.name === "Fully Paid" ? "#10b981" : s.name === "Partial" ? "#f59e0b" : "#e11d48";
                      const pct = Math.round((s.value / filteredInvoices.length) * 100);
                      return (
                        <div key={s.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                            <span className="text-sm text-slate-700">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">{s.value}</Badge>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-1 border-t text-xs text-muted-foreground">
                      Total: {filteredInvoices.length} invoices
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4. Service/PPF/Accessory Breakdown */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Sales by Item Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {itemTypeBreakdown.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No invoice items in this period</div>
            ) : (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="40%" height={220}>
                  <PieChart>
                    <Pie data={itemTypeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                      {itemTypeBreakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {itemTypeBreakdown.map((item, i) => {
                    const total = itemTypeBreakdown.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-slate-700">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{fmtINR(item.value)}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{pct}%</Badge>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Expense by Category */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Expense Breakdown by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No expenses in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={expenseByCategory} layout="vertical" margin={{ top: 4, right: 60, left: 16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtINRShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Amount" radius={[0,3,3,0]}>
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3. Top Customers */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Top Customers by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No customer data in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCustomers} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tickFormatter={fmtINRShort} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Revenue" radius={[3,3,0,0]}>
                    {topCustomers.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Row: Vendor Spend + Technician Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 6. Vendor Spend */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Vendor Purchase Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vendorSpend.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No purchases in this period</div>
              ) : (
                <div className="space-y-3">
                  {vendorSpend.map((v, i) => {
                    const max = vendorSpend[0].value;
                    const pct = max > 0 ? Math.round((v.value / max) * 100) : 0;
                    return (
                      <div key={v.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700 truncate max-w-[160px]">{v.name}</span>
                          <span className="text-muted-foreground flex-shrink-0">{fmtINR(v.value)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
                    <span>{filteredPurchases.length} purchases</span>
                    <span>Total: {fmtINR(vendorSpend.reduce((s, v) => s + v.value, 0))}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 8. Technician Performance */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Technician Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {techPerformance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>No technician data found.</p>
                  <p className="text-xs mt-1">Assign technicians to job items to see performance.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {techPerformance.map((t, i) => {
                    const max = techPerformance[0].revenue;
                    const pct = max > 0 ? Math.round((t.revenue / max) * 100) : 0;
                    return (
                      <div key={t.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                              style={{ background: COLORS[i % COLORS.length] }}>
                              {t.name[0]?.toUpperCase()}
                            </span>
                            <span className="font-medium text-slate-700">{t.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <span>{fmtINR(t.revenue)}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{t.jobs} jobs</Badge>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
