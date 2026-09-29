import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Search, Building2, Phone, Mail, MapPin, Edit2, Trash2,
  ShoppingCart, Package, CalendarDays, ChevronDown, ChevronUp, X,
  ArrowLeft, LayoutGrid, List, ArrowUpDown, Eye, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Vendor, VendorPurchase, PurchaseItem, PPFMaster, AccessoryMaster, AccessoryCategory, VehicleType } from "@shared/schema";
import { format } from "date-fns";

// ─── HSN Codes (from Auto Gamma GST/HSN reference sheet) ─────────────────────
const HSN_CODES = [
  { code: "998713", description: "PPF Installation / Ceramic Coating / Car Detailing / Paint Correction / Denting & Painting" },
  { code: "998538", description: "Car Wash / Cleaning / Interior Cleaning" },
  { code: "3919",   description: "PPF Film (Supply / Sale)" },
  { code: "3824",   description: "Ceramic Coating Liquid" },
  { code: "3405",   description: "Car Polish / Rubbing Compound" },
  { code: "3402",   description: "Car Shampoo" },
  { code: "6307",   description: "Microfiber Cloth" },
  { code: "9603",   description: "Detailing Brush" },
  { code: "87089900", description: "Seat Covers / Car Mats / Steering Cover / Body Kit / Roof Rails / Door Visor / Spoiler" },
  { code: "94049099", description: "Car Neck Cushion" },
  { code: "85198100", description: "Car Audio System / Music System" },
  { code: "852859",  description: "Android CarPlay System" },
  { code: "852580",  description: "Dash Camera" },
  { code: "8708",    description: "General Motor Vehicle Parts" },
  { code: "851810",  description: "Speaker / Subwoofer / Amplifier" },
  { code: "85122020", description: "LED Headlights / Fog Lamps / LED Light Bar" },
  { code: "94054090", description: "Ambient Light" },
];

const VENDOR_CATEGORIES = ["PPF", "Accessory"];
const NEW_PPF_VALUE = "__new_ppf__";
const NEW_ACCESSORY_VALUE = "__new_acc__";
const NEW_CATEGORY_VALUE = "__new_cat__";

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMM yyyy"); } catch { return dateStr; }
}
function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
function getItemCost(item: any): number {
  if (item.itemType === "Accessory") return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
  return Number(item.unitPrice) || 0;
}
function getItemSellTotal(item: any): number {
  if (item.itemType === "Accessory") return (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 1);
  return Number(item.sellingPrice) || 0;
}
function getPurchaseCost(p: any): number {
  return (p.items || []).reduce((sum: number, item: any) => sum + getItemCost(item), 0);
}
function getGrandTotal(p: any): number {
  return Number((p as any).grandTotal) || getPurchaseCost(p);
}
function getSellingTotal(p: any): number {
  return (p.items || []).reduce((sum: number, item: any) => sum + getItemSellTotal(item), 0);
}

// ─── HSN Combobox ─────────────────────────────────────────────────────────────
function HsnCombobox({ value, onChange, idx }: { value: string; onChange: (v: string) => void; idx: number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSearch(value); }, [value]);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < estimatedHeight
        ? rect.top - estimatedHeight - 4
        : rect.bottom + 4;
      setDropPos({ top, left: rect.left, width: Math.max(320, rect.width) });
    }
    setOpen(true);
  };

  const filtered = HSN_CODES.filter(h =>
    h.code.includes(search) || h.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={wrapRef} className="relative">
      <Input
        ref={triggerRef}
        data-testid={`input-hsn-${idx}`}
        className="h-8 text-xs"
        placeholder="HSN code (search or type)..."
        value={search}
        onFocus={openDropdown}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); openDropdown(); }}
      />
      {open && filtered.length > 0 && dropPos && (
        <div
          className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-2xl max-h-52 overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          {filtered.map(h => (
            <button
              key={h.code}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
              onMouseDown={e => { e.preventDefault(); onChange(h.code); setSearch(h.code); setOpen(false); }}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-xs text-primary">{h.code}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">{h.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Searchable Item Select (for PPF brands / accessory categories & items) ────
interface SearchableItemSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  placeholder: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
  testId?: string;
}

function SearchableItemSelect({ value, onValueChange, options, placeholder, onAddNew, addNewLabel = "Add new", disabled, testId }: SearchableItemSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < estimatedHeight
        ? rect.top - estimatedHeight - 4
        : rect.bottom + 4;
      setDropPos({ top, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={openDropdown}
        className={`flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${disabled ? "opacity-50" : "hover:bg-muted/30"}`}
      >
        <span className={value ? "text-foreground truncate" : "text-muted-foreground"}>{value || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0 ml-1" />
      </button>

      {open && dropPos && (
        <div
          className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-2xl flex flex-col"
          style={{ top: dropPos.top, left: dropPos.left, width: Math.max(200, dropPos.width) }}
        >
          {/* Search */}
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-7 pl-7 pr-2 text-xs bg-muted/40 rounded-md border border-border/50 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Options — first 5 visible, scrollable */}
          <div className="overflow-y-auto" style={{ maxHeight: "160px" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">No results</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors ${value === opt ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                  onMouseDown={e => { e.preventDefault(); onValueChange(opt); setOpen(false); setSearch(""); }}
                >
                  {opt}
                </button>
              ))
            )}
          </div>

          {/* Add new section */}
          {onAddNew && (
            <div className="border-t border-border/50">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-primary font-medium hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                onMouseDown={e => { e.preventDefault(); onAddNew(); setOpen(false); setSearch(""); }}
              >
                <Plus className="h-3 w-3" />
                {addNewLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vendor Form ──────────────────────────────────────────────────────────────
interface VendorFormProps { vendor?: Vendor | null; onClose: () => void; }

function VendorForm({ vendor, onClose }: VendorFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: vendor?.name ?? "", contactPerson: vendor?.contactPerson ?? "",
    phone: vendor?.phone ?? "", email: vendor?.email ?? "",
    address: vendor?.address ?? "",
    categories: vendor?.categories && vendor.categories.length > 0
      ? vendor.categories
      : vendor?.category ? [vendor.category] : [] as string[],
    notes: vendor?.notes ?? "",
  });

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor added" }); onClose(); },
  });
  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("PATCH", `/api/vendors/${vendor!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); toast({ title: "Vendor updated" }); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (vendor) updateMutation.mutate(form); else createMutation.mutate(form);
  };
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <Label>Vendor Name *</Label>
          <Input data-testid="input-vendor-name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Garware Films Ltd" required />
        </div>
        <div className="space-y-1">
          <Label>Contact Person</Label>
          <Input data-testid="input-vendor-contact" value={form.contactPerson}
            onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <div className="flex items-center gap-4 mt-1.5">
            {VENDOR_CATEGORIES.map(cat => (
              <label key={cat} className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  data-testid={`checkbox-vendor-category-${cat.toLowerCase()}`}
                  checked={form.categories.includes(cat)}
                  onCheckedChange={() => toggleCategory(cat)}
                />
                <span className="text-sm font-medium">{cat}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input data-testid="input-vendor-phone" value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input data-testid="input-vendor-email" type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vendor@example.com" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Address</Label>
          <Input data-testid="input-vendor-address" value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Notes</Label>
          <Textarea data-testid="input-vendor-notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional notes..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button data-testid="button-save-vendor" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : vendor ? "Update Vendor" : "Add Vendor"}
        </Button>
      </div>
    </form>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────
interface ItemRowProps {
  idx: number;
  item: PurchaseItem & { hsnCode?: string };
  ppfMasters: PPFMaster[];
  accessories: AccessoryMaster[];
  categories: AccessoryCategory[];
  vehicleTypes: VehicleType[];
  onChange: (idx: number, item: any) => void;
  onRemove: (idx: number) => void;
}

function ItemRow({ idx, item, ppfMasters, accessories, categories, vehicleTypes, onChange, onRemove }: ItemRowProps) {
  const [isNewPPF, setIsNewPPF] = useState(false);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [isNewAccessory, setIsNewAccessory] = useState(false);
  const [showVehiclePricing, setShowVehiclePricing] = useState(false);

  const filteredAccessories = accessories.filter(a =>
    (a.category || "").toLowerCase() === (item.categoryName || "").toLowerCase()
  );

  const handlePPFSelect = (val: string) => {
    if (val === NEW_PPF_VALUE) { setIsNewPPF(true); onChange(idx, { ...item, name: "", rollName: "", ppfPricing: [] }); }
    else { setIsNewPPF(false); onChange(idx, { ...item, name: val }); }
  };
  const handleCategorySelect = (val: string) => {
    if (val === NEW_CATEGORY_VALUE) { setIsNewCategory(true); onChange(idx, { ...item, categoryName: "", name: "" }); }
    else { setIsNewCategory(false); onChange(idx, { ...item, categoryName: val, name: "" }); }
  };
  const handleAccessorySelect = (val: string) => {
    if (val === NEW_ACCESSORY_VALUE) { setIsNewAccessory(true); onChange(idx, { ...item, name: "" }); }
    else { setIsNewAccessory(false); onChange(idx, { ...item, name: val }); }
  };

  const addVehiclePricingRow = () => {
    const pricing = Array.isArray(item.ppfPricing) ? item.ppfPricing : [];
    onChange(idx, { ...item, ppfPricing: [...pricing, { vehicleType: "", warranty: "", price: 0 }] });
  };
  const updateVehiclePricingRow = (pi: number, field: string, val: string | number) => {
    const pricing = [...((item.ppfPricing as any[]) || [])];
    pricing[pi] = { ...pricing[pi], [field]: val };
    onChange(idx, { ...item, ppfPricing: pricing });
  };
  const removeVehiclePricingRow = (pi: number) => {
    const pricing = ((item.ppfPricing as any[]) || []).filter((_: any, i: number) => i !== pi);
    onChange(idx, { ...item, ppfPricing: pricing });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card shadow-sm">
      {/* Row 1: Type badge + full-width item name + delete */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Select
          value={item.itemType}
          onValueChange={v => { setIsNewPPF(false); setIsNewCategory(false); setIsNewAccessory(false); onChange(idx, { ...item, itemType: v as "PPF" | "Accessory", name: "", categoryName: "", unit: v === "Accessory" ? "pcs" : "sqft" }); }}
        >
          <SelectTrigger data-testid={`select-item-type-${idx}`} className="h-8 text-xs w-[100px] flex-shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PPF">PPF</SelectItem>
            <SelectItem value="Accessory">Accessory</SelectItem>
          </SelectContent>
        </Select>

        {/* Item name — full width */}
        <div className="flex-1 min-w-0 flex gap-2">
          {item.itemType === "PPF" && (
            isNewPPF ? (
              <div className="flex gap-1.5 flex-1">
                <Input data-testid={`input-new-ppf-name-${idx}`} className="h-8 text-xs flex-1"
                  placeholder="New PPF brand name..." value={item.name} autoFocus
                  onChange={e => onChange(idx, { ...item, name: e.target.value })} />
                <button type="button" onClick={() => { setIsNewPPF(false); onChange(idx, { ...item, name: "" }); }}
                  className="h-8 w-8 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <SearchableItemSelect
                testId={`select-ppf-brand-${idx}`}
                value={item.name}
                onValueChange={val => handlePPFSelect(val)}
                options={ppfMasters.map(p => p.name)}
                placeholder="Select PPF brand..."
                onAddNew={() => handlePPFSelect(NEW_PPF_VALUE)}
                addNewLabel="Add new brand"
              />
            )
          )}
          {item.itemType === "Accessory" && (
            <>
              {isNewCategory ? (
                <Input data-testid={`input-new-category-${idx}`} className="h-8 text-xs flex-1"
                  placeholder="New category name..." value={item.categoryName} autoFocus
                  onChange={e => onChange(idx, { ...item, categoryName: e.target.value })} />
              ) : (
                <SearchableItemSelect
                  testId={`select-category-${idx}`}
                  value={item.categoryName || ""}
                  onValueChange={val => handleCategorySelect(val)}
                  options={categories.map(c => c.name)}
                  placeholder="Category..."
                  onAddNew={() => handleCategorySelect(NEW_CATEGORY_VALUE)}
                  addNewLabel="New category"
                />
              )}
              {isNewAccessory || isNewCategory ? (
                <Input data-testid={`input-new-accessory-name-${idx}`} className="h-8 text-xs flex-1"
                  placeholder="Accessory name..." value={item.name}
                  onChange={e => onChange(idx, { ...item, name: e.target.value })} />
              ) : (
                <SearchableItemSelect
                  testId={`select-acc-item-${idx}`}
                  value={item.name}
                  onValueChange={val => handleAccessorySelect(val)}
                  options={filteredAccessories.map(a => a.name)}
                  placeholder={item.categoryName ? "Item..." : "Pick category first"}
                  disabled={!item.categoryName}
                  onAddNew={item.categoryName ? () => handleAccessorySelect(NEW_ACCESSORY_VALUE) : undefined}
                  addNewLabel="New item"
                />
              )}
            </>
          )}
        </div>

        <button type="button" onClick={() => onRemove(idx)}
          className="h-8 w-8 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex-shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* PPF Roll Name */}
      {item.itemType === "PPF" && item.name && (
        <div className="px-4 pb-3">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Roll / Batch name
          </label>
          <Input data-testid={`input-roll-name-${idx}`} className="h-9 text-sm"
            placeholder="e.g. Roll A, AA10190223..."
            value={(item as any).rollName || ""}
            onChange={e => onChange(idx, { ...item, rollName: e.target.value })} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            This name will appear in PPF Masters.
          </p>
        </div>
      )}

      {/* Data fields — two spacious rows */}
      <div className="border-t border-border/40 bg-muted/20 px-4 py-4 space-y-4">
        {/* Row A: HSN Code + Qty + Unit */}
        <div className="grid grid-cols-[1fr_100px_100px] gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">HSN Code</label>
            <HsnCombobox value={(item as any).hsnCode || ""} onChange={v => onChange(idx, { ...item, hsnCode: v })} idx={idx} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {item.itemType === "PPF" ? "Stock (sqft)" : "Quantity"}
            </label>
            <Input data-testid={`input-item-qty-${idx}`} className="h-9 text-sm text-center"
              type="number" min={0} placeholder="0" value={item.quantity}
              onChange={e => onChange(idx, { ...item, quantity: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unit</label>
            {item.itemType === "PPF" ? (
              <div data-testid={`select-item-unit-${idx}`} className="h-9 flex items-center justify-center rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
                sqft
              </div>
            ) : (
              <Select value={item.unit} onValueChange={v => onChange(idx, { ...item, unit: v })}>
                <SelectTrigger data-testid={`select-item-unit-${idx}`} className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["sqft", "pcs", "roll", "ltr", "kg", "set", "box"].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Row B: Pricing */}
        {item.itemType === "Accessory" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unit Price (₹)</label>
              <Input data-testid={`input-item-price-${idx}`} className="h-9 text-sm"
                type="number" min={0} placeholder="0" value={item.unitPrice}
                onChange={e => onChange(idx, { ...item, unitPrice: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cost Total</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border/40 bg-muted/30 text-sm font-semibold text-foreground">
                {formatCurrency((item.unitPrice || 0) * (item.quantity || 0))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unit Price (₹) — Cost</label>
              <Input data-testid={`input-item-price-${idx}`} className="h-9 text-sm"
                type="number" min={0} placeholder="0" value={item.unitPrice}
                onChange={e => onChange(idx, { ...item, unitPrice: Number(e.target.value) })} />
            </div>
            <div className="pb-0.5 text-right min-w-[100px]">
              <p className="text-[10px] text-muted-foreground mb-0.5">Cost total</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(item.unitPrice || 0)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle type pricing (new PPF only) */}
      {item.itemType === "PPF" && isNewPPF && item.name && (
        <div className="px-3 pb-3 pt-1">
          <button type="button" onClick={() => setShowVehiclePricing(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showVehiclePricing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showVehiclePricing ? "Hide" : "Add"} vehicle-type pricing (optional)
          </button>
          {showVehiclePricing && (
            <div className="space-y-1.5 mt-2">
              {((item.ppfPricing as any[]) || []).map((row: any, pi: number) => (
                <div key={pi} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                  <Select value={row.vehicleType} onValueChange={v => updateVehiclePricingRow(pi, "vehicleType", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Vehicle type" /></SelectTrigger>
                    <SelectContent>{vehicleTypes.map(vt => <SelectItem key={vt.id} value={vt.name}>{vt.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={row.warranty} onValueChange={v => updateVehiclePricingRow(pi, "warranty", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Warranty" /></SelectTrigger>
                    <SelectContent>{["1 Year", "2 Years", "3 Years", "5 Years", "Lifetime"].map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="h-7 text-xs" type="number" placeholder="₹ Price"
                    value={row.price} onChange={e => updateVehiclePricingRow(pi, "price", Number(e.target.value))} />
                  <button type="button" onClick={() => removeVehiclePricingRow(pi)}
                    className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={addVehiclePricingRow}>
                <Plus className="h-3 w-3 mr-1" /> Add vehicle type
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inline notices */}
      {(isNewCategory || isNewAccessory || (isNewPPF && item.name)) && (
        <div className="px-3 pb-2">
          <p className="text-xs text-primary">
            {isNewCategory ? "New category & accessory" : isNewAccessory ? "New accessory" : "New PPF brand"} will be auto-created in Masters.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Purchase Form ────────────────────────────────────────────────────────────
interface PurchaseFormProps {
  vendorId: string;
  vendorName: string;
  purchase?: VendorPurchase | null;
  onClose: () => void;
}

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "NEFT/RTGS"];

function PurchaseForm({ vendorId, vendorName, purchase, onClose }: PurchaseFormProps) {
  const { toast } = useToast();
  const [receivedDate, setReceivedDate] = useState(purchase?.receivedDate ?? "");
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partially_paid" | "unpaid">(
    (purchase as any)?.paymentStatus ?? "unpaid"
  );
  const [paymentRecords, setPaymentRecords] = useState<{ method: string; date: string; amount: number }[]>(
    (purchase as any)?.payments?.length ? (purchase as any).payments : []
  );

  const addPaymentRecord = () => setPaymentRecords(prev => [...prev, { method: "Cash", date: "", amount: 0 }]);
  const removePaymentRecord = (i: number) => setPaymentRecords(prev => prev.filter((_, idx) => idx !== i));
  const updatePaymentRecord = (i: number, field: string, val: string | number) =>
    setPaymentRecords(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const existingGstType: "none" | "external" | "internal" =
    (purchase as any)?.gstType ?? ((purchase as any)?.gstEnabled ? "external" : "none");
  const [gstType, setGstType] = useState<"none" | "external" | "internal">(existingGstType);
  const existingGst = ((purchase as any)?.cgstPercent || 0) + ((purchase as any)?.sgstPercent || 0);
  const [gstPercent, setGstPercent] = useState<string>(existingGst > 0 ? existingGst.toString() : "");

  const emptyItem = (): any => ({
    itemType: "PPF", categoryName: "", name: "", rollName: "", ppfPricing: [], hsnCode: "", quantity: 0, unit: "sqft", unitPrice: 0,
  });

  const [items, setItems] = useState<any[]>(
    purchase?.items?.length
      ? purchase.items.map((i: any) => ({ itemType: "PPF", categoryName: "", rollName: "", ppfPricing: [], hsnCode: "", sellingPrice: 0, ...i }))
      : [emptyItem()]
  );
  const [expandedItemIdx, setExpandedItemIdx] = useState<number>(0);

  const { data: ppfMasters = [] } = useQuery<PPFMaster[]>({ queryKey: ["/api/masters/ppf"] });
  const { data: categories = [] } = useQuery<AccessoryCategory[]>({ queryKey: ["/api/masters/accessory-categories"] });
  const { data: accessories = [] } = useQuery<AccessoryMaster[]>({ queryKey: ["/api/masters/accessories"] });
  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({ queryKey: ["/api/masters/vehicle-types"] });

  const addItem = () => {
    setItems(prev => {
      const next = [...prev, emptyItem()];
      setExpandedItemIdx(next.length - 1);
      return next;
    });
  };
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, updated: any) => setItems(prev => prev.map((item, i) => i === idx ? updated : item));

  const total = items.reduce((sum, i) => sum + getItemCost(i), 0);
  const paidTotal = paymentRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const gstEnabled = gstType !== "none";
  const gstRate = gstEnabled && gstPercent ? parseFloat(gstPercent) : 0;
  // Internal: GST is included in the price — back-calculate base amount
  // External: GST is added on top of the purchase cost
  const baseAmount = gstType === "internal" && gstRate > 0 ? total / (1 + gstRate / 100) : total;
  const cgstAmt = gstRate > 0 ? (baseAmount * (gstRate / 2)) / 100 : 0;
  const sgstAmt = gstRate > 0 ? (baseAmount * (gstRate / 2)) / 100 : 0;
  const grandTotal = gstType === "external" ? total + cgstAmt + sgstAmt : total;

  const invalidateMasters = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/masters/ppf"] });
    queryClient.invalidateQueries({ queryKey: ["/api/masters/accessories"] });
    queryClient.invalidateQueries({ queryKey: ["/api/masters/accessory-categories"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/vendor-purchases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-purchases"] });
      invalidateMasters();
      toast({ title: "Purchase recorded" });
      onClose();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/vendor-purchases/${purchase!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-purchases"] });
      invalidateMasters();
      toast({ title: "Purchase updated" });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.name.trim());
    if (!validItems.length) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" });
      return;
    }
    if (validItems.some(i => i.itemType === "PPF" && !(Number(i.quantity) > 0))) {
      toast({
        title: "PPF stock is required",
        description: "Enter the roll's stock in square feet before recording the purchase.",
        variant: "destructive",
      });
      return;
    }
    if (validItems.some(i => i.itemType === "Accessory" && !String(i.categoryName || "").trim())) {
      toast({
        title: "Accessory category is required",
        description: "Select or add a category so the accessory can be added to Masters.",
        variant: "destructive",
      });
      return;
    }
    if (paymentStatus !== "unpaid") {
      const validPayments = paymentRecords.filter(r => r.amount > 0);
      if (validPayments.length === 0) {
        toast({ title: "Error", description: "Please add at least one payment record with an amount", variant: "destructive" });
        return;
      }
      const currentPaidTotal = validPayments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (currentPaidTotal > grandTotal) {
        toast({ title: "Error", description: "Total paid amount cannot exceed the grand total", variant: "destructive" });
        return;
      }
      if (paymentStatus === "paid" && Math.abs(currentPaidTotal - grandTotal) > 0.01) {
        toast({ title: "Error", description: `For "Paid" status, total paid (${formatCurrency(currentPaidTotal)}) must equal the grand total (${formatCurrency(grandTotal)})`, variant: "destructive" });
        return;
      }
      if (paymentStatus === "partially_paid" && currentPaidTotal >= grandTotal) {
        toast({ title: "Error", description: `For "Partially Paid", the amount (${formatCurrency(currentPaidTotal)}) must be less than the grand total (${formatCurrency(grandTotal)}). Use "Paid" instead.`, variant: "destructive" });
        return;
      }
    }
    const payload = {
      vendorId,
      vendorName,
      items: validItems,
      status: "received",
      purchaseDate: new Date().toISOString().split("T")[0],
      receivedDate,
      notes,
      totalAmount: total,
      gstEnabled,
      gstType,
      cgstPercent: gstRate / 2,
      sgstPercent: gstRate / 2,
      cgstAmount: cgstAmt,
      sgstAmount: sgstAmt,
      grandTotal,
      paymentStatus,
      payments: paymentStatus === "unpaid" ? [] : paymentRecords.filter(r => r.amount > 0),
    };
    if (purchase) updateMutation.mutate(payload); else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Items list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Items</h3>
            <p className="text-xs text-muted-foreground">Each PPF line = one roll. Add multiple rows for multiple rolls/items.</p>
          </div>
          <Button data-testid="button-add-item" type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        </div>

        {/* Item chips — saved items as pill buttons */}
        {items.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setExpandedItemIdx(idx)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  expandedItemIdx === idx
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 text-foreground border-border/60 hover:bg-muted hover:border-border"
                }`}
              >
                <span className="uppercase text-[10px] font-bold opacity-70">{item.itemType}</span>
                <span>{item.name || `Item ${idx + 1}`}</span>
                {item.unitPrice > 0 && (
                  <span className={`opacity-60 ${expandedItemIdx === idx ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    · {formatCurrency(getItemCost(item))}
                  </span>
                )}
                <span
                  onClick={e => {
                    e.stopPropagation();
                    removeItem(idx);
                    setExpandedItemIdx(prev => {
                      if (prev === idx) return Math.max(0, idx - 1);
                      if (prev > idx) return prev - 1;
                      return prev;
                    });
                  }}
                  className={`ml-0.5 rounded-full hover:opacity-100 opacity-50 transition-opacity ${
                    expandedItemIdx === idx ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active item card — only one shown at a time */}
        {items[expandedItemIdx] && (
          <ItemRow
            key={expandedItemIdx}
            idx={expandedItemIdx}
            item={items[expandedItemIdx]}
            ppfMasters={ppfMasters}
            accessories={accessories}
            categories={categories}
            vehicleTypes={vehicleTypes}
            onChange={updateItem}
            onRemove={(i) => {
              removeItem(i);
              setExpandedItemIdx(prev => prev >= i ? Math.max(0, prev - 1) : prev);
            }}
          />
        )}

        <div className="flex justify-between items-center px-1 pt-3 border-t border-border/60">
          <span className="text-sm text-muted-foreground">{items.filter(i => i.name).length} item(s)</span>
          <div className="text-right">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Purchase Cost</p>
            <p className="text-base font-bold text-foreground mt-0.5">{formatCurrency(total)}</p>
          </div>
        </div>

        {/* GST Section */}
        <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">GST</span>
            <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-semibold">
              {(["none", "external", "internal"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  data-testid={`button-gst-${opt}`}
                  onClick={() => setGstType(opt)}
                  className={`px-3 py-1.5 transition-colors border-r last:border-r-0 border-border/60 ${
                    gstType === opt
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt === "none" ? "None" : opt === "external" ? "External" : "Internal"}
                </button>
              ))}
            </div>
          </div>

          {gstType !== "none" && (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">
                {gstType === "external"
                  ? "GST is added on top of the purchase cost"
                  : "GST is already included in the purchase cost"}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-[140px] space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">GST %</label>
                  <Input
                    data-testid="input-gst-percent"
                    className="h-9 text-sm"
                    type="number" min={0} max={100} step={0.01}
                    placeholder="e.g. 18"
                    value={gstPercent}
                    onChange={e => setGstPercent(e.target.value)}
                  />
                </div>
              </div>
              {gstRate > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Base (excl. GST)</span>
                    <span>{formatCurrency(baseAmount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST ({gstRate / 2}%)</span>
                    <span>{formatCurrency(cgstAmt)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST ({gstRate / 2}%)</span>
                    <span>{formatCurrency(sgstAmt)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-1.5 mt-1">
                    <span>Grand Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Received date + Notes */}
      <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border/40">
        <div className="space-y-1">
          <Label>Received Date</Label>
          <Input
            data-testid="input-received-date"
            type="date"
            value={receivedDate}
            onChange={e => setReceivedDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input
            data-testid="input-purchase-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Delivery in 3 days..."
          />
        </div>
      </div>

      {/* Payment Section */}
      <div className="space-y-4 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Payment</h3>
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg">
            {(["paid", "partially_paid", "unpaid"] as const).map(s => (
              <button
                key={s}
                type="button"
                data-testid={`button-payment-status-${s}`}
                onClick={() => setPaymentStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  paymentStatus === s
                    ? s === "paid" ? "bg-emerald-600 text-white shadow-sm"
                      : s === "partially_paid" ? "bg-amber-500 text-white shadow-sm"
                      : "bg-muted-foreground/80 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                }`}
              >
                {s === "paid" ? "Paid" : s === "partially_paid" ? "Partially Paid" : "Unpaid"}
              </button>
            ))}
          </div>
        </div>

        {paymentStatus !== "unpaid" && (
          <div className="space-y-3">
            {paymentRecords.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No payment records yet. Add one below.</p>
            )}
            {paymentRecords.map((record, i) => (
              <div key={i} className="grid grid-cols-[1fr_160px_140px_auto] gap-2 items-center">
                <Select value={record.method} onValueChange={v => updatePaymentRecord(i, "method", v)}>
                  <SelectTrigger data-testid={`select-payment-method-${i}`} className="h-9 text-sm">
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  data-testid={`input-payment-date-${i}`}
                  type="date"
                  value={record.date}
                  onChange={e => updatePaymentRecord(i, "date", e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  data-testid={`input-payment-amount-${i}`}
                  type="number"
                  min={0}
                  max={grandTotal}
                  placeholder="Amount (₹)"
                  value={record.amount || ""}
                  onChange={e => {
                    const entered = Number(e.target.value);
                    const otherTotal = paymentRecords.reduce((s, r, idx) => idx === i ? s : s + (Number(r.amount) || 0), 0);
                    const hardMax = grandTotal - otherTotal;
                    const maxAllowed = paymentStatus === "partially_paid"
                      ? Math.max(0, hardMax - 1)
                      : Math.max(0, hardMax);
                    const capped = Math.min(entered, maxAllowed);
                    updatePaymentRecord(i, "amount", capped);
                  }}
                  className={`h-9 text-sm ${record.amount > grandTotal ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => removePaymentRecord(i)}
                  className="h-9 w-9 flex items-center justify-center rounded border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="button-add-payment"
                onClick={addPaymentRecord}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Payment
              </Button>
              <div className="text-right text-sm">
                <span className="text-muted-foreground">Total paid: </span>
                <span className="font-bold text-foreground">{formatCurrency(paidTotal)}</span>
                <span className="text-muted-foreground"> / {formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button data-testid="button-save-purchase" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : purchase ? "Update Purchase" : "Record Purchase"}
        </Button>
      </div>
    </form>
  );
}

// ─── Full-Screen Purchase Panel ───────────────────────────────────────────────
interface PurchasePanelProps {
  vendor: Vendor;
  purchase?: VendorPurchase;
  onBack: () => void;
}

function PurchasePanel({ vendor, purchase, onBack }: PurchasePanelProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <button
          type="button"
          data-testid="button-back-to-vendors"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-foreground text-sm">{vendor.name}</span>
            {vendor.categories && vendor.categories.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">{vendor.categories.join(", ")}</span>
            )}
          </div>
        </div>
        {(vendor.phone || vendor.contactPerson) && (
          <>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              {vendor.contactPerson && <span>{vendor.contactPerson}</span>}
              {vendor.phone && <span className="font-mono">{vendor.phone}</span>}
            </div>
          </>
        )}
        <div className="ml-auto">
          <span className="text-sm font-medium text-muted-foreground">
            {purchase ? "Edit Purchase" : "New Purchase"}
          </span>
        </div>
      </div>

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          <PurchaseForm
            vendorId={vendor.id!}
            vendorName={vendor.name}
            purchase={purchase}
            onClose={onBack}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Vendor List Row ──────────────────────────────────────────────────────────
interface VendorListRowProps {
  vendor: Vendor;
  purchases: VendorPurchase[];
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onAddPurchase: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function VendorListRow({ vendor, purchases, onEdit, onDelete, onAddPurchase, onClick }: VendorListRowProps) {
  const vendorPurchases = purchases.filter(p => p.vendorId === vendor.id);
  const totalSpend = vendorPurchases.reduce((sum, p) => sum + getGrandTotal(p), 0);
  const lastPurchase = vendorPurchases.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];

  return (
    <tr
      data-testid={`row-vendor-${vendor.id}`}
      onClick={onClick}
      className="hover:bg-muted/30 transition-colors cursor-pointer border-b border-border/40 last:border-0"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p data-testid={`text-vendor-name-${vendor.id}`} className="font-semibold text-foreground text-sm">{vendor.name}</p>
            {vendor.categories && vendor.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {vendor.categories.map(c => (
                  <span key={c} className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          {vendor.contactPerson && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span data-testid={`text-vendor-contact-${vendor.id}`}>{vendor.contactPerson}</span>
            </div>
          )}
          {vendor.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span data-testid={`text-vendor-phone-${vendor.id}`}>{vendor.phone}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span data-testid={`text-vendor-email-${vendor.id}`} className="truncate max-w-[160px]">{vendor.email}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {vendor.address ? (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2 max-w-[180px]">{vendor.address}</span>
          </div>
        ) : <span className="text-xs text-muted-foreground/40">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <div>
          <p data-testid={`text-vendor-purchases-${vendor.id}`} className="text-sm font-semibold text-foreground">{vendorPurchases.length}</p>
          {lastPurchase && (
            <p className="text-[10px] text-muted-foreground">{formatDate(lastPurchase.purchaseDate || lastPurchase.receivedDate || "")}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p data-testid={`text-vendor-spend-${vendor.id}`} className="text-sm font-bold text-primary">{formatCurrency(totalSpend)}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <Button data-testid={`button-add-purchase-${vendor.id}`} size="sm" variant="outline" onClick={onAddPurchase} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Purchase
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Vendor Detail View ───────────────────────────────────────────────────────
interface VendorDetailViewProps {
  vendor: Vendor;
  purchases: VendorPurchase[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddPurchase: () => void;
  onEditPurchase: (p: VendorPurchase) => void;
}

function VendorDetailView({ vendor, purchases, onBack, onEdit, onDelete, onAddPurchase, onEditPurchase }: VendorDetailViewProps) {
  const { toast } = useToast();
  const [viewingPurchase, setViewingPurchase] = useState<VendorPurchase | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const vendorPurchases = purchases
    .filter(p => p.vendorId === vendor.id)
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  const totalSpend = vendorPurchases.reduce((sum, p) => sum + getGrandTotal(p), 0);

  const totalPages = Math.ceil(vendorPurchases.length / PAGE_SIZE);
  const pagedPurchases = vendorPurchases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deletePurchaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendor-purchases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-purchases"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/ppf"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/accessories"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/accessory-categories"] });
      toast({ title: "Purchase deleted" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="button-back-to-vendors"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vendors
        </button>
      </div>

      {/* Vendor Info Card */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 data-testid="text-detail-vendor-name" className="text-xl font-bold text-foreground">{vendor.name}</h2>
                  {vendor.categories && vendor.categories.length > 0 && vendor.categories.map(c => (
                    <span key={c} className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c}</span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {vendor.contactPerson && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{vendor.contactPerson}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{vendor.address}</span>
                    </div>
                  )}
                </div>
                {vendor.notes && (
                  <p className="mt-2 text-sm text-muted-foreground italic">{vendor.notes}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button data-testid="button-add-purchase-detail" onClick={onAddPurchase} size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Add Purchase
              </Button>
              <Button data-testid="button-edit-vendor-detail" size="icon" variant="outline" className="h-9 w-9" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button data-testid="button-delete-vendor-detail" size="icon" variant="outline" className="h-9 w-9 text-destructive hover:text-destructive border-destructive/30" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{vendorPurchases.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Purchases</p>
            </div>
            <div className="text-center border-x border-border/40">
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalSpend)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Spend</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {vendorPurchases[0] ? formatDate(vendorPurchases[0].purchaseDate || "") : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Last Purchase</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchases List */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Purchase History</h3>
        {vendorPurchases.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-border/60">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-25" />
            <p className="text-muted-foreground font-medium">No purchases yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Click "Add Purchase" to record the first purchase from this vendor</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. of Items</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Purchase Cost</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="px-4 py-3 w-28 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {pagedPurchases.map(p => (
                    <tr data-testid={`row-vendor-purchase-${p.id}`} key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-foreground">{p.receivedDate ? formatDate(p.receivedDate) : p.purchaseDate ? formatDate(p.purchaseDate) : "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">{p.items.length} item{p.items.length !== 1 ? "s" : ""}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatCurrency(getGrandTotal(p))}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const ps = (p as any).paymentStatus || "unpaid";
                          const payments: any[] = (p as any).payments || [];
                          const paidAmt = payments.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                          const methods = [...new Set(payments.filter(r => r.method).map(r => r.method))];
                          return (
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                ps === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : ps === "partially_paid" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"}`}>
                                {ps === "paid" ? "Paid" : ps === "partially_paid" ? "Partially Paid" : "Unpaid"}
                              </span>
                              {paidAmt > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(paidAmt)}{methods.length > 0 && ` · ${methods.join(", ")}`}</p>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button data-testid={`button-view-purchase-${p.id}`} size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => setViewingPurchase(p)}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button data-testid={`button-edit-purchase-${p.id}`} size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => onEditPurchase(p)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button data-testid={`button-delete-purchase-${p.id}`} size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deletePurchaseMutation.mutate(p.id!)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 border-t border-border/60">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-medium text-muted-foreground">
                      {vendorPurchases.length} purchase{vendorPurchases.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalSpend)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 px-1">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, vendorPurchases.length)} of {vendorPurchases.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                    <Button key={pg} size="sm" variant={pg === page ? "default" : "outline"}
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(pg)}>
                      {pg}
                    </Button>
                  ))}
                  <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Purchase Detail Dialog */}
      {viewingPurchase && (
        <Dialog open onOpenChange={() => setViewingPurchase(null)}>
          <DialogContent className="w-[95vw] max-w-[95vw] max-h-[92vh] overflow-y-auto">
            <DialogHeader className="pb-3 border-b border-border/40">
              <DialogTitle className="text-base font-semibold">Purchase Details</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 pt-1">
              {/* Meta: Vendor + Received Date + Purchase Cost */}
              <div className="grid grid-cols-3 divide-x divide-border/40 border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Vendor</p>
                  <p className="text-sm font-semibold text-foreground">{vendor.name}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Received Date</p>
                  <p className="text-sm font-semibold text-foreground">{viewingPurchase.receivedDate ? formatDate(viewingPurchase.receivedDate) : "—"}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Cost (incl. GST)</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(getGrandTotal(viewingPurchase))}</p>
                </div>
              </div>

              {/* Items — split by type */}
              {(() => {
                const ppfItems = viewingPurchase.items.filter((it: any) => it.itemType !== "Accessory");
                const accItems = viewingPurchase.items.filter((it: any) => it.itemType === "Accessory");
                return (
                  <div className="space-y-4">
                    {/* PPF Items Table — unchanged layout */}
                    {ppfItems.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">PPF Items</p>
                        <div className="rounded-xl border border-border/60 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border/40">
                              <tr>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Item / Brand</th>
                                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Roll / Batch</th>
                                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">HSN</th>
                                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Qty</th>
                                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Unit Price</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {ppfItems.map((item: any, i: number) => {
                                const qty = Number(item.quantity) || 1;
                                const rollCost = Number(item.unitPrice) || 0;
                                return (
                                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    </td>
                                    <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                      {item.rollName || "—"}
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      {item.hsnCode ? <span className="text-sm font-mono text-foreground">{item.hsnCode}</span> : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm text-foreground whitespace-nowrap">
                                      {qty} {item.unit}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm text-foreground whitespace-nowrap">
                                      {formatCurrency(rollCost)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground whitespace-nowrap">
                                      {formatCurrency(rollCost)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-muted/30 border-t border-border/50">
                              <tr>
                                <td colSpan={5} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                                  {ppfItems.length} roll{ppfItems.length !== 1 ? "s" : ""}
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground whitespace-nowrap">
                                  {formatCurrency(ppfItems.reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Accessory Items Table — improved with per-unit + totals */}
                    {accItems.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Accessory Items</p>
                        <div className="rounded-xl border border-border/60 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 border-b border-border/40">
                              <tr>
                                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Category</th>
                                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Item</th>
                                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">HSN</th>
                                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Qty</th>
                                <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Unit Price</th>
                                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Cost Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {accItems.map((item: any, i: number) => {
                                const qty = Number(item.quantity) || 0;
                                const unitPrice = Number(item.unitPrice) || 0;
                                const costTotal = unitPrice * qty;
                                return (
                                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-muted-foreground">{item.categoryName || "—"}</span>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                                    </td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      {item.hsnCode ? <span className="text-sm font-mono text-foreground">{item.hsnCode}</span> : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm text-foreground whitespace-nowrap">
                                      {qty} {item.unit || "pcs"}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm text-foreground whitespace-nowrap">
                                      {formatCurrency(unitPrice)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground whitespace-nowrap">
                                      {formatCurrency(costTotal)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-muted/30 border-t border-border/50">
                              <tr>
                                <td colSpan={5} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                                  {accItems.length} item{accItems.length !== 1 ? "s" : ""}
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground whitespace-nowrap">
                                  {formatCurrency(accItems.reduce((s: number, it: any) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* GST Breakdown */}
              {(viewingPurchase as any).gstEnabled && (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="bg-muted/40 border-b border-border/40 px-4 py-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">GST Breakdown</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                      {(viewingPurchase as any).gstType === "internal" ? "Internal" : "External"}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Base (excl. GST)</span>
                      <span className="font-medium text-foreground">
                        {(viewingPurchase as any).gstType === "internal"
                          ? formatCurrency(getPurchaseCost(viewingPurchase) / (1 + ((viewingPurchase as any).cgstPercent + (viewingPurchase as any).sgstPercent) / 100))
                          : formatCurrency(getPurchaseCost(viewingPurchase))
                        }
                      </span>
                    </div>
                    {(viewingPurchase as any).cgstPercent > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST ({(viewingPurchase as any).cgstPercent}%)</span>
                        <span className="font-medium text-foreground">{formatCurrency((viewingPurchase as any).cgstAmount || 0)}</span>
                      </div>
                    )}
                    {(viewingPurchase as any).sgstPercent > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST ({(viewingPurchase as any).sgstPercent}%)</span>
                        <span className="font-medium text-foreground">{formatCurrency((viewingPurchase as any).sgstAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground border-t border-border/60 pt-2 mt-1 text-base">
                      <span>Grand Total</span>
                      <span>{formatCurrency((viewingPurchase as any).grandTotal || getPurchaseCost(viewingPurchase))}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingPurchase.notes && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-foreground italic">{viewingPurchase.notes}</p>
                </div>
              )}

              {/* Payment Details */}
              {(() => {
                const ps = (viewingPurchase as any).paymentStatus || "unpaid";
                const payments: any[] = (viewingPurchase as any).payments || [];
                const paidAmt = payments.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                return (
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        ps === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : ps === "partially_paid" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"}`}>
                        {ps === "paid" ? "Paid" : ps === "partially_paid" ? "Partially Paid" : "Unpaid"}
                      </span>
                    </div>
                    {payments.length > 0 && (
                      <div className="rounded-lg border border-border/60 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 border-b border-border/40">
                            <tr>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Method</th>
                              <th className="text-left px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                              <th className="text-right px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {payments.map((r: any, i: number) => (
                              <tr key={i} className="hover:bg-muted/10">
                                <td className="px-4 py-2 text-xs text-muted-foreground">{i + 1}</td>
                                <td className="px-4 py-2 text-sm font-medium text-foreground">{r.method || "—"}</td>
                                <td className="px-4 py-2 text-sm text-muted-foreground">{r.date ? formatDate(r.date) : "—"}</td>
                                <td className="px-4 py-2 text-right text-sm font-semibold text-foreground">{formatCurrency(r.amount || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted/30 border-t border-border/50">
                            <tr>
                              <td colSpan={3} className="px-4 py-2 text-xs font-medium text-muted-foreground">Total Paid</td>
                              <td className="px-4 py-2 text-right text-sm font-bold text-foreground">{formatCurrency(paidAmt)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" onClick={() => setViewingPurchase(null)}>Close</Button>
                <Button onClick={() => { onEditPurchase(viewingPurchase); setViewingPurchase(null); }}>
                  <Edit2 className="h-4 w-4 mr-1.5" /> Edit Purchase
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Layout Toggle ────────────────────────────────────────────────────────────
function LayoutToggle({ value, onChange }: { value: "grid" | "list"; onChange: (v: "grid" | "list") => void }) {
  return (
    <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
      <button data-testid="button-layout-grid" onClick={() => onChange("grid")}
        className={`p-2 transition-colors ${value === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button data-testid="button-layout-list" onClick={() => onChange("list")}
        className={`p-2 transition-colors ${value === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorManagementPage() {
  const { toast } = useToast();
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [purchaseView, setPurchaseView] = useState<{ vendor: Vendor; purchase?: VendorPurchase } | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorSort, setVendorSort] = useState("name-asc");
  const [vendorFilter, setVendorFilter] = useState("all");

  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseSort, setPurchaseSort] = useState("date-desc");
  const [purchaseVendorFilter, setPurchaseVendorFilter] = useState("all");
  const [purchaseLayout, setPurchaseLayout] = useState<"grid" | "list">("list");

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<VendorPurchase[]>({ queryKey: ["/api/vendor-purchases"] });

  const deleteVendorMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-purchases"] });
      toast({ title: "Vendor deleted" });
    },
  });
  const deletePurchaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendor-purchases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-purchases"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/ppf"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/accessories"] });
      queryClient.refetchQueries({ queryKey: ["/api/masters/accessory-categories"] });
      toast({ title: "Purchase deleted" });
    },
  });

  const totalSpend = purchases.reduce((sum, p) => sum + getGrandTotal(p), 0);
  const thisMonth = purchases.filter(p => {
    const d = new Date(p.purchaseDate || p.createdAt || "");
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const filteredVendors = vendors
    .filter(v => {
      const cats = v.categories && v.categories.length > 0 ? v.categories : v.category ? [v.category] : [];
      const matchesSearch =
        v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        (v.contactPerson || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
        cats.some(c => c.toLowerCase().includes(vendorSearch.toLowerCase()));
      const matchesFilter = vendorFilter === "all" || cats.some(c => c.toLowerCase() === vendorFilter.toLowerCase());
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const aPurchases = purchases.filter(p => p.vendorId === a.id);
      const bPurchases = purchases.filter(p => p.vendorId === b.id);
      const aSpend = aPurchases.reduce((s, p) => s + getGrandTotal(p), 0);
      const bSpend = bPurchases.reduce((s, p) => s + getGrandTotal(p), 0);
      switch (vendorSort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "spend-desc": return bSpend - aSpend;
        case "spend-asc": return aSpend - bSpend;
        case "purchases-desc": return bPurchases.length - aPurchases.length;
        default: return 0;
      }
    });

  const filteredPurchases = purchases
    .filter(p => {
      const matchesSearch =
        (p.vendorName || "").toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        p.items.some((i: any) => i.name.toLowerCase().includes(purchaseSearch.toLowerCase()));
      const matchesVendor = purchaseVendorFilter === "all" || p.vendorId === purchaseVendorFilter;
      return matchesSearch && matchesVendor;
    })
    .sort((a, b) => {
      switch (purchaseSort) {
        case "date-desc": return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        case "date-asc": return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        case "amount-desc": return getGrandTotal(b) - getGrandTotal(a);
        case "amount-asc": return getGrandTotal(a) - getGrandTotal(b);
        case "vendor-asc": return (a.vendorName || "").localeCompare(b.vendorName || "");
        default: return 0;
      }
    });

  const filteredTotal = filteredPurchases.reduce((sum, p) => sum + getGrandTotal(p), 0);
  const uniqueVendors = vendors.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);

  // ── Full-screen Purchase Panel ───────────────────────────────────────────
  if (purchaseView) {
    return (
      <Layout>
        <div className="h-full flex flex-col overflow-hidden">
          <PurchasePanel
            vendor={purchaseView.vendor}
            purchase={purchaseView.purchase}
            onBack={() => setPurchaseView(null)}
          />
        </div>
      </Layout>
    );
  }

  // ── Vendor Detail View ───────────────────────────────────────────────────
  if (selectedVendor) {
    return (
      <Layout>
        <VendorDetailView
          vendor={selectedVendor}
          purchases={purchases}
          onBack={() => setSelectedVendor(null)}
          onEdit={() => { setEditingVendor(selectedVendor); }}
          onDelete={() => { deleteVendorMutation.mutate(selectedVendor.id!); setSelectedVendor(null); }}
          onAddPurchase={() => { setPurchaseView({ vendor: selectedVendor }); setSelectedVendor(null); }}
          onEditPurchase={(p) => { setPurchaseView({ vendor: selectedVendor, purchase: p }); setSelectedVendor(null); }}
        />
        {editingVendor && (
          <Dialog open onOpenChange={() => setEditingVendor(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
              <VendorForm vendor={editingVendor} onClose={() => { setEditingVendor(null); queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }); }} />
            </DialogContent>
          </Dialog>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Vendor Management</h1>
            <p className="text-muted-foreground mt-1">Track vendors, purchases, and inventory</p>
          </div>
          <Button data-testid="button-add-vendor" onClick={() => setIsAddVendorOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Vendor
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vendors</p>
                <p data-testid="stat-total-vendors" className="text-2xl font-bold">{vendors.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spend</p>
                <p data-testid="stat-total-spend" className="text-2xl font-bold text-green-600">{formatCurrency(totalSpend)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p data-testid="stat-this-month" className="text-2xl font-bold text-blue-600">{thisMonth}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vendors">
          <TabsList>
            <TabsTrigger value="vendors" data-testid="tab-vendors">Vendors</TabsTrigger>
            <TabsTrigger value="purchases" data-testid="tab-purchases">All Purchases</TabsTrigger>
          </TabsList>

          {/* ── Vendors Tab ─────────────────────────────────────────────── */}
          <TabsContent value="vendors" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search-vendor" className="pl-9" placeholder="Search vendors..."
                  value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} />
              </div>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger data-testid="select-vendor-filter" className="h-9 w-36 text-sm">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {VENDOR_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={vendorSort} onValueChange={setVendorSort}>
                <SelectTrigger data-testid="select-vendor-sort" className="h-9 w-44 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A → Z</SelectItem>
                  <SelectItem value="name-desc">Name Z → A</SelectItem>
                  <SelectItem value="spend-desc">Spend: High → Low</SelectItem>
                  <SelectItem value="spend-asc">Spend: Low → High</SelectItem>
                  <SelectItem value="purchases-desc">Most Purchases</SelectItem>
                </SelectContent>
              </Select>
              {(vendorSearch || vendorFilter !== "all") && (
                <p className="text-xs text-muted-foreground ml-1">{filteredVendors.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
              )}
            </div>

            {vendorsLoading ? (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                {[1, 2, 3].map(i => <div key={i} className="h-16 border-b border-border/40 bg-muted/20 animate-pulse" />)}
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground rounded-xl border border-dashed border-border/60">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{vendorSearch || vendorFilter !== "all" ? "No vendors match your filters" : "No vendors yet"}</p>
                {!vendorSearch && vendorFilter === "all" && <p className="text-sm mt-1">Click "Add Vendor" to get started</p>}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border/60">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Address</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Purchases</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Spend</th>
                      <th className="px-4 py-3 w-40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map(vendor => (
                      <VendorListRow
                        key={vendor.id}
                        vendor={vendor}
                        purchases={purchases}
                        onClick={() => setSelectedVendor(vendor)}
                        onEdit={(e) => { e.stopPropagation(); setEditingVendor(vendor); }}
                        onDelete={(e) => { e.stopPropagation(); deleteVendorMutation.mutate(vendor.id!); }}
                        onAddPurchase={(e) => { e.stopPropagation(); setPurchaseView({ vendor }); }}
                      />
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-muted/30 border-t border-border/60 text-xs text-muted-foreground">
                  {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""} — click a row to view details and purchase history
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── All Purchases Tab ────────────────────────────────────────── */}
          <TabsContent value="purchases" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input data-testid="input-search-purchase" className="pl-9" placeholder="Search purchases..."
                  value={purchaseSearch} onChange={e => setPurchaseSearch(e.target.value)} />
              </div>
              <Select value={purchaseVendorFilter} onValueChange={setPurchaseVendorFilter}>
                <SelectTrigger data-testid="select-purchase-vendor-filter" className="h-9 w-44 text-sm">
                  <SelectValue placeholder="Filter by vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {uniqueVendors.map(v => <SelectItem key={v.id} value={v.id!}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" />
              </div>
              <Select value={purchaseSort} onValueChange={setPurchaseSort}>
                <SelectTrigger data-testid="select-purchase-sort" className="h-9 w-44 text-sm">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date: Newest First</SelectItem>
                  <SelectItem value="date-asc">Date: Oldest First</SelectItem>
                  <SelectItem value="amount-desc">Amount: High → Low</SelectItem>
                  <SelectItem value="amount-asc">Amount: Low → High</SelectItem>
                  <SelectItem value="vendor-asc">Vendor A → Z</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto">
                <LayoutToggle value={purchaseLayout} onChange={setPurchaseLayout} />
              </div>
            </div>

            {(purchaseSearch || purchaseVendorFilter !== "all") && (
              <p className="text-xs text-muted-foreground">{filteredPurchases.length} of {purchases.length} purchase{purchases.length !== 1 ? "s" : ""}</p>
            )}

            {purchasesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : filteredPurchases.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{purchaseSearch || purchaseVendorFilter !== "all" ? "No purchases match your filters" : "No purchases recorded yet"}</p>
                {!purchaseSearch && purchaseVendorFilter === "all" && (
                  <p className="text-sm mt-1">Add a vendor and record purchases from their card</p>
                )}
              </div>
            ) : purchaseLayout === "grid" ? (
              <div className="space-y-2">
                {filteredPurchases.map(p => {
                  const vendor = vendors.find(v => v.id === p.vendorId);
                  return (
                    <div key={p.id} data-testid={`card-purchase-grid-${p.id}`}
                      className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{p.vendorName || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.receivedDate ? `Received: ${formatDate(p.receivedDate)}` : "Not yet received"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Cost / Sell</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(getPurchaseCost(p))} <span className="text-emerald-600 font-bold">/ {formatCurrency(getSellingTotal(p))}</span></p>
                          </div>
                          {vendor && (
                            <Button data-testid={`button-edit-purchase-tab-${p.id}`} size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setPurchaseView({ vendor, purchase: p })}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button data-testid={`button-delete-purchase-tab-${p.id}`} size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deletePurchaseMutation.mutate(p.id!)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 border-t border-border/40 pt-2">
                        {p.items.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                              {item.itemType && <span className="text-primary font-medium text-[10px] bg-primary/10 px-1 rounded">{item.itemType}</span>}
                              {item.categoryName && item.categoryName !== "PPF" && <span>{item.categoryName} › </span>}
                              <span className="text-foreground font-medium">{item.name}</span>
                              <span className="text-muted-foreground/70">×{item.quantity} {item.unit}</span>
                              {item.hsnCode && <span className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1 rounded border border-amber-200/50">HSN {item.hsnCode}</span>}
                            </span>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-muted-foreground">{formatCurrency(item.unitPrice || 0)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground italic">{p.notes}</p>}
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 border-t border-border/60">
                  <span className="text-sm text-muted-foreground">{filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? "s" : ""}</span>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Purchase Cost</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(filteredTotal)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border/60">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Items</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Cost / Sell</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredPurchases.map(p => {
                      const vendor = vendors.find(v => v.id === p.vendorId);
                      return (
                        <tr data-testid={`row-purchase-${p.id}`} key={p.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{p.vendorName || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="space-y-0.5">
                              {p.items.map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                                  {item.itemType && (
                                    <span className="text-primary font-medium text-[10px] bg-primary/10 px-1 rounded">{item.itemType}</span>
                                  )}
                                  {item.categoryName && item.categoryName !== "PPF" && <span>{item.categoryName} › </span>}
                                  <span>{item.name}</span>
                                  <span>×{item.quantity} {item.unit}</span>
                                  {item.hsnCode && <span className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1 rounded border border-amber-200/50">HSN {item.hsnCode}</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.receivedDate ? formatDate(p.receivedDate) : "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-sm text-muted-foreground">{formatCurrency(getPurchaseCost(p))}</p>
                            <p className="text-sm font-bold text-emerald-600">{formatCurrency(getSellingTotal(p))}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {vendor && (
                                <Button data-testid={`button-edit-purchase-row-${p.id}`} size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => setPurchaseView({ vendor, purchase: p })}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button data-testid={`button-delete-purchase-row-${p.id}`} size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deletePurchaseMutation.mutate(p.id!)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border/60">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-medium text-muted-foreground">
                        {filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? "s" : ""}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-right">
                        <p className="text-sm text-muted-foreground">Cost: {formatCurrency(filteredTotal)}</p>
                        <p className="text-sm font-bold text-emerald-600">Sell: {formatCurrency(filteredPurchases.reduce((sum, p) => sum + getSellingTotal(p), 0))}</p>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Vendor</DialogTitle></DialogHeader>
          <VendorForm onClose={() => setIsAddVendorOpen(false)} />
        </DialogContent>
      </Dialog>

      {editingVendor && (
        <Dialog open onOpenChange={() => setEditingVendor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
            <VendorForm vendor={editingVendor} onClose={() => setEditingVendor(null)} />
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
