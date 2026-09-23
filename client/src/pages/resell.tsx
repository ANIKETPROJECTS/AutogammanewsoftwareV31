import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { HsnCombobox } from "@/components/ui/hsn-combobox";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  ShoppingCart, Plus, Search, Package, Layers, ChevronLeft, ChevronRight,
  Trash2, X, AlertTriangle, IndianRupee, Pencil, FileText, Printer, Download
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ResellOrder, AccessoryMaster, PPFMaster } from "@shared/schema";
import autoGammaLogo from "@assets/logoAutogamma_1770051027228.png";
import html2canvas from "html2canvas";

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Credit"];
const GST_RATES = [0, 5, 12, 18, 28];
const PAGE_SIZE = 10;

const BUSINESS_INFO = {
  name: "Auto Gamma",
  address: "Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, near Panvel Highway, beside Tulsi Aangan Soc, Katrap, Badlapur, Maharashtra 421503",
  phone: "+91 77380 16768",
  email: "support@autogamma.in",
  website: "www.autogamma.in",
  gst: "27ACEFA1874A1ZS",
};

function formatCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatCurrencyFull(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
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

// ── INVENTORY OVERVIEW ───────────────────────────────────────────────────────
function InventoryOverview({ accessories, ppfs }: { accessories: AccessoryMaster[]; ppfs: PPFMaster[] }) {
  const [showAccDetails, setShowAccDetails] = useState(false);
  const [showPPFDetails, setShowPPFDetails] = useState(false);

  const totalAccQty = accessories.reduce((s, a) => s + (a.quantity ?? 0), 0);
  const lowStockAcc = accessories.filter(a => (a.quantity ?? 0) > 0 && (a.quantity ?? 0) <= 5);
  const outOfStockAcc = accessories.filter(a => (a.quantity ?? 0) === 0);

  const totalPPFRolls = ppfs.reduce((s, p) => s + (p.rolls?.length ?? 0), 0);
  const totalPPFSqft = ppfs.reduce((s, p) => s + (p.rolls ?? []).reduce((rs, r) => rs + (r.stock ?? 0), 0), 0);
  const activeRolls = ppfs.flatMap(p => (p.rolls ?? []).filter(r => r.stock > 10));
  const depletedRolls = ppfs.flatMap(p => (p.rolls ?? []).filter(r => r.stock <= 10));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Accessories Inventory</p>
              <p className="text-xs text-muted-foreground">{accessories.length} products across all categories</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAccDetails(v => !v)}>
            {showAccDetails ? "Hide" : "View All"}
          </Button>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-foreground">{accessories.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Products</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-foreground">{totalAccQty}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Qty</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-amber-600">{lowStockAcc.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Low Stock</p>
            </div>
          </div>
          {outOfStockAcc.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {outOfStockAcc.length} item{outOfStockAcc.length !== 1 ? "s" : ""} out of stock
            </div>
          )}
          {showAccDetails && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto border border-border/40 rounded-lg">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0">
                <span className="col-span-2">Product</span>
                <span className="text-right">In Stock</span>
              </div>
              {accessories.map(a => (
                <div key={a.id} className="grid grid-cols-3 px-3 py-2 border-t border-border/30 text-sm items-center">
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium text-foreground truncate text-xs">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.category}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${
                      a.quantity === 0 ? "text-red-500" : a.quantity <= 5 ? "text-amber-600" : "text-emerald-600"
                    }`}>{a.quantity} pcs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">PPF Rolls Inventory</p>
              <p className="text-xs text-muted-foreground">{ppfs.length} brands · {totalPPFRolls} rolls</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowPPFDetails(v => !v)}>
            {showPPFDetails ? "Hide" : "View All"}
          </Button>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-foreground">{ppfs.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Brands</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-foreground">{activeRolls.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Active Rolls</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-purple-600">{totalPPFSqft.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total sqft</p>
            </div>
          </div>
          {depletedRolls.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {depletedRolls.length} roll{depletedRolls.length !== 1 ? "s" : ""} ≤10 sqft remaining
            </div>
          )}
          {showPPFDetails && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto border border-border/40 rounded-lg">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0">
                <span className="col-span-2">Brand / Roll</span>
                <span className="text-right">Stock</span>
              </div>
              {ppfs.map(ppf => (ppf.rolls ?? []).map(roll => (
                <div key={roll.id} className="grid grid-cols-3 px-3 py-2 border-t border-border/30 text-sm items-center">
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium text-foreground truncate text-xs">{roll.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ppf.name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${
                      roll.stock <= 0 ? "text-red-500" : roll.stock <= 10 ? "text-amber-600" : "text-purple-600"
                    }`}>{roll.stock} sqft</span>
                  </div>
                </div>
              )))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GST SECTION COMPONENT ─────────────────────────────────────────────────────
function GstSection({
  gstType, setGstType,
  gstPct, setGstPct,
  hsnCode, setHsnCode,
  baseAmount,
}: {
  gstType: "None" | "Internal" | "External";
  setGstType: (v: "None" | "Internal" | "External") => void;
  gstPct: string;
  setGstPct: (v: string) => void;
  hsnCode: string;
  setHsnCode: (v: string) => void;
  baseAmount: number;
}) {
  const gst = parseFloat(gstPct) || 0;
  const half = gst / 2;
  const gstAmt = Math.round(baseAmount * gst / 100);
  const halfAmt = Math.round(baseAmount * half / 100);
  const grandTotal = baseAmount + gstAmt;

  return (
    <div className="space-y-4 border border-border/40 rounded-lg p-4 bg-muted/10">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST & Invoice</p>

      {/* GST Type */}
      <div className="space-y-1.5">
        <Label className="text-sm">GST Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["None", "Internal", "External"] as const).map(t => (
            <button key={t} type="button"
              data-testid={`button-gst-type-${t.toLowerCase()}`}
              onClick={() => setGstType(t)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all
                ${gstType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {t === "None" ? "No GST" : t === "Internal" ? "Internal" : "External"}
            </button>
          ))}
        </div>
      </div>

      {/* Single GST % input for Internal and External */}
      {gstType !== "None" && (
        <div className="space-y-1.5">
          <Label className="text-sm">
            GST %
            {gstType === "Internal" && gst > 0 && (
              <span className="text-muted-foreground font-normal ml-1.5">
                → CGST {half}% + SGST {half}%
              </span>
            )}
          </Label>
          <Input
            data-testid="input-gst-pct"
            type="number" min="0" max="100" step="0.01"
            placeholder={gstType === "Internal" ? "e.g. 18 (splits to 9+9)" : "e.g. 18"}
            value={gstPct}
            onChange={e => setGstPct(e.target.value)}
          />
        </div>
      )}

      {/* HSN Code */}
      <div className="space-y-1.5">
        <Label className="text-sm">HSN Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <HsnCombobox value={hsnCode} onChange={setHsnCode} placeholder="Search or type HSN code..." />
      </div>

      {/* Live Calculation Preview */}
      {gstType !== "None" && gst > 0 && baseAmount > 0 && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-600">
            <span className="font-medium">Total Amount</span>
            <span className="font-bold text-slate-900">{formatCurrency(baseAmount)}</span>
          </div>
          {gstType === "Internal" ? (
            <>
              <div className="flex justify-between text-xs text-slate-500">
                <span>CGST {half}%</span>
                <span>+ {formatCurrency(halfAmt)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>SGST {half}%</span>
                <span>+ {formatCurrency(halfAmt)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-xs text-slate-500">
              <span>IGST {gst}%</span>
              <span>+ {formatCurrency(gstAmt)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1.5">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CREATE RESELL DIALOG ──────────────────────────────────────────────────────
function CreateResellDialog({ open, onClose, accessories, ppfs }: {
  open: boolean; onClose: () => void;
  accessories: AccessoryMaster[]; ppfs: PPFMaster[];
}) {
  const { toast } = useToast();
  const [itemType, setItemType] = useState<"Accessory" | "PPF">("Accessory");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");

  const [selectedAccessoryId, setSelectedAccessoryId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedRollId, setSelectedRollId] = useState("");
  const [sqft, setSqft] = useState("");

  const [unitPrice, setUnitPrice] = useState("");
  const [totalAmount, setTotalAmount] = useState(""); // PPF only (manual)
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");

  const [gstType, setGstType] = useState<"None" | "Internal" | "External">("None");
  const [gstPct, setGstPct] = useState("");
  const [hsnCode, setHsnCode] = useState("");

  const selectedAccessory = accessories.find(a => a.id === selectedAccessoryId);
  const selectedBrand = ppfs.find(p => p.id === selectedBrandId);
  const selectedRoll = selectedRollId ? selectedBrand?.rolls?.find(r => r.id === selectedRollId) : undefined;

  const qty = parseFloat(quantity) || 0;
  const sqftVal = parseFloat(sqft) || 0;
  const unitPriceVal = parseFloat(unitPrice) || 0;
  const totalAmountVal = parseFloat(totalAmount) || 0;

  // Accessory: auto-calculate from qty × unit price; PPF: manual entry
  const baseAmount = itemType === "Accessory" ? qty * unitPriceVal : totalAmountVal;

  const gst = parseFloat(gstPct) || 0;
  const half = gst / 2;
  const gstAmount = gstType !== "None" ? Math.round(baseAmount * gst / 100) : 0;
  const grandTotal = baseAmount + gstAmount;

  const handleAccessorySelect = (id: string) => {
    setSelectedAccessoryId(id);
    const acc = accessories.find(a => a.id === id);
    if (acc) setUnitPrice(acc.price.toString());
  };

  const handleBrandSelect = (v: string) => {
    setSelectedBrandId(v);
    setSelectedRollId("");
    setSqft("");
  };

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/resell", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resell"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/accessories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/ppf"] });
      toast({ title: "Resell entry created successfully" });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create resell entry", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setItemType("Accessory"); setDate(new Date().toISOString().split("T")[0]);
    setBuyerName(""); setBuyerPhone(""); setBuyerGstin("");
    setSelectedAccessoryId(""); setQuantity("");
    setSelectedBrandId(""); setSelectedRollId(""); setSqft("");
    setUnitPrice(""); setTotalAmount(""); setPaymentMode("Cash"); setNotes("");
    setGstType("None"); setGstPct(""); setHsnCode("");
  };

  const handleSubmit = () => {
    if (!buyerName.trim()) { toast({ title: "Buyer name is required", variant: "destructive" }); return; }
    if (!date) { toast({ title: "Date is required", variant: "destructive" }); return; }

    const gstPayload = {
      gstType,
      gstPercentage: gstType !== "None" ? gst : 0,
      cgstPercentage: gstType === "Internal" ? half : 0,
      sgstPercentage: gstType === "Internal" ? half : 0,
      igstPercentage: gstType === "External" ? gst : 0,
      gstAmount,
      grandTotal,
      hsnCode,
    };

    if (itemType === "Accessory") {
      if (!selectedAccessoryId) { toast({ title: "Please select an accessory", variant: "destructive" }); return; }
      if (!qty || qty <= 0) { toast({ title: "Quantity must be greater than 0", variant: "destructive" }); return; }
      if (!Number.isInteger(qty)) { toast({ title: "Quantity must be a whole number", variant: "destructive" }); return; }
      if (selectedAccessory && qty > selectedAccessory.quantity) {
        toast({ title: `Insufficient stock. Available: ${selectedAccessory.quantity} pcs`, variant: "destructive" }); return;
      }
      if (baseAmount <= 0) { toast({ title: "Unit price must be greater than 0", variant: "destructive" }); return; }
      mutation.mutate({
        date, buyerName, buyerPhone, buyerGstin, paymentMode, notes,
        ...gstPayload, itemType,
        accessoryId: selectedAccessoryId,
        accessoryName: selectedAccessory?.name ?? "",
        accessoryCategory: selectedAccessory?.category ?? "",
        quantity: qty,
        unitPrice: unitPriceVal,
        totalAmount: baseAmount,
      });
    } else {
      if (!selectedBrandId) { toast({ title: "Please select a PPF brand", variant: "destructive" }); return; }
      if (!selectedRollId) { toast({ title: "Please select a PPF roll", variant: "destructive" }); return; }
      if (!sqftVal || sqftVal <= 0) { toast({ title: "Sqft must be greater than 0", variant: "destructive" }); return; }
      if (selectedRoll && sqftVal > selectedRoll.stock) {
        toast({ title: `Insufficient stock. Available: ${selectedRoll.stock} sqft`, variant: "destructive" }); return;
      }
      if (!totalAmountVal || totalAmountVal <= 0) { toast({ title: "Total amount must be greater than 0", variant: "destructive" }); return; }
      mutation.mutate({
        date, buyerName, buyerPhone, buyerGstin, paymentMode, notes,
        ...gstPayload, itemType,
        ppfBrandId: selectedBrandId,
        ppfBrandName: selectedBrand?.name ?? "",
        ppfRollId: selectedRollId,
        ppfRollName: selectedRoll?.name ?? "",
        sqft: sqftVal,
        unitPrice: unitPriceVal,
        totalAmount: totalAmountVal,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            New Resell Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Item Type */}
          <div className="space-y-1.5">
            <Label>Item Type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {(["Accessory", "PPF"] as const).map(t => (
                <button key={t} type="button" data-testid={`button-type-${t}`}
                  onClick={() => {
                    setItemType(t);
                    setSelectedAccessoryId(""); setSelectedBrandId(""); setSelectedRollId("");
                    setUnitPrice(""); setTotalAmount(""); setQuantity(""); setSqft("");
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all flex items-center gap-2
                    ${itemType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  {t === "Accessory" ? <Package className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  {t === "Accessory" ? "Accessory" : "PPF Roll"}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input data-testid="input-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Buyer Phone</Label>
              <Input data-testid="input-buyer-phone" placeholder="9876543210" maxLength={10}
                value={buyerPhone} onChange={e => setBuyerPhone(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Buyer Name / Company <span className="text-destructive">*</span></Label>
            <Input data-testid="input-buyer-name" placeholder="Company or supplier name" value={buyerName}
              onChange={e => setBuyerName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Buyer GSTIN <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input data-testid="input-buyer-gstin" placeholder="22AAAAA0000A1Z5" maxLength={15}
              value={buyerGstin} onChange={e => setBuyerGstin(e.target.value.toUpperCase())} />
          </div>

          {/* Accessory Fields */}
          {itemType === "Accessory" && (
            <>
              <div className="space-y-1.5">
                <Label>Select Accessory <span className="text-destructive">*</span></Label>
                <Select value={selectedAccessoryId} onValueChange={handleAccessorySelect}>
                  <SelectTrigger data-testid="select-accessory">
                    <SelectValue placeholder="Choose an accessory…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessories.length === 0 && (
                      <SelectItem value="_none" disabled>No accessories in inventory</SelectItem>
                    )}
                    {accessories.map(a => (
                      <SelectItem key={a.id} value={a.id!} disabled={a.quantity === 0}>
                        {a.name} ({a.category}) — {a.quantity} pcs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccessory && (
                  <p className="text-xs text-muted-foreground">
                    Available: <span className={`font-semibold ${selectedAccessory.quantity <= 5 ? "text-amber-600" : "text-emerald-600"}`}>
                      {selectedAccessory.quantity} pcs
                    </span> · Master price: {formatCurrency(selectedAccessory.price)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantity (pcs) <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-quantity" type="number" min="1"
                    placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  {selectedAccessory && qty > selectedAccessory.quantity && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Exceeds available stock
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Unit Price (₹) <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-unit-price" type="number" min="0" placeholder="0"
                    value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </div>
              </div>
              {/* Auto-calculated total for Accessory */}
              {baseAmount > 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-emerald-700 font-medium">Total Amount (auto)</span>
                  <span className="text-sm font-bold text-emerald-800">{formatCurrency(baseAmount)}</span>
                </div>
              )}
            </>
          )}

          {/* PPF Fields */}
          {itemType === "PPF" && (
            <>
              <div className="space-y-1.5">
                <Label>PPF Brand <span className="text-destructive">*</span></Label>
                <Select value={selectedBrandId} onValueChange={handleBrandSelect}>
                  <SelectTrigger data-testid="select-ppf-brand">
                    <SelectValue placeholder="Select brand…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ppfs.length === 0 && <SelectItem value="_none" disabled>No PPF brands found</SelectItem>}
                    {ppfs.map(p => (
                      <SelectItem key={p.id} value={p.id!}>
                        {p.name} ({p.rolls?.length ?? 0} rolls)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBrandId && (
                <div className="space-y-1.5">
                  <Label>PPF Roll <span className="text-destructive">*</span></Label>
                  <SearchableSelect
                    data-testid="select-ppf-roll"
                    value={selectedRollId}
                    onValueChange={setSelectedRollId}
                    placeholder="Select roll…"
                    searchPlaceholder="Search roll…"
                    options={(selectedBrand?.rolls ?? [])
                      .filter(r => r.stock > 0)
                      .map(r => ({ value: r.id!, label: `${r.name} — ${r.stock} sqft` }))}
                  />
                  {selectedRoll && (
                    <p className="text-xs text-muted-foreground">
                      Available: <span className={`font-semibold ${selectedRoll.stock <= 10 ? "text-amber-600" : "text-purple-600"}`}>
                        {selectedRoll.stock} sqft
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sqft to sell <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-sqft" type="number" min="0.1" step="0.1"
                    placeholder="0.0" value={sqft} onChange={e => setSqft(e.target.value)}
                    className={selectedRoll && sqftVal > selectedRoll.stock ? "border-destructive focus-visible:ring-destructive" : ""} />
                  {selectedRoll && sqftVal > selectedRoll.stock && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Exceeds available stock ({selectedRoll.stock} sqft)
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Price per sqft (₹)</Label>
                  <Input data-testid="input-unit-price" type="number" min="0" placeholder="0"
                    value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Total Amount (₹) <span className="text-destructive">*</span></Label>
                <Input data-testid="input-total-amount" type="number" min="0" placeholder="Enter total amount"
                  value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
              </div>
            </>
          )}

          {/* GST Section */}
          <GstSection
            gstType={gstType} setGstType={setGstType}
            gstPct={gstPct} setGstPct={setGstPct}
            hsnCode={hsnCode} setHsnCode={setHsnCode}
            baseAmount={baseAmount}
          />

          {/* Payment Mode */}
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger data-testid="select-payment-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input data-testid="input-notes" placeholder="Any additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <Button data-testid="button-create-resell" onClick={handleSubmit} disabled={mutation.isPending}
            className="w-full bg-primary hover:bg-primary/90">
            {mutation.isPending ? "Creating entry…" : "Create Resell Sale"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── EDIT RESELL DIALOG ────────────────────────────────────────────────────────
function EditResellDialog({ order, onClose }: { order: ResellOrder | null; onClose: () => void }) {
  const { toast } = useToast();
  const [date, setDate] = useState(order?.date ?? "");
  const [buyerName, setBuyerName] = useState(order?.buyerName ?? "");
  const [buyerPhone, setBuyerPhone] = useState(order?.buyerPhone ?? "");
  const [buyerGstin, setBuyerGstin] = useState(order?.buyerGstin ?? "");
  const [quantity, setQuantity] = useState(order?.quantity?.toString() ?? "");
  const [sqft, setSqft] = useState(order?.sqft?.toString() ?? "");
  const [unitPrice, setUnitPrice] = useState(order?.unitPrice?.toString() ?? "");
  const [totalAmount, setTotalAmount] = useState(order?.totalAmount?.toString() ?? ""); // PPF only
  const [paymentMode, setPaymentMode] = useState(order?.paymentMode ?? "Cash");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [gstType, setGstType] = useState<"None" | "Internal" | "External">((order?.gstType as any) ?? "None");
  const [gstPct, setGstPct] = useState((order?.gstPercentage ?? 0) > 0 ? String(order?.gstPercentage ?? "") : "");
  const [hsnCode, setHsnCode] = useState(order?.hsnCode ?? "");

  const qty = parseFloat(quantity) || 0;
  const unitPriceVal = parseFloat(unitPrice) || 0;
  const totalAmountVal = parseFloat(totalAmount) || 0;

  // Accessory: auto-calculate; PPF: manual
  const baseAmount = order?.itemType === "Accessory" ? qty * unitPriceVal : totalAmountVal;

  const gst = parseFloat(gstPct) || 0;
  const half = gst / 2;
  const gstAmount = gstType !== "None" ? Math.round(baseAmount * gst / 100) : 0;
  const grandTotal = baseAmount + gstAmount;

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/resell/${order?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resell"] });
      toast({ title: "Resell entry updated successfully" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to update entry", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!buyerName.trim()) { toast({ title: "Buyer name is required", variant: "destructive" }); return; }
    if (!date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (baseAmount <= 0) { toast({ title: "Amount must be greater than 0", variant: "destructive" }); return; }

    const payload: any = {
      date, buyerName, buyerPhone, buyerGstin,
      unitPrice: unitPriceVal,
      totalAmount: baseAmount,
      paymentMode, notes,
      gstType,
      gstPercentage: gstType !== "None" ? gst : 0,
      cgstPercentage: gstType === "Internal" ? half : 0,
      sgstPercentage: gstType === "Internal" ? half : 0,
      igstPercentage: gstType === "External" ? gst : 0,
      gstAmount,
      grandTotal,
      hsnCode,
    };
    if (order?.itemType === "Accessory") {
      payload.quantity = parseInt(quantity) || 0;
    } else {
      payload.sqft = parseFloat(sqft) || 0;
    }
    mutation.mutate(payload);
  };

  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Resell Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/30 border border-border/40 px-4 py-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Item (read-only)</p>
            {order.itemType === "Accessory" ? (
              <p className="text-sm font-semibold text-foreground">{order.accessoryName}
                <span className="text-xs text-muted-foreground font-normal ml-1">({order.accessoryCategory})</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-foreground">{order.ppfRollName}
                <span className="text-xs text-muted-foreground font-normal ml-1">· {order.ppfBrandName}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input data-testid="edit-input-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Buyer Phone</Label>
              <Input data-testid="edit-input-phone" placeholder="9876543210" maxLength={10}
                value={buyerPhone} onChange={e => setBuyerPhone(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Buyer Name / Company <span className="text-destructive">*</span></Label>
            <Input data-testid="edit-input-buyer" placeholder="Company or supplier name" value={buyerName}
              onChange={e => setBuyerName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Buyer GSTIN <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input data-testid="edit-input-gstin" placeholder="22AAAAA0000A1Z5" maxLength={15}
              value={buyerGstin} onChange={e => setBuyerGstin(e.target.value.toUpperCase())} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {order.itemType === "Accessory" ? (
              <div className="space-y-1.5">
                <Label>Quantity (pcs) <span className="text-destructive">*</span></Label>
                <Input data-testid="edit-input-qty" type="number" min="1" placeholder="0"
                  value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Sqft to sell <span className="text-destructive">*</span></Label>
                <Input data-testid="edit-input-sqft" type="number" min="0.1" step="0.1" placeholder="0.0"
                  value={sqft} onChange={e => setSqft(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{order.itemType === "Accessory" ? "Unit Price (₹)" : "Price per sqft (₹)"} <span className="text-destructive">*</span></Label>
              <Input data-testid="edit-input-price" type="number" min="0" placeholder="0"
                value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            </div>
          </div>

          {/* Accessory: auto-calculated total */}
          {order.itemType === "Accessory" && baseAmount > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-medium">Total Amount (auto)</span>
              <span className="text-sm font-bold text-emerald-800">{formatCurrency(baseAmount)}</span>
            </div>
          )}

          {/* PPF: manual total amount */}
          {order.itemType === "PPF" && (
            <div className="space-y-1.5">
              <Label>Total Amount (₹) <span className="text-destructive">*</span></Label>
              <Input data-testid="edit-input-total" type="number" min="0" placeholder="Enter total amount"
                value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
            </div>
          )}

          <GstSection
            gstType={gstType} setGstType={setGstType}
            gstPct={gstPct} setGstPct={setGstPct}
            hsnCode={hsnCode} setHsnCode={setHsnCode}
            baseAmount={baseAmount}
          />

          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger data-testid="edit-select-payment"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input data-testid="edit-input-notes" placeholder="Any additional notes…" value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button data-testid="button-save-edit" onClick={handleSubmit} disabled={mutation.isPending}
              className="flex-1 bg-primary hover:bg-primary/90">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RESELL INVOICE PRINT COMPONENT ────────────────────────────────────────────
function ResellPrintableInvoice({ order }: { order: ResellOrder }) {
  const gstRate = order.gstPercentage ?? 0;
  const gstType = order.gstType ?? "None";
  const baseAmount = order.totalAmount;
  const gstAmount = gstType !== "None" ? Math.round(baseAmount * gstRate / 100) : 0;
  const grandTotal = baseAmount + gstAmount;
  const halfGst = gstRate / 2;

  const itemName = order.itemType === "Accessory"
    ? `${order.accessoryName}${order.accessoryCategory ? ` (${order.accessoryCategory})` : ""}`
    : `${order.ppfRollName} — ${order.ppfBrandName}`;

  const qtyDisplay = order.itemType === "Accessory"
    ? `${order.quantity} pcs`
    : `${order.sqft} sqft`;

  return (
    <div className="bg-white p-8 font-sans text-slate-900" style={{ minWidth: 640 }} id="resell-printable-invoice">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-red-600 pb-6 mb-6">
        <div className="space-y-3">
          <img src={autoGammaLogo} alt="Auto Gamma" className="h-16 object-contain" />
          <div className="text-sm text-slate-600 space-y-0.5 max-w-xs">
            <p><span className="font-semibold text-slate-700">ADDRESS:</span> {BUSINESS_INFO.address}</p>
            <p><span className="font-semibold text-slate-700">CONTACT:</span> {BUSINESS_INFO.phone}</p>
            <p><span className="font-semibold text-slate-700">MAIL:</span> {BUSINESS_INFO.email}</p>
            <p><span className="font-semibold text-slate-700">WEBSITE:</span> {BUSINESS_INFO.website}</p>
          </div>
        </div>
        <div className="text-right space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Resell Invoice</p>
          <p className="text-2xl font-bold text-slate-900">
            #{order.invoiceNo || order.id?.slice(-6).toUpperCase()}
          </p>
          <p className="text-slate-600">
            {new Date(order.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="text-xs font-bold text-slate-700">GST: {BUSINESS_INFO.gst}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="grid grid-cols-2 gap-8 mb-6 bg-slate-50 p-4 rounded-lg">
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Bill To</p>
          <p className="text-xl font-bold text-slate-900">{order.buyerName}</p>
          {order.buyerPhone && <p className="text-slate-600">{order.buyerPhone}</p>}
          {order.buyerGstin && (
            <p className="text-slate-600 text-sm"><span className="font-semibold">GSTIN:</span> {order.buyerGstin}</p>
          )}
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Payment</p>
          <p className="text-sm text-slate-700 font-semibold">{order.paymentMode}</p>
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">PAID</span>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3">Items</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="text-left p-3 font-bold rounded-tl">Sr.</th>
              <th className="text-left p-3 font-bold">Description</th>
              <th className="text-left p-3 font-bold">Type</th>
              <th className="text-left p-3 font-bold">HSN</th>
              <th className="text-right p-3 font-bold">Rate</th>
              <th className="text-center p-3 font-bold">Qty</th>
              <th className="text-right p-3 font-bold rounded-tr">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white border-b border-slate-200">
              <td className="p-3 text-slate-600">1</td>
              <td className="p-3 font-semibold text-slate-900">{itemName}</td>
              <td className="p-3">
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs uppercase font-medium">
                  {order.itemType}
                </span>
              </td>
              <td className="p-3 font-mono text-xs text-slate-600">{order.hsnCode || "—"}</td>
              <td className="p-3 text-right">₹{order.unitPrice.toLocaleString()}</td>
              <td className="p-3 text-center">{qtyDisplay}</td>
              <td className="p-3 text-right font-bold">₹{baseAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
            <span className="font-medium">Base Amount</span>
            <span className="font-bold">₹{baseAmount.toLocaleString()}</span>
          </div>

          {gstType !== "None" && gstRate > 0 && (
            gstType === "Internal" ? (
              <>
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">(+) CGST: {halfGst.toFixed(2)}%</span>
                  <span className="font-bold">₹{Math.round(baseAmount * halfGst / 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                  <span className="font-medium">(+) SGST: {halfGst.toFixed(2)}%</span>
                  <span className="font-bold">₹{Math.round(baseAmount * halfGst / 100).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                <span className="font-medium">(+) IGST: {gstRate}%</span>
                <span className="font-bold">₹{gstAmount.toLocaleString()}</span>
              </div>
            )
          )}

          <div className="flex justify-between items-center pt-2 text-xl font-black text-red-600">
            <span className="uppercase tracking-tighter">Grand Total</span>
            <span>₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="mt-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-slate-700">{order.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 italic">
          This is a computer-generated invoice for resell / supply transaction.
        </p>
        <div className="mt-6 text-center">
          <p className="text-lg font-bold text-slate-700">Thank You For Your Business</p>
        </div>
      </div>
    </div>
  );
}

// ── RESELL INVOICE DIALOG ─────────────────────────────────────────────────────
function ResellInvoiceDialog({ order, onClose }: { order: ResellOrder | null; onClose: () => void }) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Resell Invoice ${order.invoiceNo || order.id}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: sans-serif; }
        @media print { @page { size: A4; margin: 10mm; } }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const handleDownloadPDF = async () => {
    const content = printRef.current;
    if (!content) return;
    try {
      toast({ title: "Generating PDF…", description: "Please wait." });
      const canvas = await html2canvas(content, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Resell_Invoice_${order.invoiceNo || order.id}</title><style>body{margin:0;padding:0;}img{width:100%;height:auto;display:block;}@media print{body{margin:0;}}</style></head><body><img src="${imgData}" /></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
      }
      toast({ title: "PDF Downloaded!" });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  const handleWhatsApp = async () => {
    await handleDownloadPDF();
    let phone = (order.buyerPhone ?? "").replace(/\D/g, "");
    if (!phone) { toast({ title: "No buyer phone number on record" }); return; }
    if (phone.startsWith("0")) phone = "91" + phone.substring(1);
    else if (!phone.startsWith("91")) phone = "91" + phone;
    const gstAmount = order.gstType !== "None" ? Math.round(order.totalAmount * (order.gstPercentage ?? 0) / 100) : 0;
    const grandTotal = order.totalAmount + gstAmount;
    const msg = encodeURIComponent(
      `Hello ${order.buyerName},\n\nPlease find your resell invoice #${order.invoiceNo || order.id} for ₹${grandTotal.toLocaleString()}.\n\nThank you for choosing Auto Gamma!`
    );
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${msg}`, "_blank");
  };

  return (
    <Dialog open={!!order} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Resell Invoice {order.invoiceNo ? `#${order.invoiceNo}` : ""}
            </DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-invoice">
                <Printer className="h-3.5 w-3.5 mr-1.5" />Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="button-download-pdf">
                <Download className="h-3.5 w-3.5 mr-1.5" />PDF
              </Button>
              {order.buyerPhone && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleWhatsApp} data-testid="button-whatsapp">
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 overflow-auto">
          <div ref={printRef}>
            <ResellPrintableInvoice order={order} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ResellPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<ResellOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<ResellOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ResellOrder | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [page, setPage] = useState(1);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<ResellOrder[]>({
    queryKey: ["/api/resell"],
  });
  const { data: accessories = [], isLoading: accLoading } = useQuery<AccessoryMaster[]>({
    queryKey: ["/api/masters/accessories"],
  });
  const { data: ppfs = [], isLoading: ppfLoading } = useQuery<PPFMaster[]>({
    queryKey: ["/api/masters/ppf"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/resell/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resell"] });
      toast({ title: "Resell entry deleted" });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter(o => {
      const matchSearch = !q ||
        o.buyerName.toLowerCase().includes(q) ||
        (o.buyerPhone ?? "").includes(q) ||
        (o.accessoryName ?? "").toLowerCase().includes(q) ||
        (o.ppfBrandName ?? "").toLowerCase().includes(q) ||
        (o.ppfRollName ?? "").toLowerCase().includes(q) ||
        (o.invoiceNo ?? "").toLowerCase().includes(q);
      const matchType = filterType === "all" || o.itemType === filterType;
      const matchPayment = filterPayment === "all" || o.paymentMode === filterPayment;
      return matchSearch && matchType && matchPayment;
    });
  }, [orders, search, filterType, filterPayment]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Resell</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sell accessories and PPF rolls to other companies and suppliers
            </p>
          </div>
          <Button data-testid="button-new-resell" onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />New Resell Sale
          </Button>
        </div>

        {/* Inventory Overview */}
        {(accLoading || ppfLoading) ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border/60 bg-background h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <InventoryOverview accessories={accessories} ppfs={ppfs} />
        )}

        {/* Summary Stats */}
        {orders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Sales", value: orders.length, sub: "all time", icon: ShoppingCart, color: "bg-blue-100 text-blue-600" },
              { label: "Total Revenue", value: formatCurrency(orders.reduce((s, o) => s + (o.grandTotal || o.totalAmount), 0)), sub: "incl. GST", icon: IndianRupee, color: "bg-emerald-100 text-emerald-600" },
              { label: "Accessory Sales", value: orders.filter(o => o.itemType === "Accessory").length, sub: "entries", icon: Package, color: "bg-orange-100 text-orange-600" },
              { label: "PPF Sales", value: orders.filter(o => o.itemType === "PPF").length, sub: "entries", icon: Layers, color: "bg-purple-100 text-purple-600" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-background px-4 py-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-lg text-foreground leading-tight">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + Search */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input data-testid="input-search" placeholder="Search buyer, product, invoice…"
              className="pl-10" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="Accessory">Accessories</SelectItem>
              <SelectItem value="PPF">PPF Rolls</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={v => { setFilterPayment(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          {(search || filterType !== "all" || filterPayment !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground"
              onClick={() => { setSearch(""); setFilterType("all"); setFilterPayment("all"); setPage(1); }}>
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          )}
        </div>

        {/* Orders Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden bg-background shadow-sm">
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-muted/30 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span className="col-span-1">Date</span>
            <span className="col-span-2">Buyer</span>
            <span className="col-span-1">Type</span>
            <span className="col-span-2">Item</span>
            <span className="col-span-1">Qty/Sqft</span>
            <span className="col-span-1">GST</span>
            <span className="col-span-2">Total</span>
            <span className="col-span-1">Invoice</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>

          {ordersLoading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading orders…</span>
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 opacity-25" />
              <p className="text-base font-medium">
                {orders.length === 0 ? "No resell entries yet" : "No entries match your filters"}
              </p>
              {orders.length === 0 && (
                <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Create First Sale
                </Button>
              )}
            </div>
          ) : (
            paginated.map((order, i) => {
              const gstAmt = order.gstType !== "None" ? Math.round(order.totalAmount * (order.gstPercentage ?? 0) / 100) : 0;
              const grand = (order.grandTotal && order.grandTotal > 0) ? order.grandTotal : order.totalAmount + gstAmt;
              return (
                <div key={order.id}
                  data-testid={`row-resell-${order.id}`}
                  className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center text-sm
                    ${i < paginated.length - 1 ? "border-b border-border/40" : ""}`}>

                  <div className="col-span-1 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(order.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                  </div>

                  <div className="col-span-2 min-w-0">
                    <p className="font-medium text-foreground truncate text-xs">{order.buyerName}</p>
                    {order.buyerPhone && <p className="text-[10px] text-muted-foreground">{order.buyerPhone}</p>}
                  </div>

                  <div className="col-span-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      order.itemType === "Accessory" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {order.itemType === "Accessory" ? "ACC" : "PPF"}
                    </span>
                  </div>

                  <div className="col-span-2 min-w-0">
                    {order.itemType === "Accessory" ? (
                      <>
                        <p className="font-medium text-foreground truncate text-xs">{order.accessoryName}</p>
                        <p className="text-[10px] text-muted-foreground">{order.accessoryCategory}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-foreground truncate text-xs">{order.ppfRollName}</p>
                        <p className="text-[10px] text-muted-foreground">{order.ppfBrandName}</p>
                      </>
                    )}
                  </div>

                  <div className="col-span-1 text-xs font-semibold text-foreground">
                    {order.itemType === "Accessory" ? `${order.quantity} pcs` : `${order.sqft} sqft`}
                  </div>

                  <div className="col-span-1">
                    {order.gstType && order.gstType !== "None" && (order.gstPercentage ?? 0) > 0 ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {order.gstType === "Internal" ? "CGST+SGST" : "IGST"} {order.gstPercentage}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="col-span-2">
                    <p className="font-bold text-sm text-foreground">{formatCurrency(grand)}</p>
                    <p className="text-[10px] text-muted-foreground">{order.paymentMode}</p>
                  </div>

                  <div className="col-span-1">
                    {order.invoiceNo ? (
                      <span className="text-[10px] font-mono text-primary">{order.invoiceNo}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="col-span-1 flex justify-end items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      data-testid={`button-invoice-${order.id}`}
                      title="View Invoice"
                      onClick={() => setInvoiceOrder(order)}>
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      data-testid={`button-edit-${order.id}`}
                      onClick={() => setEditOrder(order)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      data-testid={`button-delete-${order.id}`}
                      onClick={() => setOrderToDelete(order)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <CreateResellDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        accessories={accessories}
        ppfs={ppfs}
      />

      <EditResellDialog
        key={editOrder?.id ?? "edit-closed"}
        order={editOrder}
        onClose={() => setEditOrder(null)}
      />

      <ResellInvoiceDialog
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
      />

      <ConfirmActionDialog
        open={!!orderToDelete}
        onOpenChange={(open) => !open && setOrderToDelete(null)}
        title="Delete resell entry?"
        description="Are you sure you want to delete this resell entry?"
        onConfirm={() => {
          if (orderToDelete?.id) {
            deleteMutation.mutate(orderToDelete.id);
            setOrderToDelete(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </Layout>
  );
}
