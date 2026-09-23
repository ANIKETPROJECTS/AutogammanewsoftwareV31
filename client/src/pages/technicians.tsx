import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Wrench, Phone as PhoneIcon, Edit2, Trash2,
  ChevronLeft, ChevronRight, IndianRupee, CalendarX, TrendingUp,
  ArrowLeft, CheckCircle2, Clock, AlertCircle, ArrowUpRight, X,
  Users, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Technician, TechnicianSalaryRecord, TechnicianAbsence, TechnicianIncrement } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 8;

function formatCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function StatusBadge({ status }: { status: "paid"|"partial"|"unpaid" }) {
  if (status === "paid") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3"/>Paid</span>;
  if (status === "partial") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><Clock className="h-3 w-3"/>Partial</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertCircle className="h-3 w-3"/>Unpaid</span>;
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
      <p className="text-xs text-muted-foreground">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="text-xs text-muted-foreground px-1">…</span>
            ) : (
              <Button key={p} variant={page === p ? "default" : "outline"} size="sm"
                className={`h-7 w-7 p-0 text-xs ${page === p ? "bg-primary text-white" : ""}`}
                onClick={() => onChange(p as number)}>
                {p}
              </Button>
            )
          )}
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────────
export default function TechniciansPage() {
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name"|"specialty"|"salary">("name");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: technicians = [], isLoading } = useQuery<Technician[]>({ queryKey: [api.technicians.list.path] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/technicians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.technicians.list.path] });
      toast({ title: "Technician deleted" });
    },
  });

  const handleEditClose = () => {
    setEditingTechnician(null);
    queryClient.invalidateQueries({ queryKey: [api.technicians.list.path] });
  };

  const handleSort = (col: "name"|"specialty"|"salary") => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return technicians
      .filter(t =>
        (t.name.toLowerCase().includes(q) || t.specialty.toLowerCase().includes(q) || (t.phone ?? "").includes(q))
        && (statusFilter === "all" || t.status === statusFilter)
      )
      .sort((a, b) => {
        let v = 0;
        if (sortBy === "specialty") v = a.specialty.localeCompare(b.specialty);
        else if (sortBy === "salary") v = (a.monthlySalary ?? 0) - (b.monthlySalary ?? 0);
        else v = a.name.localeCompare(b.name);
        return sortDir === "asc" ? v : -v;
      });
  }, [technicians, searchQuery, statusFilter, sortBy, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = technicians.filter(t => t.status === "active").length;

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronDown className="h-3 w-3 text-muted-foreground/40 ml-1" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary ml-1" />
      : <ChevronDown className="h-3 w-3 text-primary ml-1" />;
  };

  if (selectedTechnician) {
    const latest = technicians.find(t => t.id === selectedTechnician.id) ?? selectedTechnician;
    return (
      <Layout>
        <TechnicianDetail
          technician={latest}
          onBack={() => setSelectedTechnician(null)}
          onEdit={() => setEditingTechnician(latest)}
        />
        <Dialog open={!!editingTechnician} onOpenChange={(open) => !open && handleEditClose()}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Technician</DialogTitle></DialogHeader>
            {editingTechnician && <TechnicianForm onClose={handleEditClose} initialData={editingTechnician} />}
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Technicians</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {technicians.length} total · {activeCount} active
            </p>
          </div>
          <Button data-testid="button-add-technician" onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />Add Technician
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input data-testid="input-search"
              placeholder="Search by name, specialty or phone..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {searchQuery && (
            <Button variant="ghost" size="sm" className="text-muted-foreground h-9"
              onClick={() => { setSearchQuery(""); setPage(1); }}>
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden bg-background shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-muted/30 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <button className="col-span-3 flex items-center text-left hover:text-foreground transition-colors"
              onClick={() => handleSort("name")}>
              Name <SortIcon col="name" />
            </button>
            <button className="col-span-3 flex items-center text-left hover:text-foreground transition-colors"
              onClick={() => handleSort("specialty")}>
              Specialty <SortIcon col="specialty" />
            </button>
            <span className="col-span-2">Phone</span>
            <span className="col-span-2">Joined</span>
            <button className="col-span-1 flex items-center text-left hover:text-foreground transition-colors"
              onClick={() => handleSort("salary")}>
              Salary <SortIcon col="salary" />
            </button>
            <span className="col-span-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading technicians…</span>
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Wrench className="h-10 w-10 opacity-25" />
              <p className="text-base font-medium">No technicians found</p>
              {searchQuery && <p className="text-sm">Try a different search term</p>}
            </div>
          ) : (
            paginated.map((tech, i) => (
              <div key={tech.id}
                data-testid={`row-technician-${tech.id}`}
                className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center text-sm cursor-pointer
                  hover:bg-muted/30 transition-colors group
                  ${i < paginated.length - 1 ? "border-b border-border/40" : ""}`}
                onClick={() => setSelectedTechnician(tech)}>

                {/* Name + status */}
                <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{tech.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{tech.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      tech.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {tech.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Specialty */}
                <div className="col-span-3">
                  <span className="text-muted-foreground truncate block">{tech.specialty}</span>
                </div>

                {/* Phone */}
                <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                  {tech.phone ? (
                    <>
                      <PhoneIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="text-xs">{tech.phone}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Joined */}
                <div className="col-span-2 text-xs text-muted-foreground">
                  {tech.joiningDate || <span className="text-muted-foreground/40">—</span>}
                </div>

                {/* Salary */}
                <div className="col-span-1 font-semibold text-foreground text-sm">
                  {(tech.monthlySalary ?? 0) > 0
                    ? <span className="text-xs">{formatCurrency(tech.monthlySalary ?? 0)}<span className="text-muted-foreground font-normal">/mo</span></span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end gap-0.5" onClick={e => e.stopPropagation()}>
                  <Button data-testid={`button-edit-${tech.id}`} variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditingTechnician(tech)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button data-testid={`button-delete-${tech.id}`} variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setTechnicianToDelete(tech)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>

        {/* Dialogs */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Technician</DialogTitle></DialogHeader>
            <TechnicianForm onClose={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
        <Dialog open={!!editingTechnician} onOpenChange={open => !open && setEditingTechnician(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Technician</DialogTitle></DialogHeader>
            {editingTechnician && <TechnicianForm onClose={() => setEditingTechnician(null)} initialData={editingTechnician} />}
          </DialogContent>
        </Dialog>
        <ConfirmActionDialog
          open={!!technicianToDelete}
          onOpenChange={(open) => !open && setTechnicianToDelete(null)}
          title="Delete technician?"
          description="Are you sure you want to delete this technician?"
          onConfirm={() => {
            if (technicianToDelete?.id) {
              deleteMutation.mutate(technicianToDelete.id);
              setTechnicianToDelete(null);
            }
          }}
          isPending={deleteMutation.isPending}
        />
      </div>
    </Layout>
  );
}

// ─── TECHNICIAN FORM ─────────────────────────────────────────────────────────
function TechnicianForm({ onClose, initialData }: { onClose: () => void; initialData?: Technician }) {
  const { toast } = useToast();
  const [name, setName] = useState(initialData?.name ?? "");
  const [specialty, setSpecialty] = useState(initialData?.specialty ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [status, setStatus] = useState<"active"|"inactive">(initialData?.status ?? "active");
  const [monthlySalary, setMonthlySalary] = useState(initialData?.monthlySalary?.toString() ?? "");
  const [joiningDate, setJoiningDate] = useState(initialData?.joiningDate ?? "");
  const [phoneError, setPhoneError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => initialData?.id
      ? apiRequest("PATCH", `/api/technicians/${initialData.id}`, data)
      : apiRequest("POST", api.technicians.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.technicians.list.path] });
      toast({ title: initialData ? "Technician updated" : "Technician added" });
      onClose();
    },
    onError: () => toast({ title: "Error saving technician", variant: "destructive" }),
  });

  const validatePhone = (v: string) => {
    if (!v) { setPhoneError(""); return true; }
    if (!/^\d+$/.test(v)) { setPhoneError("Digits only"); return false; }
    if (v.length !== 10) { setPhoneError("Must be 10 digits"); return false; }
    setPhoneError(""); return true;
  };

  const handleSubmit = () => {
    if (!name.trim() || !specialty.trim()) {
      toast({ title: "Name and Specialty are required", variant: "destructive" }); return;
    }
    if (phone && !validatePhone(phone)) return;
    mutation.mutate({ name, specialty, phone: phone || undefined, status,
      monthlySalary: monthlySalary ? parseFloat(monthlySalary) : 0, joiningDate: joiningDate || "" });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Name <span className="text-destructive">*</span></Label>
        <Input data-testid="input-name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Specialty <span className="text-destructive">*</span></Label>
        <Input data-testid="input-specialty" placeholder="e.g. Applicator, Detailer, Mechanic" value={specialty} onChange={e => setSpecialty(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input data-testid="input-phone" placeholder="9876543210" value={phone} maxLength={10}
            onChange={e => { const v = e.target.value.replace(/\D/g,""); setPhone(v); validatePhone(v); }}
            className={phoneError ? "border-destructive" : ""} />
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Monthly Salary (₹)</Label>
          <Input data-testid="input-salary" type="number" placeholder="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Joining Date</Label>
        <Input data-testid="input-joining-date" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
      </div>
      <div className="flex items-center justify-between py-1 border-t border-border/40 pt-3">
        <Label>Status</Label>
        <div className="flex items-center gap-2.5">
          <span className={`text-sm ${status === "inactive" ? "text-muted-foreground" : "text-muted-foreground/40"}`}>Inactive</span>
          <Switch checked={status === "active"} onCheckedChange={c => setStatus(c ? "active" : "inactive")} />
          <span className={`text-sm ${status === "active" ? "text-green-600 font-medium" : "text-muted-foreground/40"}`}>Active</span>
        </div>
      </div>
      <Button data-testid="button-save" onClick={handleSubmit} disabled={mutation.isPending} className="w-full bg-primary hover:bg-primary/90">
        {mutation.isPending ? "Saving..." : (initialData ? "Update Technician" : "Add Technician")}
      </Button>
    </div>
  );
}

// ─── TECHNICIAN DETAIL (full page) ───────────────────────────────────────────
function TechnicianDetail({ technician, onBack, onEdit }: {
  technician: Technician; onBack: () => void; onEdit: () => void;
}) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { data: salaryRecords = [] } = useQuery<TechnicianSalaryRecord[]>({
    queryKey: [`/api/technicians/${technician.id}/salary-records`],
  });
  const { data: absences = [] } = useQuery<TechnicianAbsence[]>({
    queryKey: [`/api/technicians/${technician.id}/absences`],
  });
  const { data: increments = [] } = useQuery<TechnicianIncrement[]>({
    queryKey: [`/api/technicians/${technician.id}/increments`],
  });

  const goToPrevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear();

  const monthRecord = salaryRecords.find(r => r.month === viewMonth && r.year === viewYear) ?? null;
  const monthAbsences = absences.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() + 1 === viewMonth && d.getFullYear() === viewYear;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />Back to Technicians
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-lg font-bold text-primary">{technician.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{technician.name}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{technician.specialty}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  technician.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>{technician.status === "active" ? "Active" : "Inactive"}</span>
                {technician.phone && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <PhoneIcon className="h-3.5 w-3.5" />{technician.phone}
                  </span>
                )}
                {technician.joiningDate && (
                  <span className="text-sm text-muted-foreground">Joined: {technician.joiningDate}</span>
                )}
                <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <IndianRupee className="h-3.5 w-3.5" />{formatCurrency(technician.monthlySalary ?? 0)}/month
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />Edit Details
          </Button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-4 border border-border/60 rounded-xl px-5 py-3 bg-muted/20">
        <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-bold text-lg text-foreground">{MONTHS[viewMonth - 1]} {viewYear}</p>
          {isCurrentMonth && <p className="text-xs text-primary font-medium">Current Month</p>}
        </div>
        <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Monthly Salary + Absences side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MonthlySalaryCard technician={technician} record={monthRecord} month={viewMonth} year={viewYear} />
        <MonthlyAbsencesCard technician={technician} absences={monthAbsences} month={viewMonth} year={viewYear} />
      </div>

      {/* Salary History */}
      <SalaryHistorySection technician={technician} records={salaryRecords} />

      {/* Increment History */}
      <IncrementHistorySection technician={technician} increments={increments} />
    </div>
  );
}

// ─── MONTHLY SALARY CARD ─────────────────────────────────────────────────────
function MonthlySalaryCard({ technician, record, month, year }: {
  technician: Technician; record: TechnicianSalaryRecord | null; month: number; year: number;
}) {
  const { toast } = useToast();
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("Cash");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/technicians/${technician.id}/salary-records`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/salary-records`] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/technicians/${technician.id}/salary-records/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/salary-records`] });
      toast({ title: "Payment recorded" });
      setShowPayForm(false); setPayAmount("");
    },
  });

  const handleCreateRecord = () => {
    const salary = technician.monthlySalary ?? 0;
    createMutation.mutate({ month, year, baseSalary: salary, salaryDue: salary, payments: [] });
  };

  const handlePayment = () => {
    if (!record) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    const newPayments = [...(record.payments || []), { amount: amt, date: payDate, method: payMethod, notes: "" }];
    updateMutation.mutate({ id: record.id!, data: { payments: newPayments, salaryDue: record.salaryDue } });
  };

  const balance = record ? Math.max(0, record.salaryDue - record.paidAmount) : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Salary — {MONTHS_SHORT[month-1]} {year}</span>
        </div>
        {record && <StatusBadge status={record.paymentStatus} />}
      </div>

      <div className="p-4 space-y-3">
        {!record ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">No salary record for this month</p>
            <Button data-testid="button-create-record" size="sm" variant="outline"
              onClick={handleCreateRecord} disabled={createMutation.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {createMutation.isPending ? "Creating..." : `Create Record (${formatCurrency(technician.monthlySalary ?? 0)})`}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Salary Due</p>
                <p className="font-bold text-foreground">{formatCurrency(record.salaryDue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Paid</p>
                <p className="font-bold text-emerald-600">{formatCurrency(record.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Balance</p>
                <p className={`font-bold ${balance > 0 ? "text-red-500" : "text-foreground"}`}>{formatCurrency(balance)}</p>
              </div>
            </div>

            {(record.payments || []).length > 0 && (
              <div className="rounded-lg bg-muted/30 border border-border/40 divide-y divide-border/30">
                {record.payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{p.date} · {p.method}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {record.paymentStatus !== "paid" && (
              <>
                {!showPayForm ? (
                  <Button data-testid="button-record-payment" size="sm" variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary hover:text-white"
                    onClick={() => setShowPayForm(true)}>
                    Record Payment
                  </Button>
                ) : (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-primary">Record Payment · Balance: {formatCurrency(balance)}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount (₹)</Label>
                        <Input data-testid="input-pay-amount" className="h-8 text-sm" type="number" placeholder="0"
                          value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</Label>
                        <Input data-testid="input-pay-date" className="h-8 text-sm" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Method</Label>
                        <Select value={payMethod} onValueChange={setPayMethod}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Cash","UPI","Bank Transfer","Cheque"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button data-testid="button-confirm-payment" size="sm" className="bg-primary hover:bg-primary/90 flex-1"
                        onClick={handlePayment} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? "Saving..." : "Confirm"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowPayForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MONTHLY ABSENCES CARD ───────────────────────────────────────────────────
function MonthlyAbsencesCard({ technician, absences, month, year }: {
  technician: Technician; absences: TechnicianAbsence[]; month: number; year: number;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.getMonth() + 1 === month && now.getFullYear() === year
      ? now.toISOString().split("T")[0]
      : `${year}-${String(month).padStart(2,"0")}-01`;
  });
  const [reason, setReason] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/technicians/${technician.id}/absences`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/absences`] });
      toast({ title: "Absence marked" });
      setShowForm(false); setReason("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/technicians/${technician.id}/absences/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/absences`] }),
  });

  return (
    <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2">
          <CalendarX className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Absences — {MONTHS_SHORT[month-1]} {year}</span>
        </div>
        {absences.length > 0 && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {absences.length} day{absences.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-4 space-y-2">
        {absences.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-3">No absences this month</p>
        )}

        {absences.map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 bg-background">
            <div>
              <p className="text-sm font-medium text-foreground">
                {new Date(a.date).toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" })}
              </p>
              {a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
              onClick={() => deleteMutation.mutate(a.id!)}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}

        {showForm && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Date</Label>
                <Input data-testid="input-absence-date" className="h-8 text-sm" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason (optional)</Label>
                <Input data-testid="input-absence-reason" className="h-8 text-sm" placeholder="Sick, Personal..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button data-testid="button-confirm-absence" size="sm" className="bg-primary hover:bg-primary/90"
                onClick={() => createMutation.mutate({ date, reason })} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Mark Absent"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {!showForm && (
          <Button data-testid="button-mark-absent" size="sm" variant="outline" className="w-full mt-1"
            onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Mark Absent
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── SALARY HISTORY ──────────────────────────────────────────────────────────
function SalaryHistorySection({ technician, records }: { technician: Technician; records: TechnicianSalaryRecord[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [recordToDelete, setRecordToDelete] = useState<TechnicianSalaryRecord | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/technicians/${technician.id}/salary-records/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/salary-records`] }),
  });

  const sorted = [...records].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  const filtered = search
    ? sorted.filter(r => `${MONTHS[r.month - 1]} ${r.year}`.toLowerCase().includes(search.toLowerCase()))
    : sorted;
  const paginated = filtered.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Salary History — All Months</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{records.length} record{records.length !== 1 ? "s" : ""}</span>
        </div>
        {records.length > 0 && (
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-8 pl-8 text-sm" placeholder="Filter by month…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-border/60 px-4 py-8 text-center text-muted-foreground text-sm">
          No salary records yet. Navigate to a month and create the first record.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 px-4 py-6 text-center text-muted-foreground text-sm">
          No records match "{search}"
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-background shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-muted/30 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="col-span-3">Month</span>
            <span className="col-span-3">Last Payment</span>
            <span className="col-span-2">Salary Due</span>
            <span className="col-span-2">Paid</span>
            <span className="col-span-2">Status</span>
          </div>

          {paginated.map((r, i) => {
            const balance = Math.max(0, r.salaryDue - r.paidAmount);
            const lastPayment = (r.payments || []).slice(-1)[0];
            return (
              <div key={r.id}
                className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center text-sm group
                  ${i < paginated.length - 1 ? "border-b border-border/40" : ""}`}>
                <div className="col-span-3">
                  <span className="font-semibold text-foreground">{MONTHS[r.month - 1]} {r.year}</span>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground">
                  {lastPayment
                    ? <>{lastPayment.date} · {lastPayment.method}</>
                    : <span className="text-muted-foreground/40">—</span>}
                </div>
                <div className="col-span-2 font-medium text-foreground">{formatCurrency(r.salaryDue)}</div>
                <div className="col-span-2">
                  <span className="text-emerald-600 font-medium">{formatCurrency(r.paidAmount)}</span>
                  {balance > 0 && <p className="text-[10px] text-red-500 mt-0.5">-{formatCurrency(balance)} bal.</p>}
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <StatusBadge status={r.paymentStatus} />
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    onClick={() => setRecordToDelete(r)}>
                    <X className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Pagination page={page} total={filtered.length} pageSize={HISTORY_PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      <ConfirmActionDialog
        open={!!recordToDelete}
        onOpenChange={(open) => !open && setRecordToDelete(null)}
        title="Delete salary record?"
        description="Are you sure you want to delete this salary record?"
        onConfirm={() => {
          if (recordToDelete?.id) {
            deleteMutation.mutate(recordToDelete.id);
            setRecordToDelete(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── INCREMENT HISTORY ───────────────────────────────────────────────────────
function IncrementHistorySection({ technician, increments }: { technician: Technician; increments: TechnicianIncrement[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [newSalary, setNewSalary] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(1);
  const [incrementToDelete, setIncrementToDelete] = useState<TechnicianIncrement | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/technicians/${technician.id}/increments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/increments`] });
      queryClient.invalidateQueries({ queryKey: [api.technicians.list.path] });
      toast({ title: "Increment recorded" });
      setShowForm(false); setNewSalary(""); setNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/technicians/${technician.id}/increments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technician.id}/increments`] }),
  });

  const handleCreate = () => {
    const ns = parseFloat(newSalary);
    if (!ns || ns <= 0) { toast({ title: "Enter a valid salary", variant: "destructive" }); return; }
    createMutation.mutate({ previousSalary: technician.monthlySalary ?? 0, newSalary: ns, effectiveDate, notes });
  };

  const sorted = [...increments].sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  const paginated = sorted.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Salary Increment History</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{increments.length}</span>
        </div>
        <Button data-testid="button-add-increment" size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1" />{showForm ? "Cancel" : "Record Increment"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Current Monthly Salary:</span>
            <span className="font-bold text-foreground">{formatCurrency(technician.monthlySalary ?? 0)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>New Salary (₹)</Label>
              <Input data-testid="input-new-salary" type="number" className="h-9" placeholder="0"
                value={newSalary} onChange={e => setNewSalary(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Effective From Date</Label>
              <Input data-testid="input-effective-date" type="date" className="h-9"
                value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input className="h-9" placeholder="e.g. Annual increment, Performance bonus..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <Button data-testid="button-confirm-increment" size="sm" className="bg-primary hover:bg-primary/90"
            onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Record Increment"}
          </Button>
        </div>
      )}

      {increments.length === 0 ? (
        <div className="rounded-xl border border-border/60 px-4 py-8 text-center text-muted-foreground text-sm">
          No increments recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-background shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-muted/30 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="col-span-1"></span>
            <span className="col-span-3">Salary Change</span>
            <span className="col-span-2">Increase</span>
            <span className="col-span-3">Effective Date</span>
            <span className="col-span-3">Notes</span>
          </div>

          {paginated.map((inc, i) => {
            const diff = inc.newSalary - inc.previousSalary;
            const pct = inc.previousSalary > 0 ? ((diff / inc.previousSalary) * 100).toFixed(1) : "—";
            return (
              <div key={inc.id}
                className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center text-sm group
                  ${i < paginated.length - 1 ? "border-b border-border/40" : ""}`}>
                <div className="col-span-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-xs">{formatCurrency(inc.previousSalary)}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="font-bold text-foreground text-xs">{formatCurrency(inc.newSalary)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">+{pct}%</span>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground">{inc.effectiveDate}</div>
                <div className="col-span-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{inc.notes || <span className="text-muted-foreground/40">—</span>}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={() => setIncrementToDelete(inc)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}

          <Pagination page={page} total={sorted.length} pageSize={HISTORY_PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      <ConfirmActionDialog
        open={!!incrementToDelete}
        onOpenChange={(open) => !open && setIncrementToDelete(null)}
        title="Delete increment record?"
        description="Are you sure you want to delete this increment record?"
        onConfirm={() => {
          if (incrementToDelete?.id) {
            deleteMutation.mutate(incrementToDelete.id);
            setIncrementToDelete(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
