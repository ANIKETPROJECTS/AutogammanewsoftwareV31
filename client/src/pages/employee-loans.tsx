import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { EmployeeLoan, Technician } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, IndianRupee, Plus, Trash2, Wallet } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const today = () => new Date().toISOString().split("T")[0];
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function StatusBadge({ status }: { status: EmployeeLoan["status"] }) {
  if (status === "paid") {
    return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge>;
  }
  if (status === "overdue") {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><AlertCircle className="mr-1 h-3 w-3" />Overdue</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="mr-1 h-3 w-3" />Active</Badge>;
}

export default function EmployeeLoansPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<EmployeeLoan | null>(null);
  const [deleteLoan, setDeleteLoan] = useState<EmployeeLoan | null>(null);

  const { data: loans = [], isLoading } = useQuery<EmployeeLoan[]>({
    queryKey: [api.employeeLoans.list.path],
  });
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: [api.technicians.list.path],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [api.employeeLoans.list.path] });
  const createLoan = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", api.employeeLoans.create.path, data),
    onSuccess: () => {
      invalidate();
      setIsCreateOpen(false);
      toast({ title: "Loan created", description: "The repayment balance is now being tracked." });
    },
    onError: (error: Error) => toast({ title: "Could not create loan", description: error.message, variant: "destructive" }),
  });
  const addRepayment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      apiRequest("POST", `/api/employee-loans/${id}/repayments`, data),
    onSuccess: () => {
      invalidate();
      setRepaymentLoan(null);
      toast({ title: "Repayment recorded" });
    },
    onError: (error: Error) => toast({ title: "Could not record repayment", description: error.message, variant: "destructive" }),
  });
  const deleteLoanMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", api.employeeLoans.delete.path.replace(":id", id)),
    onSuccess: () => {
      invalidate();
      setDeleteLoan(null);
      toast({ title: "Loan deleted", description: "The loan record and its repayment history were deleted." });
    },
    onError: (error: Error) => toast({ title: "Could not delete loan", description: error.message, variant: "destructive" }),
  });

  const summary = useMemo(() => ({
    borrowed: loans.reduce((sum, loan) => sum + loan.amount, 0),
    repaid: loans.reduce((sum, loan) => sum + loan.totalRepaid, 0),
    outstanding: loans.reduce((sum, loan) => sum + loan.outstandingBalance, 0),
    active: loans.filter((loan) => loan.status !== "paid").length,
  }), [loans]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Employee Loans</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track employee loans, repayments, and outstanding balances.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Loan
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total borrowed" value={money(summary.borrowed)} icon={<Wallet className="h-5 w-5" />} />
          <SummaryCard label="Total repaid" value={money(summary.repaid)} icon={<CheckCircle2 className="h-5 w-5" />} />
          <SummaryCard label="Outstanding balance" value={money(summary.outstanding)} icon={<IndianRupee className="h-5 w-5" />} />
          <SummaryCard label="Active loans" value={summary.active.toString()} icon={<Clock className="h-5 w-5" />} />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Loan register</h2>
              <p className="text-sm text-muted-foreground">{loans.length} loan{loans.length === 1 ? "" : "s"} recorded</p>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading loans...</div>
            ) : loans.length === 0 ? (
              <div className="p-10 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium">No employee loans yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create the first loan to start tracking repayments.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Employee</th>
                      <th className="px-5 py-3 font-medium">Loan amount</th>
                      <th className="px-5 py-3 font-medium">Repaid</th>
                      <th className="px-5 py-3 font-medium">Balance</th>
                      <th className="px-5 py-3 font-medium">Monthly payment</th>
                      <th className="px-5 py-3 font-medium">Next payment</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">Action</th>
                      <th className="px-5 py-3 font-medium">Loan history</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => (
                      <tr key={loan.id} className="border-t">
                        <td className="px-5 py-4 font-medium">{loan.employeeName}</td>
                        <td className="px-5 py-4">{money(loan.amount)}</td>
                        <td className="px-5 py-4 text-emerald-700">{money(loan.totalRepaid)}</td>
                        <td className="px-5 py-4 font-semibold">{money(loan.outstandingBalance)}</td>
                        <td className="px-5 py-4">{money(loan.monthlyRepayment)}</td>
                        <td className="px-5 py-4">{loan.nextPaymentDate || "—"}</td>
                        <td className="px-5 py-4"><StatusBadge status={loan.status} /></td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {loan.status !== "paid" && (
                              <Button variant="outline" size="sm" onClick={() => setRepaymentLoan(loan)}>Record payment</Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete loan"
                              aria-label={`Delete loan for ${loan.employeeName}`}
                              onClick={() => setDeleteLoan(loan)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/employee-loans/${loan.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                              View history
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create employee loan</DialogTitle></DialogHeader>
          <LoanForm employees={technicians} onSubmit={(data) => createLoan.mutate(data)} isPending={createLoan.isPending} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!repaymentLoan} onOpenChange={(open) => !open && setRepaymentLoan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record repayment</DialogTitle>
          </DialogHeader>
          {repaymentLoan && (
            <RepaymentForm
              loan={repaymentLoan}
              onSubmit={(data) => addRepayment.mutate({ id: repaymentLoan.id!, data })}
              isPending={addRepayment.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteLoan} onOpenChange={(open) => !open && setDeleteLoan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the loan for {deleteLoan?.employeeName}, including its repayment history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoanMutation.isPending}>No, keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoanMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteLoan?.id) deleteLoanMutation.mutate(deleteLoan.id);
              }}
            >
              {deleteLoanMutation.isPending ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

export function EmployeeLoanDetailsPage() {
  const [, params] = useRoute("/employee-loans/:id");
  const { toast } = useToast();
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const { data: loans = [], isLoading } = useQuery<EmployeeLoan[]>({
    queryKey: [api.employeeLoans.list.path],
  });
  const loan = loans.find((item) => item.id === params?.id);
  const addRepayment = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", `/api/employee-loans/${loan?.id}/repayments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employeeLoans.list.path] });
      setRepaymentOpen(false);
      toast({ title: "Repayment recorded" });
    },
    onError: (error: Error) => toast({ title: "Could not record repayment", description: error.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <Layout><div className="p-8 text-center text-sm text-muted-foreground">Loading loan details...</div></Layout>;
  }
  if (!loan) {
    return (
      <Layout>
        <div className="space-y-4">
          <Link href="/employee-loans"><Button variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Back to loans</Button></Link>
          <p className="text-muted-foreground">Loan not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/employee-loans">
              <Button variant="ghost" className="-ml-3 mb-2 text-muted-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />Back to loans
              </Button>
            </Link>
            <h1 className="text-3xl font-display font-bold tracking-tight">{loan.employeeName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Loan details and complete payment history</p>
          </div>
          {loan.status !== "paid" && <Button onClick={() => setRepaymentOpen(true)}>Record payment</Button>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Loan amount" value={money(loan.amount)} icon={<Wallet className="h-5 w-5" />} />
          <SummaryCard label="Total repaid" value={money(loan.totalRepaid)} icon={<CheckCircle2 className="h-5 w-5" />} />
          <SummaryCard label="Outstanding balance" value={money(loan.outstandingBalance)} icon={<IndianRupee className="h-5 w-5" />} />
          <SummaryCard label="Monthly payment" value={money(loan.monthlyRepayment)} icon={<Clock className="h-5 w-5" />} />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div><h2 className="font-semibold">Payment history</h2><p className="text-sm text-muted-foreground">Loan started on {loan.loanDate}</p></div>
              <StatusBadge status={loan.status} />
            </div>
            {loan.repayments.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No repayments recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-3 font-medium">Payment date</th><th className="px-5 py-3 font-medium">Amount paid</th><th className="px-5 py-3 font-medium">Notes</th></tr>
                  </thead>
                  <tbody>
                    {[...loan.repayments].sort((a, b) => b.date.localeCompare(a.date)).map((repayment) => (
                      <tr key={repayment.id} className="border-t">
                        <td className="px-5 py-4 font-medium">{repayment.date}</td>
                        <td className="px-5 py-4 font-semibold text-emerald-700">{money(repayment.amount)}</td>
                        <td className="px-5 py-4 text-muted-foreground">{repayment.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-3">
            <div><p className="text-muted-foreground">Loan date</p><p className="mt-1 font-medium">{loan.loanDate}</p></div>
            <div><p className="text-muted-foreground">First repayment</p><p className="mt-1 font-medium">{loan.firstRepaymentDate}</p></div>
            <div><p className="text-muted-foreground">Next payment</p><p className="mt-1 font-medium">{loan.nextPaymentDate || "Completed"}</p></div>
            {loan.notes && <div className="sm:col-span-3"><p className="text-muted-foreground">Notes</p><p className="mt-1 font-medium">{loan.notes}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record repayment</DialogTitle></DialogHeader>
          <RepaymentForm
            loan={loan}
            onSubmit={(data) => addRepayment.mutate(data)}
            isPending={addRepayment.isPending}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function LoanForm({ employees, onSubmit, isPending }: { employees: Technician[]; onSubmit: (data: unknown) => void; isPending: boolean }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [monthlyRepayment, setMonthlyRepayment] = useState("");
  const [loanDate, setLoanDate] = useState(today());
  const [firstRepaymentDate, setFirstRepaymentDate] = useState(today());
  const [notes, setNotes] = useState("");

  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      onSubmit({ employeeId, amount: Number(amount), monthlyRepayment: Number(monthlyRepayment), loanDate, firstRepaymentDate, notes });
    }}>
      <div className="space-y-2"><Label>Employee</Label><select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select employee</option>{employees.filter((employee) => employee.status === "active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Loan amount</Label><Input required min="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50000" /></div>
        <div className="space-y-2"><Label>Monthly repayment</Label><Input required min="1" type="number" value={monthlyRepayment} onChange={(event) => setMonthlyRepayment(event.target.value)} placeholder="5000" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Loan date</Label><Input required type="date" value={loanDate} onChange={(event) => setLoanDate(event.target.value)} /></div>
        <div className="space-y-2"><Label>First repayment</Label><Input required type="date" value={firstRepaymentDate} onChange={(event) => setFirstRepaymentDate(event.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add a short note..." /></div>
      <Button className="w-full" disabled={isPending || !employeeId}>{isPending ? "Saving..." : "Create loan"}</Button>
    </form>
  );
}

function RepaymentForm({ loan, onSubmit, isPending }: { loan: EmployeeLoan; onSubmit: (data: unknown) => void; isPending: boolean }) {
  const [amount, setAmount] = useState(String(Math.min(loan.monthlyRepayment, loan.outstandingBalance)));
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      onSubmit({ amount: Number(amount), date, notes });
    }}>
      <div className="rounded-lg bg-muted/40 p-3 text-sm"><div className="flex justify-between"><span>{loan.employeeName}</span><span className="font-semibold">{money(loan.outstandingBalance)} remaining</span></div></div>
      <div className="space-y-2"><Label>Amount paid</Label><Input required min="1" max={loan.outstandingBalance} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
      <div className="space-y-2"><Label>Payment date</Label><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="space-y-2"><Label>Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cash, bank transfer, etc." /></div>
      <Button className="w-full" disabled={isPending}>{isPending ? "Saving..." : "Record repayment"}</Button>
    </form>
  );
}