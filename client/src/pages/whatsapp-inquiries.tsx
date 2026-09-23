import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MessageCircle,
  Phone,
  Calendar,
  Clock,
  Car,
  Wrench,
  IndianRupee,
  StickyNote,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { WhatsAppInquiry, WhatsAppInquiryStage } from "@shared/schema";
import { WHATSAPP_INQUIRY_STAGES } from "@shared/schema";

const STAGE_STYLES: Record<WhatsAppInquiryStage, string> = {
  NEW:                 "bg-blue-100 text-blue-700 border-blue-200",
  FORM_SUBMITTED:     "bg-amber-100 text-amber-700 border-amber-200",
  FOLLOW_UP_REQUIRED: "bg-orange-100 text-orange-700 border-orange-200",
  BOOKING_CONFIRMED:  "bg-green-100 text-green-700 border-green-200",
  BOOKING_CANCELLED:  "bg-red-100 text-red-700 border-red-200",
  COMPLETED:          "bg-emerald-100 text-emerald-700 border-emerald-200",
  LOST:               "bg-slate-100 text-slate-600 border-slate-200",
};

const STAGE_LABELS: Record<WhatsAppInquiryStage, string> = {
  NEW: "New",
  FORM_SUBMITTED: "Form Submitted",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  BOOKING_CONFIRMED: "Booking Confirmed",
  BOOKING_CANCELLED: "Booking Cancelled",
  COMPLETED: "Completed",
  LOST: "Lost",
};

function StageBadge({ stage }: { stage: WhatsAppInquiryStage }) {
  return (
    <Badge className={`${STAGE_STYLES[stage]} hover:${STAGE_STYLES[stage]} border font-medium text-xs`}>
      {STAGE_LABELS[stage]}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try { return format(parseISO(dateStr), "dd MMM yyyy"); } catch { return dateStr; }
}

function formatCreatedAt(isoStr: string) {
  if (!isoStr) return "—";
  try { return format(parseISO(isoStr), "dd MMM yyyy, hh:mm a"); } catch { return isoStr; }
}

const API = "/api/whatsapp-inquiries";

export default function WhatsAppInquiriesPage() {
  const { toast } = useToast();

  // Filters
  const [search, setSearch]               = useState("");
  const [stageFilter, setStageFilter]     = useState<string>("ALL");
  const [dateFilter, setDateFilter]       = useState<string>("");

  // Detail drawer state
  const [viewing, setViewing]             = useState<WhatsAppInquiry | null>(null);
  const [inquiryToDelete, setInquiryToDelete] = useState<WhatsAppInquiry | null>(null);
  const [editStage, setEditStage]         = useState<WhatsAppInquiryStage | "">("");
  const [editNotes, setEditNotes]         = useState<string>("");
  const [isSaving, setIsSaving]           = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: inquiries = [], isLoading } = useQuery<WhatsAppInquiry[]>({
    queryKey: [API],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WhatsAppInquiry> }) => {
      const res = await apiRequest("PATCH", `${API}/${id}`, data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: [API] });
      setViewing(updated);
      toast({ title: "Inquiry updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${API}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API] });
      setViewing(null);
      toast({ title: "Inquiry deleted" });
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return inquiries.filter((inq) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        inq.customerName?.toLowerCase().includes(q) ||
        inq.phone?.includes(search);
      const matchesStage =
        stageFilter === "ALL" || inq.stage === stageFilter;
      const matchesDate =
        !dateFilter || inq.appointmentDate === dateFilter;
      return matchesSearch && matchesStage && matchesDate;
    });
  }, [inquiries, search, stageFilter, dateFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openDetail(inq: WhatsAppInquiry) {
    setViewing(inq);
    setEditStage(inq.stage ?? "NEW");
    setEditNotes(inq.notes ?? "");
  }

  async function handleSaveDetail() {
    if (!viewing?.id) return;
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: viewing.id,
        data: { stage: editStage as WhatsAppInquiryStage, notes: editNotes },
      });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp Inquiries</h1>
            <p className="text-sm text-muted-foreground">
              Leads received via WhatsApp — track stage, appointment, and follow-ups
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Stages</SelectItem>
              {WHATSAPP_INQUIRY_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              className="pl-9 w-full md:w-[200px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by appointment date"
            />
          </div>

          {(search || stageFilter !== "ALL" || dateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(""); setStageFilter("ALL"); setDateFilter(""); }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Summary counts */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            Showing <strong>{filtered.length}</strong> of <strong>{inquiries.length}</strong> inquiries
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Customer</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Vehicle</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Service</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Price</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Appointment</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Stage</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500">Created</TableHead>
                <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="font-medium">No inquiries found</p>
                    <p className="text-xs mt-1">Try adjusting your filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inq) => (
                  <TableRow key={inq.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{inq.customerName}</p>
                        <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {inq.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{inq.vehicleModel || "—"}</TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-[160px] truncate">{inq.serviceName || "—"}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-800">
                      {inq.quotedPrice ? (
                        <span className="flex items-center gap-0.5">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {inq.quotedPrice.toLocaleString("en-IN")}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {inq.appointmentDate ? (
                        <div>
                          <p className="text-sm text-slate-700">{formatDate(inq.appointmentDate)}</p>
                          {inq.appointmentTime && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" /> {inq.appointmentTime}
                            </p>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={inq.stage ?? "NEW"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatCreatedAt(inq.createdAt ?? "")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => openDetail(inq)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                          onClick={() => setInquiryToDelete(inq)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl p-0">
          <div className="p-6 space-y-6">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-bold">{viewing?.customerName}</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-blue-500" />
                    {viewing?.phone}
                  </p>
                </div>
                {viewing && <StageBadge stage={viewing.stage ?? "NEW"} />}
              </div>
            </DialogHeader>

            {viewing && (
              <div className="space-y-6">
                {/* Vehicle & Service */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Car className="h-3 w-3" /> Vehicle
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{viewing.vehicleModel || "—"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Wrench className="h-3 w-3" /> Service
                    </p>
                    <p className="text-sm font-semibold text-slate-800">{viewing.serviceName || "—"}</p>
                  </div>
                </div>

                {/* Price & Appointment */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <IndianRupee className="h-3 w-3" /> Price
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {viewing.quotedPrice ? `₹${viewing.quotedPrice.toLocaleString("en-IN")}` : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Appointment Date
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatDate(viewing.appointmentDate ?? "")}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Appointment Time
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {viewing.appointmentTime || "—"}
                    </p>
                  </div>
                </div>

                {/* Stage (editable) */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Update Stage</p>
                  <Select
                    value={editStage}
                    onValueChange={(v) => setEditStage(v as WhatsAppInquiryStage)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {WHATSAPP_INQUIRY_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes (editable) */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" /> Notes
                  </p>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this inquiry…"
                    className="min-h-[80px] resize-none text-sm"
                  />
                </div>

                {/* Created at */}
                <p className="text-xs text-muted-foreground">
                  Created: {formatCreatedAt(viewing.createdAt ?? "")}
                </p>

                {/* Actions */}
                <div className="flex gap-3 pt-2 border-t">
                  <Button
                    onClick={handleSaveDetail}
                    disabled={isSaving || updateMutation.isPending}
                    className="bg-red-500 hover:bg-red-600 text-white px-6"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
                    ) : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setViewing(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="ml-auto text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => setInquiryToDelete(viewing)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!inquiryToDelete}
        onOpenChange={(open) => !open && setInquiryToDelete(null)}
        title="Delete inquiry?"
        description={
          inquiryToDelete
            ? `Delete inquiry for ${inquiryToDelete.customerName}?`
            : ""
        }
        onConfirm={() => {
          if (inquiryToDelete?.id) {
            deleteMutation.mutate(inquiryToDelete.id);
            setInquiryToDelete(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </Layout>
  );
}
