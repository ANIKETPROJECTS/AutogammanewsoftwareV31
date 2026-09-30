import { Layout } from "@/components/layout/layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WarrantyFollowUp } from "@shared/schema";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Shield,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  CalendarIcon,
  ChevronRight,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { format, parseISO, addDays, addMonths, differenceInCalendarDays, differenceInDays } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WarrantyItem {
  invoiceId: string;
  itemId: string;
  invoiceNo: string;
  business: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  licensePlate: string;
  invoiceDate: string;
  itemName: string;
  itemType: "Service" | "PPF";
  warrantyPeriod: string;
}

type InspectionReminderStatus = "planned" | "due" | "past-due" | "missing-date" | "invalid-phone";

type PpfMessageStatus =
  | "awaiting_opt_in"
  | "scheduled"
  | "manual_required"
  | "sending"
  | "sent"
  | "failed"
  | "unknown"
  | "invalid_phone"
  | "missing_date";

interface PpfInspectionReminderRecord {
  id: string;
  invoiceId: string;
  itemId: string;
  dueDate: string;
  optInConfirmed: boolean;
  optInConfirmedAt: string;
  status: PpfMessageStatus;
  messageId: string;
  failureReason: string;
  sentAt: string;
}

interface InspectionReminder {
  dueDate?: Date;
  daysUntil?: number;
  status: InspectionReminderStatus;
}

type Urgency = "overdue" | "soon" | "upcoming" | "future" | "done";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; }
}

function getPpfInspectionReminder(item: WarrantyItem): InspectionReminder | null {
  if (item.itemType !== "PPF") return null;

  if (!item.invoiceDate) return { status: "missing-date" };
  const serviceDate = parseISO(item.invoiceDate);
  if (Number.isNaN(serviceDate.getTime())) return { status: "missing-date" };

  const dueDate = addDays(serviceDate, 5);
  const phoneDigits = String(item.customerPhone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { dueDate, status: "invalid-phone" };
  }

  const daysUntil = differenceInCalendarDays(dueDate, new Date());
  return {
    dueDate,
    daysUntil,
    status: daysUntil > 0 ? "planned" : daysUntil === 0 ? "due" : "past-due",
  };
}

function warrantyToMonths(period: string): number {
  const lower = period.toLowerCase();
  const num = parseInt(lower.match(/(\d+)/)?.[1] || "12");
  if (lower.includes("year")) return num * 12;
  if (lower.includes("month")) return num;
  return 12;
}

function getCheckupWindow(serviceDate: string, warrantyPeriod: string) {
  try {
    const months = warrantyToMonths(warrantyPeriod);
    const start = parseISO(serviceDate);
    return {
      windowStart: addMonths(start, Math.floor(months * 0.65)),
      windowEnd: addMonths(start, Math.floor(months * 0.95)),
      expiryDate: addMonths(start, months),
    };
  } catch { return null; }
}

function getUrgency(serviceDate: string, warrantyPeriod: string, followUp?: WarrantyFollowUp): Urgency {
  const bothDone = followUp?.checkupStatus === "done" &&
    (followUp?.topupStatus === "done" || followUp?.topupStatus === "not_applicable");
  if (bothDone) return "done";
  const win = getCheckupWindow(serviceDate, warrantyPeriod);
  if (!win) return "upcoming";
  const today = new Date();
  const daysToStart = differenceInDays(win.windowStart, today);
  const daysToEnd = differenceInDays(win.windowEnd, today);
  if (daysToEnd < 0) return "overdue";
  if (daysToStart <= 0) return "soon";
  if (daysToStart <= 30) return "upcoming";
  return "future";
}

const URGENCY_CFG: Record<Urgency, { label: string; badge: string; icon: any; iconColor: string }> = {
  overdue: { label: "Overdue", badge: "bg-red-100 text-red-700 border-red-200", icon: AlertCircle, iconColor: "text-red-500" },
  soon:    { label: "Due Now", badge: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock, iconColor: "text-orange-500" },
  upcoming:{ label: "Coming Soon", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock, iconColor: "text-yellow-600" },
  future:  { label: "Future", badge: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock, iconColor: "text-slate-400" },
  done:    { label: "Completed", badge: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, iconColor: "text-green-500" },
};

const URGENCY_ORDER: Record<Urgency, number> = { overdue: 0, soon: 1, upcoming: 2, future: 3, done: 4 };

// ─── Date Picker ─────────────────────────────────────────────────────────────

function DatePickerButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 w-full justify-start gap-2 text-sm font-normal">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value ? format(new Date(value + "T00:00:00"), "dd MMM yyyy") : "Pick date"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d) => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }}
          initialFocus />
      </PopoverContent>
    </Popover>
  );
}

// ─── Mark Done Dialog ────────────────────────────────────────────────────────

function MarkDoneDialog({
  item,
  followUp,
  field,
  onClose,
}: {
  item: WarrantyItem;
  followUp?: WarrantyFollowUp;
  field: "checkup" | "topup";
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [doneDate, setDoneDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [topupResult, setTopupResult] = useState<"done" | "not_applicable">("done");

  const mutation = useMutation({
    mutationFn: async (patch: any) => {
      if (followUp?.id) {
        const res = await apiRequest("PATCH", `/api/warranty-followups/${followUp.id}`, patch);
        return res.json();
      } else {
        const newRecord = {
          invoiceId: item.invoiceId,
          jobCardId: "",
          jobNo: item.invoiceNo,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          vehicleInfo: item.vehicleInfo,
          licensePlate: item.licensePlate,
          serviceName: item.itemName,
          serviceType: item.itemType,
          warrantyPeriod: item.warrantyPeriod,
          serviceDate: item.invoiceDate,
          ...patch,
        };
        const res = await apiRequest("POST", "/api/warranty-followups", newRecord);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warranty-followups"] });
      toast({ title: field === "checkup" ? "Checkup marked done ✓" : "Top-up marked done ✓" });
      onClose();
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const handleSave = () => {
    if (field === "checkup") {
      mutation.mutate({ checkupStatus: "done", checkupDate: doneDate, checkupNotes: notes });
    } else {
      mutation.mutate({ topupStatus: topupResult, topupDate: doneDate, topupNotes: notes });
    }
  };

  return (
    <div className="space-y-4 py-1">
      <div className="bg-slate-50 border rounded-md p-3 text-sm space-y-0.5">
        <p className="font-semibold text-slate-800">{item.customerName}</p>
        <p className="text-xs text-muted-foreground">{item.vehicleInfo} · {item.licensePlate}</p>
        <p className="text-xs text-primary font-medium">{item.itemName} — {item.warrantyPeriod}</p>
      </div>

      {field === "topup" && (
        <div className="space-y-1.5">
          <Label>Top-up Result</Label>
          <Select value={topupResult} onValueChange={(v) => setTopupResult(v as "done" | "not_applicable")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="done">Top-up Done ✓</SelectItem>
              <SelectItem value="not_applicable">Not Required</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{field === "checkup" ? "Checkup Date" : "Date"}</Label>
        <DatePickerButton value={doneDate} onChange={setDoneDate} />
      </div>
      <div className="space-y-1.5">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="Any observations or remarks..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit Follow-Up Dialog ────────────────────────────────────────────────────

function EditFollowUpDialog({
  item,
  followUp,
  field,
  onClose,
}: {
  item: WarrantyItem;
  followUp: WarrantyFollowUp;
  field: "checkup" | "topup";
  onClose: () => void;
}) {
  const { toast } = useToast();

  const initDate = field === "checkup" ? (followUp.checkupDate || todayStr()) : (followUp.topupDate || todayStr());
  const initNotes = field === "checkup" ? (followUp.checkupNotes || "") : (followUp.topupNotes || "");
  const initTopupResult = (followUp.topupStatus as "done" | "not_applicable") || "done";

  const [doneDate, setDoneDate] = useState(initDate);
  const [notes, setNotes] = useState(initNotes);
  const [topupResult, setTopupResult] = useState<"done" | "not_applicable">(initTopupResult);

  const mutation = useMutation({
    mutationFn: async (patch: any) => {
      const res = await apiRequest("PATCH", `/api/warranty-followups/${followUp.id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warranty-followups"] });
      toast({ title: "Updated successfully ✓" });
      onClose();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const handleSave = () => {
    if (field === "checkup") {
      mutation.mutate({ checkupStatus: "done", checkupDate: doneDate, checkupNotes: notes });
    } else {
      mutation.mutate({ topupStatus: topupResult, topupDate: doneDate, topupNotes: notes });
    }
  };

  const handleRevert = () => {
    if (field === "checkup") {
      mutation.mutate({ checkupStatus: "pending", checkupDate: null, checkupNotes: "" });
    } else {
      mutation.mutate({ topupStatus: "pending", topupDate: null, topupNotes: "" });
    }
  };

  return (
    <div className="space-y-4 py-1">
      <div className="bg-slate-50 border rounded-md p-3 text-sm space-y-0.5">
        <p className="font-semibold text-slate-800">{item.customerName}</p>
        <p className="text-xs text-muted-foreground">{item.vehicleInfo} · {item.licensePlate}</p>
        <p className="text-xs text-primary font-medium">{item.itemName} — {item.warrantyPeriod}</p>
      </div>

      {field === "topup" && (
        <div className="space-y-1.5">
          <Label>Top-up Result</Label>
          <Select value={topupResult} onValueChange={(v) => setTopupResult(v as "done" | "not_applicable")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="done">Top-up Done ✓</SelectItem>
              <SelectItem value="not_applicable">Not Required</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{field === "checkup" ? "Checkup Date" : "Date"}</Label>
        <DatePickerButton value={doneDate} onChange={setDoneDate} />
      </div>
      <div className="space-y-1.5">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="Any observations or remarks..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1.5"
          onClick={handleRevert}
          disabled={mutation.isPending}
          data-testid="btn-revert-status"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Revert to Pending
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Row Component ────────────────────────────────────────────────────────────

function WarrantyRow({
  item,
  followUp,
  onMarkCheckup,
  onMarkTopup,
  onEditCheckup,
  onEditTopup,
}: {
  item: WarrantyItem;
  followUp?: WarrantyFollowUp;
  onMarkCheckup: () => void;
  onMarkTopup: () => void;
  onEditCheckup: () => void;
  onEditTopup: () => void;
}) {
  const urgency = getUrgency(item.invoiceDate, item.warrantyPeriod, followUp);
  const cfg = URGENCY_CFG[urgency];
  const Icon = cfg.icon;
  const win = getCheckupWindow(item.invoiceDate, item.warrantyPeriod);
  const checkupDone = followUp?.checkupStatus === "done";
  const topupDone = followUp?.topupStatus === "done" || followUp?.topupStatus === "not_applicable";

  return (
    <div className="border rounded-lg bg-white hover:bg-slate-50/60 transition-colors p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

        {/* Left: customer + vehicle + service */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{item.customerName}</span>
            <span className="text-xs text-muted-foreground">{item.customerPhone}</span>
            <Badge variant="outline" className="text-[10px] bg-slate-50">{item.invoiceNo}</Badge>
          </div>
          <div className="text-sm text-slate-600">{item.vehicleInfo} <span className="text-xs text-muted-foreground uppercase tracking-wide ml-1">{item.licensePlate}</span></div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-sm font-medium text-slate-800 leading-tight">{item.itemName}</span>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${item.itemType === "PPF" ? "text-purple-700 bg-purple-50 border-purple-200" : "text-blue-700 bg-blue-50 border-blue-200"}`}>
              {item.itemType}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
              {item.warrantyPeriod}
            </Badge>
          </div>
        </div>

        {/* Middle: dates */}
        <div className="flex gap-6 sm:gap-8 shrink-0 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Service Date</p>
            <p className="font-medium text-slate-700">{fmtDate(item.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Checkup Window</p>
            {win ? (
              <p className="font-medium text-slate-700">{fmtDate(format(win.windowStart, "yyyy-MM-dd"))} <ChevronRight className="inline h-3 w-3" /> {fmtDate(format(win.windowEnd, "yyyy-MM-dd"))}</p>
            ) : <p className="text-slate-400">—</p>}
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Expires</p>
            <p className="font-medium text-slate-700">{win ? fmtDate(format(win.expiryDate, "yyyy-MM-dd")) : "—"}</p>
          </div>
        </div>

        {/* Right: status + actions */}
        <div className="flex flex-col gap-2 shrink-0 min-w-[180px]">
          {/* Urgency badge */}
          <Badge variant="outline" className={`self-start text-[11px] font-medium ${cfg.badge}`}>
            <Icon className={`h-3 w-3 mr-1 ${cfg.iconColor}`} />
            {cfg.label}
          </Badge>

          {/* Checkup status */}
          {checkupDone ? (
            <div className="flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span>Checkup done {followUp?.checkupDate ? `(${fmtDate(followUp.checkupDate)})` : ""}</span>
              <button
                onClick={onEditCheckup}
                className="ml-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                title="Edit checkup"
                data-testid="btn-edit-checkup"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Checkup pending</span>
              <button
                onClick={onMarkCheckup}
                className="text-[11px] font-semibold text-primary hover:underline"
                data-testid="btn-mark-checkup-done"
              >
                ✓ Mark Done
              </button>
            </div>
          )}

          {/* Top-up status */}
          {checkupDone && (
            topupDone ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>
                  {followUp?.topupStatus === "not_applicable" ? "Top-up not required" : `Top-up done ${followUp?.topupDate ? `(${fmtDate(followUp.topupDate)})` : ""}`}
                </span>
                <button
                  onClick={onEditTopup}
                  className="ml-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Edit top-up"
                  data-testid="btn-edit-topup"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Top-up pending</span>
                <button
                  onClick={onMarkTopup}
                  className="text-[11px] font-semibold text-primary hover:underline"
                  data-testid="btn-mark-topup-done"
                >
                  ✓ Mark Done
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function PpfInspectionRow({
  item,
  record,
  isSendingCatchUp,
  onSendCatchUp,
}: {
  item: WarrantyItem;
  record?: PpfInspectionReminderRecord;
  isSendingCatchUp: boolean;
  onSendCatchUp: (record: PpfInspectionReminderRecord) => void;
}) {
  const reminder = getPpfInspectionReminder(item);
  if (!reminder) return null;
  const dueDate = record?.dueDate
    ? parseISO(record.dueDate)
    : reminder.dueDate;
  const messageStatus = !record
    ? "Preparing reminder record"
    : record.status === "awaiting_opt_in"
      ? "Scheduled"
      : record.status === "scheduled"
        ? "Scheduled"
        : record.status === "manual_required"
          ? "Past due — catch-up required"
          : record.status === "sending"
            ? "Sending"
            : record.status === "sent"
              ? "Accepted by WhatsApp"
              : record.status === "failed"
                ? "Failed to send"
                : record.status === "unknown"
                  ? "Send status unknown"
                  : record.status === "invalid_phone"
                    ? "Phone needs checking"
                    : "Service date required";

  const timingLabel =
    reminder.status === "planned"
      ? `In ${reminder.daysUntil} day${reminder.daysUntil === 1 ? "" : "s"}`
      : reminder.status === "due"
        ? "Due today"
        : reminder.status === "past-due"
          ? "Past due"
          : reminder.status === "invalid-phone"
            ? "Check phone"
            : "Missing date";
  const timingColor =
    reminder.status === "planned"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : reminder.status === "due"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : reminder.status === "past-due"
          ? "border-orange-200 bg-orange-50 text-orange-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="border rounded-lg bg-white p-4" data-testid="ppf-inspection-row">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{item.customerName}</span>
            <span className="text-xs text-muted-foreground">{item.customerPhone}</span>
            <Badge variant="outline" className="text-[10px] bg-slate-50">{item.invoiceNo}</Badge>
          </div>
          <p className="text-sm text-slate-600">
            {item.vehicleInfo} <span className="text-xs text-muted-foreground uppercase tracking-wide ml-1">{item.licensePlate}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-800">{item.itemName}</span>
            <Badge variant="outline" className="text-[10px] text-purple-700 bg-purple-50 border-purple-200">PPF</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 sm:gap-6 shrink-0 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Service Date</p>
            <p className="font-medium text-slate-700">{fmtDate(item.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Reminder Due</p>
            <p className="font-medium text-slate-700">
              {dueDate && !Number.isNaN(dueDate.getTime()) ? format(dueDate, "dd MMM yyyy") : "—"}
            </p>
            <Badge variant="outline" className={`mt-1 text-[10px] ${timingColor}`}>
              {timingLabel}
            </Badge>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-muted-foreground mb-0.5">WhatsApp Message</p>
            <p className="font-medium text-slate-700">{messageStatus}</p>
            {record?.sentAt && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Accepted {format(parseISO(record.sentAt), "dd MMM yyyy, h:mm a")}
              </p>
            )}
            {record?.messageId && (
              <p className="mt-1 break-all text-[10px] text-muted-foreground">
                Message ID: {record.messageId}
              </p>
            )}
            {record?.failureReason && (
              <p className="mt-1 text-xs text-red-700">{record.failureReason}</p>
            )}
            {record?.status === "unknown" && (
              <p className="mt-1 text-xs text-amber-800">
                Check WhatsApp before retrying to avoid sending a duplicate.
              </p>
            )}
          </div>
        </div>
      </div>
      {record?.status === "manual_required" && (
        <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={isSendingCatchUp}
              onClick={() => onSendCatchUp(record)}
              data-testid={`button-ppf-catch-up-${record.id}`}
            >
              {isSendingCatchUp ? "Sending…" : "Send catch-up now"}
            </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [inspectionSearch, setInspectionSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [markingState, setMarkingState] = useState<{
    item: WarrantyItem;
    followUp?: WarrantyFollowUp;
    field: "checkup" | "topup";
  } | null>(null);
  const [editingState, setEditingState] = useState<{
    item: WarrantyItem;
    followUp: WarrantyFollowUp;
    field: "checkup" | "topup";
  } | null>(null);

  const { data: warrantyItems = [], isLoading } = useQuery<WarrantyItem[]>({
    queryKey: ["/api/warranty-items"],
  });

  const { data: followUps = [] } = useQuery<WarrantyFollowUp[]>({
    queryKey: ["/api/warranty-followups"],
  });

  const {
    data: ppfReminderRecords = [],
    isLoading: isLoadingPpfReminders,
    isError: ppfRemindersError,
  } = useQuery<PpfInspectionReminderRecord[]>({
    queryKey: ["/api/ppf-inspection-reminders"],
  });

  const catchUpMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/ppf-inspection-reminders/${id}/send-catch-up`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ppf-inspection-reminders"] });
      toast({ title: "Catch-up request processed" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not send catch-up message", description: error.message, variant: "destructive" });
    },
  });

  const ppfReminderByKey = useMemo(
    () => new Map(ppfReminderRecords.map(record => [`${record.invoiceId}:${record.itemId}`, record])),
    [ppfReminderRecords],
  );

  // Find matching follow-up for a warranty item
  const getFollowUp = (item: WarrantyItem) =>
    followUps.find(f => f.invoiceId === item.invoiceId && f.serviceName === item.itemName);

  const filtered = useMemo(() => {
    let list = [...warrantyItems];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.customerName.toLowerCase().includes(q) ||
        i.itemName.toLowerCase().includes(q) ||
        i.vehicleInfo.toLowerCase().includes(q) ||
        i.licensePlate.toLowerCase().includes(q) ||
        i.customerPhone.includes(q) ||
        i.invoiceNo.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== "all") {
      list = list.filter(i => {
        const fu = getFollowUp(i);
        const urgency = getUrgency(i.invoiceDate, i.warrantyPeriod, fu);
        if (filterStatus === "overdue") return urgency === "overdue";
        if (filterStatus === "due") return urgency === "soon";
        if (filterStatus === "upcoming") return urgency === "upcoming";
        if (filterStatus === "done") return urgency === "done";
        return true;
      });
    }

    list.sort((a, b) => {
      const fuA = getFollowUp(a);
      const fuB = getFollowUp(b);
      return URGENCY_ORDER[getUrgency(a.invoiceDate, a.warrantyPeriod, fuA)] -
             URGENCY_ORDER[getUrgency(b.invoiceDate, b.warrantyPeriod, fuB)];
    });

    return list;
  }, [warrantyItems, followUps, search, filterStatus]);

  const ppfItems = useMemo(
    () => warrantyItems.filter(item => item.itemType === "PPF"),
    [warrantyItems],
  );

  const filteredPpfItems = useMemo(() => {
    const query = inspectionSearch.trim().toLowerCase();
    if (!query) return ppfItems;
    return ppfItems.filter(item =>
      [
        item.customerName,
        item.customerPhone,
        item.itemName,
        item.vehicleInfo,
        item.licensePlate,
        item.invoiceNo,
      ].some(value => String(value || "").toLowerCase().includes(query))
    );
  }, [ppfItems, inspectionSearch]);

  // KPI counts
  const counts = useMemo(() => {
    const overdue = warrantyItems.filter(i => getUrgency(i.invoiceDate, i.warrantyPeriod, getFollowUp(i)) === "overdue").length;
    const due = warrantyItems.filter(i => getUrgency(i.invoiceDate, i.warrantyPeriod, getFollowUp(i)) === "soon").length;
    const upcoming = warrantyItems.filter(i => getUrgency(i.invoiceDate, i.warrantyPeriod, getFollowUp(i)) === "upcoming").length;
    const done = warrantyItems.filter(i => getUrgency(i.invoiceDate, i.warrantyPeriod, getFollowUp(i)) === "done").length;
    return { overdue, due, upcoming, done, total: warrantyItems.length };
  }, [warrantyItems, followUps]);

  const FILTER_TABS = [
    { key: "all", label: `All (${counts.total})` },
    { key: "overdue", label: "Overdue" },
    { key: "due", label: "Due Now" },
    { key: "upcoming", label: "Coming Soon" },
    { key: "done", label: "Completed" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Customer Follow-ups
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Warranty checkups and five-day PPF inspections are shown separately.
          </p>
        </div>

        <Tabs defaultValue="warranty" className="space-y-4">
          <TabsList className="grid w-full max-w-xl grid-cols-2">
            <TabsTrigger value="warranty">Warranty Checkups</TabsTrigger>
            <TabsTrigger value="inspections">5-Day PPF Inspections ({ppfItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="warranty" className="space-y-6">
            <h2 className="text-sm font-semibold text-slate-700">Warranty checkup overview</h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-red-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{counts.overdue}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{counts.due}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Now</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{counts.upcoming}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Coming Soon</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{counts.done}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customer, service, vehicle, plate..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-warranty-search"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  filterStatus === tab.key
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                }`}
                data-testid={`filter-${tab.key}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="h-14 w-14 text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">
              {warrantyItems.length === 0
                ? "No warranty items found. Invoices with PPF or service warranties will appear here automatically."
                : "No items match your current filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, idx) => {
              const fu = getFollowUp(item);
              return (
                <WarrantyRow
                  key={`${item.invoiceId}-${item.itemName}-${idx}`}
                  item={item}
                  followUp={fu}
                  onMarkCheckup={() => setMarkingState({ item, followUp: fu, field: "checkup" })}
                  onMarkTopup={() => setMarkingState({ item, followUp: fu, field: "topup" })}
                  onEditCheckup={() => fu && setEditingState({ item, followUp: fu, field: "checkup" })}
                  onEditTopup={() => fu && setEditingState({ item, followUp: fu, field: "topup" })}
                />
              );
            })}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing {filtered.length} of {warrantyItems.length} warranty items
            </p>
          </div>
        )}
          </TabsContent>

          <TabsContent value="inspections" className="space-y-4">
            <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-violet-950">Five-day PPF inspection reminders</p>
              <p className="mt-1 text-sm text-violet-900">
                WhatsApp reminders are scheduled for five calendar days after Service Date. Past-due reminders need a separate catch-up action. “Accepted by WhatsApp” confirms Meta accepted the request; delivery receipts are not connected.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search PPF customer, vehicle, or invoice..."
                  value={inspectionSearch}
                  onChange={e => setInspectionSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-ppf-inspection-search"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {filteredPpfItems.length} of {ppfItems.length} PPF items
              </p>
            </div>

            {isLoading || isLoadingPpfReminders ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : ppfRemindersError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Could not load WhatsApp reminder status. Refresh the page and try again.
              </div>
            ) : filteredPpfItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Shield className="h-14 w-14 text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">
                  {ppfItems.length === 0
                    ? "No PPF items are available in the Warranty records."
                    : "No PPF items match your search."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPpfItems.map((item, idx) => {
                  const record = ppfReminderByKey.get(`${item.invoiceId}:${item.itemId}`);
                  return (
                    <PpfInspectionRow
                      key={`${item.invoiceId}-${item.itemId || item.itemName}-${idx}`}
                      item={item}
                      record={record}
                      isSendingCatchUp={catchUpMutation.isPending}
                      onSendCatchUp={reminderRecord => catchUpMutation.mutate(reminderRecord.id)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Mark Done Dialog */}
      {markingState && (
        <Dialog open onOpenChange={() => setMarkingState(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {markingState.field === "checkup" ? "Mark Checkup Done" : "Mark Top-up Done"}
              </DialogTitle>
            </DialogHeader>
            <MarkDoneDialog
              item={markingState.item}
              followUp={markingState.followUp}
              field={markingState.field}
              onClose={() => setMarkingState(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Follow-Up Dialog */}
      {editingState && (
        <Dialog open onOpenChange={() => setEditingState(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                {editingState.field === "checkup" ? "Edit Checkup Details" : "Edit Top-up Details"}
              </DialogTitle>
            </DialogHeader>
            <EditFollowUpDialog
              item={editingState.item}
              followUp={editingState.followUp}
              field={editingState.field}
              onClose={() => setEditingState(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
