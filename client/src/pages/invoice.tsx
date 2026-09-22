import { Layout } from "@/components/layout/layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Invoice, InvoiceItem } from "@shared/schema";
import { calculateGstAmounts, formatGstAmount, splitGstAmount } from "@shared/gst";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Loader2, Search, Trash2, Eye, ArrowUpDown, Printer, Send, Download, CalendarIcon, X as XIcon } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, useSearch } from "wouter";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import autoGammaLogo from "@assets/image_1769446487293.png";

const GOOGLE_REVIEW_URL = "https://g.page/r/CTZwMy1Ct5JZEBE/review";
const INSTAGRAM_URL = "https://www.instagram.com/auto_gamma_/?hl=en";

function DatePickerButton({
  value,
  onChange,
  placeholder = "Pick date",
  testId,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid={testId}
          className="h-9 w-36 justify-start gap-2 text-sm font-normal bg-white hover:bg-slate-50"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value ? format(new Date(value + "T00:00:00"), "dd MMM yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const BUSINESS_INFO: Record<string, { name: string; address: string; phone: string; email: string; website: string; logo: string | null }> = {
  "Auto Gamma": {
    name: "Auto Gamma",
    address: "Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, near Panvel Highway, beside Tulsi Aangan Soc, Katrap, Badlapur, Maharashtra 421503",
    phone: "+91 77380 16768",
    email: "support@autogamma.in",
    website: "www.autogamma.in",
    logo: autoGammaLogo,
  },
  "AGNX": {
    name: "AGNX",
    address: "Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, near Panvel Highway, beside Tulsi Aangan Soc, Katrap, Badlapur, Maharashtra 421503",
    phone: "+91 77380 16768",
    email: "support@autogamma.in",
    website: "www.autogamma.in",
    logo: null,
  }
};

function roundInvoiceCurrency(value: number | undefined) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function getInvoiceTotal(invoice: Invoice) {
  return roundInvoiceCurrency(invoice.totalAmount);
}

function getInvoicePaidAmount(invoice: Invoice) {
  return roundInvoiceCurrency(
    (invoice.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0),
  );
}

function getInvoiceRemaining(invoice: Invoice, additionalPaid = 0) {
  return Math.max(
    0,
    getInvoiceTotal(invoice) -
      getInvoicePaidAmount(invoice) -
      roundInvoiceCurrency(additionalPaid),
  );
}

function InvoiceHeader({ business, invoiceNo, date }: { business: string; invoiceNo: string; date?: string | Date }) {
  const businessInfo = BUSINESS_INFO[business];
  
  return (
    <div className="flex justify-between items-start border-b-2 border-red-600 pb-6 mb-6">
      {/* Left Side: Logo/Text and Business Details */}
      <div className="space-y-3">
        {business === "AGNX" ? (
          <div className="h-16 flex items-center">
            <span className="text-4xl font-black text-red-600 tracking-tighter italic">AGNX</span>
          </div>
        ) : (
          <img src={businessInfo.logo!} alt={businessInfo.name} className="h-16 object-contain" />
        )}
        <div className="text-sm text-slate-600 space-y-0.5 max-w-xs">
          {business !== "AGNX" && (
            <p><span className="font-semibold text-slate-700">ADDRESS:</span> {businessInfo.address}</p>
          )}
          <p><span className="font-semibold text-slate-700">CONTACT:</span> {businessInfo.phone}</p>
          {business !== "AGNX" && (
            <p><span className="font-semibold text-slate-700">MAIL:</span> {businessInfo.email}</p>
          )}
          {business !== "AGNX" && (
            <p><span className="font-semibold text-slate-700">WEBSITE:</span> {businessInfo.website}</p>
          )}
        </div>
      </div>
      
      {/* Right Side: Invoice Details */}
      <div className="text-right space-y-2">
        <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Invoice Details</p>
        <p className="text-2xl font-bold text-slate-900">#{invoiceNo}</p>
        <p className="text-slate-600">{format(new Date(date || new Date()), "dd MMM yyyy")}</p>
        {business === "Auto Gamma" && (
          <p className="text-xs font-bold text-slate-700">GST: 27ACEFA1874A1ZS</p>
        )}
      </div>
    </div>
  );
}

function InvoiceItemDetails({ item }: { item: InvoiceItem }) {
  const isPPF = item.type === "PPF";
  
  // Extract main name and details from parentheses if they exist
  let displayName = item.name;
  const match = item.name.match(/^(.*?)\s*\((.*?)\)([\s\S]*)$/);
  if (match) {
    displayName = match[1];
  }

  // Check for multi-line content (Quantity info added in add-job.tsx)
  const lines = item.name.split('\n');
  const quantityLines = lines.slice(1);
  const headerLine = lines[0];

  // If we have a newline, the header might have the parentheses we want to strip
  if (lines.length > 1) {
    const headerMatch = headerLine.match(/^(.*?)\s*\((.*?)\)$/);
    if (headerMatch) {
      displayName = headerMatch[1];
    } else {
      displayName = headerLine;
    }
  }

  return (
    <div className="space-y-1">
      <div className="font-bold text-slate-900">{displayName}</div>
      <div className="text-xs text-slate-500 space-y-0.5 pl-2 border-l-2 border-slate-200">
        {/* Quantity Info from name (multi-line) */}
        {quantityLines.map((line, i) => (
          <div key={i} className="text-slate-600 font-medium">{line.replace(/^[\s,]+/, '')}</div>
        ))}

        {isPPF && (
          <>
            {item.rollUsed && item.rollUsed > 0 && (
              <div className="font-medium text-slate-700">Total Sq.ft Roll Used: {item.rollUsed} sq.ft</div>
            )}
            {item.warranty && (
              <div><span className="font-medium text-slate-700">Warranty:</span> {item.warranty}</div>
            )}
          </>
        )}

        {item.type === "Service" && item.warranty && (
          <div><span className="font-medium text-slate-700">Warranty:</span> {item.warranty}</div>
        )}
        
        {item.type === "Accessory" && (
          <>
            {item.category && (
              <div><span className="font-medium text-slate-700">Category:</span> {item.category}</div>
            )}
            {item.quantity && item.quantity > 1 && (
              <div><span className="font-medium text-slate-700">Quantity:</span> {item.quantity}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PrintableInvoice({ invoice, elementId = "printable-invoice" }: { invoice: Invoice; elementId?: string }) {
  const businessInfo = BUSINESS_INFO[invoice.business];
  const gstPercentage = invoice.gstPercentage ?? 0;
  const halfGst = gstPercentage / 2;
  const discount = invoice.discount || 0;
  const laborCharge = invoice.laborCharge || 0;
  const nonLaborItems = invoice.items.filter(i => i.type !== "Labor");
  const invoicePaidAmount = getInvoicePaidAmount(invoice);
  const invoiceTotalAmount = getInvoiceTotal(invoice);
  const invoiceRemaining = Math.max(0, invoiceTotalAmount - invoicePaidAmount);
  
  return (
    <div className="print-invoice bg-white p-8" id={elementId}>
      <InvoiceHeader 
        business={invoice.business} 
        invoiceNo={invoice.invoiceNo} 
        date={invoice.date} 
      />


      {/* Bill To and Vehicle Details */}
      <div className="grid grid-cols-2 gap-8 mb-6 bg-slate-50 p-4 rounded-lg">
        <div className="space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Bill To</p>
          <p className="text-xl font-bold text-slate-900">{invoice.customerName}</p>
          <p className="text-slate-600">{invoice.phoneNumber}</p>
          {invoice.emailAddress && <p className="text-slate-600">{invoice.emailAddress}</p>}
          {(invoice as any).customerGstNumber && (
            <p className="text-slate-600 text-sm"><span className="font-semibold">GST:</span> {(invoice as any).customerGstNumber}</p>
          )}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Payment Status</p>
              <div className="space-y-3 mt-2">
                <div className="flex items-center gap-2">
                   <Badge className={invoicePaidAmount >= invoiceTotalAmount ? "bg-green-600 text-white" : "bg-yellow-500 text-white"}>
                     {invoicePaidAmount >= invoiceTotalAmount ? "PAID" : "PARTIAL"}
                  </Badge>
                   <span className="text-sm font-bold text-slate-700">₹{invoicePaidAmount.toLocaleString()}</span>
                </div>
                     {invoice.payments && invoice.payments.length > 0 && (
                  <div className="bg-white border rounded p-2 space-y-2">
                    {invoice.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{p.method}</span>
                          <span className="text-slate-400">{p.date ? format(new Date(p.date), "dd MMM yyyy") : "-"}</span>
                        </div>
                        <span className="font-black text-slate-900">₹{(p.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {invoiceRemaining > 0 && (
                      <div className="flex justify-between items-center pt-1 border-t border-red-100 text-red-600">
                        <span className="font-bold uppercase tracking-tighter text-[10px]">Remaining Balance</span>
                         <span className="font-black">₹{invoiceRemaining.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="text-right space-y-2">
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Vehicle Details</p>
          <div className="text-sm space-y-1">
            <p className="text-slate-600"><span className="font-semibold text-slate-700">Make / Model:</span> {invoice.vehicleMake || "-"} {invoice.vehicleModel || ""}</p>
            <p className="text-slate-600"><span className="font-semibold text-slate-700">Year:</span> {invoice.vehicleYear || "-"}</p>
            <p className="text-slate-600"><span className="font-semibold text-slate-700">License Plate:</span> {invoice.licensePlate || "-"}</p>
            {invoice.vehicleType && <p className="text-slate-600"><span className="font-semibold text-slate-700">Type:</span> {invoice.vehicleType}</p>}
          </div>
        </div>
      </div>

      {/* Service Items Table */}
      <div className="mb-6">
        <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3">Service Items</p>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-900 text-white">
              <TableHead className="text-white font-bold">Sr No.</TableHead>
              <TableHead className="text-white font-bold">Description</TableHead>
              <TableHead className="text-white font-bold">Type</TableHead>
              <TableHead className="text-white font-bold">HSN</TableHead>
              <TableHead className="text-right text-white font-bold">Rate</TableHead>
              <TableHead className="text-center text-white font-bold">Qty</TableHead>
              <TableHead className="text-right text-white font-bold">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nonLaborItems.map((item, idx) => (
              <TableRow key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <TableCell className="font-medium text-slate-600">{idx + 1}</TableCell>
                <TableCell>
                  <InvoiceItemDetails item={item} />
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] uppercase bg-slate-200 text-slate-700"
                  >
                    {item.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">{item.hsnCode || "-"}</TableCell>
                <TableCell className="text-right">₹{item.price.toLocaleString()}</TableCell>
                <TableCell className="text-center">{item.quantity || 1}</TableCell>
                <TableCell className="text-right font-bold">
                  ₹{(item.price * (item.quantity || 1)).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary Section */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm space-y-2 bg-slate-50 p-4 rounded-lg">
          <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
            <span className="font-medium">Base Amount</span>
            <span className="font-bold">₹{(invoice.subtotal - laborCharge).toLocaleString()}</span>
          </div>

          {laborCharge > 0 && (
            <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
              <span className="font-medium">Labor Charges</span>
              <span className="font-bold">₹{laborCharge.toLocaleString()}</span>
            </div>
          )}
          
          {discount > 0 && (
            <div className="flex justify-between text-green-600 pb-2 border-b border-slate-200">
              <span className="font-medium">Discount</span>
              <span className="font-bold">(-) ₹{discount.toLocaleString()}</span>
            </div>
          )}

          {(() => {
            const grandTotal = invoice.subtotal - (invoice.discount || 0);
            // AGNX is not GST-registered — never show GST regardless of stored value
            const gstRate = invoice.business === "AGNX" ? 0 : (invoice.gstPercentage ?? 0);
            const isGstIncluded =
              invoice.gstMode === "inclusive" ||
              (invoice.gstMode !== "exclusive" &&
              gstRate > 0 &&
              Math.abs((invoice.totalAmount ?? grandTotal) - grandTotal) < 0.01);
            const {
              taxableSubtotal,
              gstAmount,
              totalAmount,
            } = calculateGstAmounts(
              grandTotal,
              gstRate,
              isGstIncluded ? "inclusive" : "exclusive",
            );
            const displayedSubtotal = isGstIncluded ? grandTotal : taxableSubtotal;
            const { sgstAmount, cgstAmount } = splitGstAmount(gstAmount);

            return (
              <>
                <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                  <span className="font-medium">
                    SubTotal{isGstIncluded ? " (GST included)" : ""}
                  </span>
                  <span className="font-bold">₹{Math.round(displayedSubtotal).toLocaleString()}</span>
                </div>

                {gstRate > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span className="font-medium">(+) SGST: {(gstRate / 2).toFixed(2)}%</span>
                      <span className="font-bold">₹{formatGstAmount(sgstAmount)}</span>
                    </div>

                    <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                      <span className="font-medium">(+) CGST: {(gstRate / 2).toFixed(2)}%</span>
                      <span className="font-bold">₹{formatGstAmount(cgstAmount)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center pt-2 text-xl font-black text-red-600">
                  <span className="uppercase tracking-tighter">Grand Total</span>
                  <span>₹{Math.round(totalAmount).toLocaleString()}</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 italic">
          Please Note: Please be advised that the booking amount mentioned in this invoice is non-refundable. 
          This amount secures your reservation and cannot be returned in case of cancellation or modification.
        </p>
        <div className="mt-6 text-center">
          <p className="text-lg font-bold text-slate-700">Thank You For Your Business</p>
        </div>
      </div>
    </div>
  );
}

// Helper function to determine payment status
function getPaymentStatus(invoice: Invoice): { status: 'Paid' | 'Partial Paid' | 'Unpaid'; paidAmount: number } {
  const totalAmount = getInvoiceTotal(invoice);
  const paidAmount = getInvoicePaidAmount(invoice);
  
  if (paidAmount === 0) {
    return { status: 'Unpaid', paidAmount: 0 };
  } else if (paidAmount >= totalAmount) {
    return { status: 'Paid', paidAmount };
  } else {
    return { status: 'Partial Paid', paidAmount };
  }
}

export default function InvoicePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Invoice; direction: 'asc' | 'desc' } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showKioskReview, setShowKioskReview] = useState(false);
  const [isSendingKioskInvoice, setIsSendingKioskInvoice] = useState(false);
  const [reviewQrCodes, setReviewQrCodes] = useState({ google: "", instagram: "" });
  const [showPaymentDialog, setShowViewPaymentDialog] = useState(false);
  const [newPayments, setNewPayments] = useState<{ amount: number | string; method: string; date: string }[]>([
    { amount: "", method: "Cash", date: new Date().toISOString().split('T')[0] }
  ]);

  const handleAddPaymentRow = () => {
    setNewPayments([...newPayments, { amount: "", method: "Cash", date: new Date().toISOString().split('T')[0] }]);
  };

  const handleRemovePaymentRow = (index: number) => {
    if (newPayments.length > 1) {
      setNewPayments(newPayments.filter((_, i) => i !== index));
    }
  };

  const handlePaymentRowChange = (index: number, field: string, value: any) => {
    const updated = [...newPayments];
    if (field === "amount") {
      const sanitizedValue = String(value).replace(/[^0-9.]/g, "");
      updated[index] = { ...updated[index], [field]: sanitizedValue === "" ? "" : sanitizedValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setNewPayments(updated);
  };

  const resetPaymentDialog = () => {
    setNewPayments([{ amount: "", method: "Cash", date: new Date().toISOString().split('T')[0] }]);
  };

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: { payments: { amount: number; method: string; date: string }[] } }) => {
      const currentInvoice = invoices.find(inv => inv.id === id);
      if (!currentInvoice) throw new Error("Invoice not found");
      
      const existingPayments = currentInvoice.payments || [];
      const updatedPayments = [...existingPayments, ...data.payments];
      const totalPaid = updatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const isFullyPaid = totalPaid >= (currentInvoice.totalAmount || 0);

      await apiRequest("PATCH", `/api/invoices/${id}`, {
        payments: updatedPayments,
        isPaid: isFullyPaid
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Success", description: "Payment recorded successfully" });
      setShowViewPaymentDialog(false);
      resetPaymentDialog();
    },
    onError: (error: any) => {
      toast({ title: "Payment Failed", description: error.message || "Failed to record payment", variant: "destructive" });
    },
  });

  const { phone: customerPhone } = useParams<{ phone: string }>();
  const isKioskInvoice = new URLSearchParams(useSearch()).get("kiosk") === "1";
  const [showViewDialog, setShowViewDialog] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      QRCode.toDataURL(GOOGLE_REVIEW_URL, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "H",
      }),
      QRCode.toDataURL(INSTAGRAM_URL, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "H",
      }),
    ]).then(([google, instagram]) => {
      if (!cancelled) {
        setReviewQrCodes({ google, instagram });
      }
    }).catch((error) => {
      console.error("Failed to generate review QR codes:", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (customerPhone && invoices.length > 0) {
      if (isKioskInvoice) {
        const kioskInvoices = invoices.filter(inv => inv.jobCardId === customerPhone);
        setSelectedInvoice(kioskInvoices[0] || null);
        setShowViewDialog(false);
      } else {
        const invoice = invoices.find(inv => inv.id === customerPhone);
        if (invoice) {
          setSelectedInvoice(invoice);
          setShowViewDialog(true);
        }
      }
    }
  }, [customerPhone, invoices, isKioskInvoice]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/ppf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Success", description: "Invoice deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(inv => 
        inv.invoiceNo.toLowerCase().includes(lowerSearch) ||
        inv.customerName.toLowerCase().includes(lowerSearch) ||
        inv.phoneNumber.toLowerCase().includes(lowerSearch)
      );
    }

    // Business Filter
    if (businessFilter !== "all") {
      result = result.filter(inv => inv.business === businessFilter);
    }

    // Date Range Filter
    if (fromDate) {
      result = result.filter(inv => {
        if (!inv.date) return false;
        return inv.date.substring(0, 10) >= fromDate;
      });
    }
    if (toDate) {
      result = result.filter(inv => {
        if (!inv.date) return false;
        return inv.date.substring(0, 10) <= toDate;
      });
    }

    // Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? "";
        const bValue = b[sortConfig.key] ?? "";
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [invoices, searchTerm, businessFilter, fromDate, toDate, sortConfig]);

  const handleSort = (key: keyof Invoice) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleView = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewDialog(true);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-print-root');
    if (!printContent) {
      toast({
        title: "Print unavailable",
        description: "The invoice content is not ready yet. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const cleanupPrintMode = () => {
      document.body.classList.remove("invoice-printing");
      window.removeEventListener("afterprint", cleanupPrintMode);
    };

    document.body.classList.add("invoice-printing");
    window.addEventListener("afterprint", cleanupPrintMode);

    // Wait for the print-only styles to be applied before opening the preview.
    requestAnimationFrame(() => window.print());
  };

  const handleSendKioskInvoice = async () => {
    if (!selectedInvoice?.id || isSendingKioskInvoice) return;

    setIsSendingKioskInvoice(true);
    try {
      const response = await apiRequest("POST", `/api/invoices/${selectedInvoice.id}/send-whatsapp`);
      const result = await response.json();
      toast({
        title: "Invoice sent",
        description: `Invoice ${result.invoiceNo || selectedInvoice.invoiceNo} was sent to ${selectedInvoice.customerName} on WhatsApp.`,
      });
      setShowKioskReview(true);
    } catch (error: any) {
      toast({
        title: "Unable to send invoice",
        description: error?.message || "Please check the WhatsApp Business setup and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingKioskInvoice(false);
    }
  };

  const downloadExcel = (businessType: "Auto Gamma" | "AGNX", sourceInvoices?: Invoice[]) => {
    const pool = sourceInvoices ?? invoices;
    const businessInvoices = pool.filter(inv => inv.business === businessType);
    
    if (businessInvoices.length === 0) {
      toast({
        title: "No data",
        description: `No invoices found for ${businessType}`,
        variant: "destructive"
      });
      return;
    }

    const excelData: Record<string, any>[] = [];

    businessInvoices.forEach(inv => {
      const { status, paidAmount } = getPaymentStatus(inv);
      const invoiceTotal = getInvoiceTotal(inv);
      const paid = paidAmount || 0;
      const remaining = Math.max(0, invoiceTotal - paid);
      const formattedDate = inv.date ? format(new Date(inv.date), "dd MMM yyyy") : "N/A";

      const items = inv.items && inv.items.length > 0 ? inv.items : [null];

      items.forEach((item, idx) => {
        excelData.push({
          "Invoice Number": idx === 0 ? (inv.invoiceNo || "N/A") : "",
          "Date": idx === 0 ? formattedDate : "",
          "Business Category": idx === 0 ? (inv.business || "N/A") : "",
          "Customer Name": idx === 0 ? (inv.customerName || "N/A") : "",
          "Mobile Number": idx === 0 ? (inv.phoneNumber || "N/A") : "",
          "Item Type": item ? (item.type || "Service") : "",
          "Item Name": item ? (item.name || "") : "No items",
          "HSN Code": item ? (item.hsnCode || "-") : "-",
          "Category": item ? (item.category || "-") : "-",
          "Warranty": item ? (item.warranty || "-") : "-",
          "Quantity": item ? (item.quantity ?? 1) : "",
          "Unit Price (₹)": item ? (item.price || 0) : "",
          "Invoice Total (₹)": idx === 0 ? invoiceTotal : "",
          "Paid Amount (₹)": idx === 0 ? paid : "",
          "Remaining Balance (₹)": idx === 0 ? remaining : "",
          "Payment Status": idx === 0 ? status : "",
        });
      });
    });

    try {
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      const colWidths = [18, 14, 18, 20, 16, 12, 30, 12, 20, 20, 10, 16, 18, 14, 20, 16];
      worksheet["!cols"] = colWidths.map(wch => ({ wch }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
      
      if (!worksheet['!ref']) {
        throw new Error("Worksheet reference is empty - no data was written");
      }

      const fileName = `${businessType.replace(/\s+/g, '_')}_Invoices_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: "Success",
        description: `Excel downloaded for ${businessType}`
      });
    } catch (error) {
      console.error("Excel generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate Excel file. Check console for details.",
        variant: "destructive"
      });
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '800px';
    document.body.appendChild(tempDiv);

    const root = document.createElement('div');
    const isAGNX = invoice.business === "AGNX";
    root.innerHTML = `
      <div class="print-invoice bg-white p-8" style="width: 800px; font-family: Arial, sans-serif;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #dc2626; padding-bottom: 24px; margin-bottom: 24px;">
          <div>
            ${isAGNX ? 
              `<div style="height: 64px; display: flex; align-items: center;">
                <span style="font-size: 36px; font-weight: 900; color: #dc2626; font-style: italic; letter-spacing: -2px;">AGNX</span>
              </div>` :
              `<h2 style="font-size: 24px; font-weight: bold; color: #1e293b;">${invoice.business}</h2>`
            }
            <p style="font-size: 12px; color: #64748b; max-width: 300px;">Shop no. 09 & 10, Shreeji Parasio, Prasad Hotel Road, Badlapur, Maharashtra 421503</p>
            <p style="font-size: 12px; color: #64748b;">Contact: +91 77380 16768</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: bold; color: #dc2626; text-transform: uppercase;">Invoice Details</p>
            <p style="font-size: 20px; font-weight: bold; color: #1e293b;">#${invoice.invoiceNo}</p>
            <p style="color: #64748b;">${format(new Date(invoice.date || new Date()), "dd MMM yyyy")}</p>
            ${invoice.business === "Auto Gamma" ? `<p style="font-size: 10px; font-weight: bold; color: #334155;">GST: 27ACEFA1874A1ZS</p>` : ""}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px;">
          <div>
            <p style="font-size: 10px; font-weight: bold; color: #dc2626; text-transform: uppercase;">Bill To</p>
            <p style="font-size: 18px; font-weight: bold; color: #1e293b;">${invoice.customerName}</p>
            <p style="color: #64748b;">${invoice.phoneNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 10px; font-weight: bold; color: #dc2626; text-transform: uppercase;">Vehicle Details</p>
            <p style="color: #64748b;">${invoice.vehicleMake || '-'} ${invoice.vehicleModel || ''}</p>
            <p style="color: #64748b;">License: ${invoice.licensePlate || '-'}</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="background: #1e293b; color: white;">
              <th style="padding: 12px; text-align: left;">Item</th>
              <th style="padding: 12px; text-align: left;">Type</th>
              <th style="padding: 12px; text-align: left;">HSN</th>
              <th style="padding: 12px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.filter(i => i.type !== "Labor").map((item, idx) => `
              <tr style="background: ${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                  ${item.name}
                  ${item.warranty ? `<div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: #dc2626;">Warranty: ${item.warranty}</div>` : ""}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${item.type}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 12px; color: #475569;">${item.hsnCode || '-'}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0;">₹${(item.price * (item.quantity || 1)).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="display: flex; justify-content: flex-end;">
          <div style="width: 300px; background: #f8fafc; padding: 16px; border-radius: 8px;">
            ${(() => {
              const grandTotal = invoice.subtotal - (invoice.discount || 0);
              // AGNX is not GST-registered — never show GST regardless of stored value
              const gstRate = invoice.business === "AGNX" ? 0 : (invoice.gstPercentage ?? 0);
              const isGstIncluded =
                invoice.gstMode === "inclusive" ||
                (invoice.gstMode !== "exclusive" &&
                gstRate > 0 &&
                Math.abs((invoice.totalAmount ?? grandTotal) - grandTotal) < 0.01);
              const {
                taxableSubtotal,
                gstAmount,
                totalAmount,
              } = calculateGstAmounts(
                grandTotal,
                gstRate,
                isGstIncluded ? "inclusive" : "exclusive",
              );
              const displayedSubtotal = isGstIncluded ? grandTotal : taxableSubtotal;
              const { sgstAmount, cgstAmount } = splitGstAmount(gstAmount);
              return `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span>Subtotal${isGstIncluded ? " (GST included)" : ""}</span>
              <span style="font-weight: bold;">₹${Math.round(displayedSubtotal).toLocaleString()}</span>
            </div>
            ${gstRate > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span>(+) SGST: ${(gstRate / 2).toFixed(2)}%</span>
                <span style="font-weight: bold;">₹${formatGstAmount(sgstAmount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
              <span>(+) CGST: ${(gstRate / 2).toFixed(2)}%</span>
                <span style="font-weight: bold;">₹${formatGstAmount(cgstAmount)}</span>
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: bold; color: #dc2626;">
              <span>GRAND TOTAL</span>
              <span>₹${Math.round(totalAmount).toLocaleString()}</span>
            </div>`;
            })()}
          </div>
        </div>
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 16px; font-weight: bold; color: #64748b;">Thank You For Your Business</p>
        </div>
      </div>
    `;
    tempDiv.appendChild(root);

    try {
      toast({ title: "Generating PDF...", description: "Please wait while the invoice is being prepared." });
      
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Invoice_${invoice.invoiceNo}</title><style>body{margin:0;padding:0;}img{width:100%;height:auto;display:block;}@media print{body{margin:0;}}</style></head><body><img src="${imgData}" /></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
      }

      let phoneNumber = invoice.phoneNumber.replace(/\D/g, '');
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '91' + phoneNumber.substring(1);
      } else if (!phoneNumber.startsWith('91')) {
        phoneNumber = '91' + phoneNumber;
      }

      const message = encodeURIComponent(
        `Hello ${invoice.customerName},\n\nPlease find your invoice #${invoice.invoiceNo} for ₹${invoice.subtotal.toLocaleString()}.\n\nThank you for choosing ${invoice.business}!`
      );

      window.open(`https://web.whatsapp.com/send?phone=${phoneNumber}&text=${message}`, '_blank');
      
      toast({ 
        title: "PDF Downloaded!", 
        description: "WhatsApp is opening. Please attach the downloaded PDF to send it." 
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ 
        title: "Error", 
        description: "Failed to generate PDF. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  if (isLoading) {
    if (isKioskInvoice) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      );
    }
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isKioskInvoice) {
    const kioskInvoices = customerPhone
      ? invoices.filter(inv => inv.jobCardId === customerPhone)
      : [];
    const kioskInvoice = kioskInvoices[0] || null;

    if (showKioskReview) {
      return (
        <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
          <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col items-center justify-center gap-6">
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-900">Thank You</h1>
              <p className="mt-2 text-sm text-slate-500">Please scan and share your experience with us.</p>
            </div>

            <div className="grid w-full gap-5 sm:grid-cols-2">
              <a
                href={GOOGLE_REVIEW_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                {reviewQrCodes.google ? (
                  <img
                    src={reviewQrCodes.google}
                    alt="Scan to leave an Auto Gamma Google review"
                    className="mx-auto h-52 w-52 rounded-lg"
                  />
                ) : (
                  <div className="mx-auto h-52 w-52 animate-pulse rounded-lg bg-slate-100" />
                )}
                <p className="mt-4 text-lg font-bold text-slate-900">Google Review</p>
                <p className="mt-1 text-sm text-slate-500">Scan to rate your experience</p>
              </a>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                {reviewQrCodes.instagram ? (
                  <img
                    src={reviewQrCodes.instagram}
                    alt="Scan to follow Auto Gamma on Instagram"
                    className="mx-auto h-52 w-52 rounded-lg"
                  />
                ) : (
                  <div className="mx-auto h-52 w-52 animate-pulse rounded-lg bg-slate-100" />
                )}
                <p className="mt-4 text-lg font-bold text-slate-900">Instagram</p>
                <p className="mt-1 text-sm text-slate-500">Scan to follow Auto Gamma</p>
              </a>
            </div>

            <Button
              type="button"
              className="h-12 w-full max-w-md bg-red-600 font-bold hover:bg-red-700"
              onClick={() => setLocation("/selfkiosk?mode=checkin")}
            >
              Start New Check-In
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6">
        {selectedInvoice && typeof document !== "undefined" &&
          createPortal(
            <div id="invoice-print-root" aria-hidden="true">
              <PrintableInvoice invoice={selectedInvoice} elementId="printable-invoice" />
            </div>,
            document.body,
          )}
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {kioskInvoices.length > 0 ? (
            <>
              <div className="space-y-5">
                {kioskInvoices.map((invoice) => (
                  <div key={invoice.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <PrintableInvoice invoice={invoice} elementId={`kiosk-invoice-preview-${invoice.id}`} />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => setShowKioskReview(true)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  className="h-12 flex-1 bg-red-600 font-bold hover:bg-red-700"
                  onClick={handleSendKioskInvoice}
                  disabled={isSendingKioskInvoice}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSendingKioskInvoice ? "Sending..." : "Send"}
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                Invoice is being prepared. Please wait a moment and refresh this screen.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Top bar: Title | Date Range | Business | Download buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold mr-2">Invoices</h1>

          {/* From date */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">From</label>
            <DatePickerButton
              value={fromDate}
              onChange={setFromDate}
              placeholder="Start date"
              testId="input-from-date"
            />
          </div>

          {/* To date */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">To</label>
            <DatePickerButton
              value={toDate}
              onChange={setToDate}
              placeholder="End date"
              testId="input-to-date"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-xs text-slate-400 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}

          {/* Business filter */}
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="h-9 w-40 text-sm" data-testid="select-business-filter">
              <SelectValue placeholder="All Businesses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Businesses</SelectItem>
              <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
              <SelectItem value="AGNX">AGNX</SelectItem>
            </SelectContent>
          </Select>

          {/* Download buttons */}
          <Button
            variant="outline"
            onClick={() => downloadExcel("Auto Gamma", filteredInvoices)}
            className="h-9 bg-white border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 gap-2 text-sm"
            data-testid="button-download-autogamma"
          >
            <Download className="h-4 w-4" />
            Auto Gamma ({filteredInvoices.filter(i => i.business === "Auto Gamma").length})
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadExcel("AGNX", filteredInvoices)}
            className="h-9 bg-white border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 gap-2 text-sm"
            data-testid="button-download-agnx"
          >
            <Download className="h-4 w-4" />
            AGNX ({filteredInvoices.filter(i => i.business === "AGNX").length})
          </Button>
        </div>

        {/* Search bar */}
        <div className="flex flex-col gap-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by invoice no, customer name..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-invoices"
            />
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle>Invoice List</CardTitle>
            <Badge variant="outline">{filteredInvoices.length} Found</Badge>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('invoiceNo')}>
                    <div className="flex items-center gap-2">
                      Invoice No <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('business')}>
                    <div className="flex items-center gap-2">
                      Business <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('customerName')}>
                    <div className="flex items-center gap-2">
                      Customer <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-2">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-50" onClick={() => handleSort('totalAmount')}>
                    <div className="flex items-center gap-2 justify-end">
                      Total Amount <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No invoices found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/50" data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                      <TableCell>
                        <Badge variant={inv.business === "Auto Gamma" ? "destructive" : "outline"} className={inv.business === "Auto Gamma" ? "bg-red-600" : ""}>
                          {inv.business}
                        </Badge>
                      </TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell>{format(new Date(inv.date || new Date()), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                         ₹{getInvoiceTotal(inv).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const { status, paidAmount } = getPaymentStatus(inv);
                          const badgeColor = status === 'Paid' ? 'bg-green-600' : status === 'Partial Paid' ? 'bg-amber-600' : undefined;
                          
                          return (
                            <div className="space-y-1">
                              <Badge className={`${badgeColor} text-white hover:opacity-90`}>
                                {status}
                              </Badge>
                              <div className="text-[10px] text-slate-500 leading-tight">
                                {paidAmount > 0 && (
                                  <div className="text-green-700 font-medium">Paid: ₹{paidAmount.toLocaleString()}</div>
                                )}
                                {getInvoiceRemaining(inv) > 0 && (
                                  <div className="text-red-500 font-medium">Due: ₹{getInvoiceRemaining(inv).toLocaleString()}</div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {getPaymentStatus(inv).status !== 'Paid' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setShowViewPaymentDialog(true);
                              }}
                            >
                              Mark Paid
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleView(inv)} 
                            className="h-8 w-8"
                            data-testid={`button-view-invoice-${inv.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleSendWhatsApp(inv)}
                            data-testid={`button-send-whatsapp-${inv.id}`}
                            title="Send via WhatsApp"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (inv.id && window.confirm("Are you sure you want to delete this invoice? This will also restore any PPF roll quantities consumed.")) {
                                deleteMutation.mutate(inv.id);
                              }
                            }}
                            data-testid={`button-delete-invoice-${inv.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Render the print copy directly under <body>. Keeping it outside the
          flex/scrolling app shell prevents hidden application content from
          contributing extra print pages. */}
      {selectedInvoice && typeof document !== "undefined" &&
        createPortal(
          <div id="invoice-print-root" aria-hidden="true">
            <PrintableInvoice invoice={selectedInvoice} elementId="printable-invoice" />
          </div>,
          document.body,
        )}

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center justify-between">
              <span>Invoice Detail</span>
              <Badge variant={selectedInvoice?.business === "Auto Gamma" ? "destructive" : "outline"} className={selectedInvoice?.business === "Auto Gamma" ? "bg-red-600" : "text-lg px-4 py-1"}>
                {selectedInvoice?.business}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div ref={printRef}>
              <PrintableInvoice invoice={selectedInvoice} elementId="invoice-preview-content" />
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowViewDialog(false)} data-testid="button-close-invoice">
              Close
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handlePrint}
              data-testid="button-print-invoice"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={(open) => {
        setShowViewPaymentDialog(open);
        if (!open) resetPaymentDialog();
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 uppercase font-bold mb-1">
                <span>Invoice Total</span>
                <span>Total Paid</span>
                <span>Remaining</span>
              </div>
              <div className="flex justify-between text-lg font-black">
                <span className="text-slate-900">₹{selectedInvoice ? getInvoiceTotal(selectedInvoice).toLocaleString() : "0"}</span>
                <span className="text-green-600">₹{((selectedInvoice?.payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0) + newPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)).toLocaleString()}</span>
                <span className="text-red-600">₹{(selectedInvoice ? getInvoiceRemaining(selectedInvoice, newPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)) : 0).toLocaleString()}</span>
              </div>
            </div>

            {selectedInvoice?.payments && selectedInvoice.payments.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment History</h5>
                {selectedInvoice.payments.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-green-50 border border-green-100 px-3 py-2 rounded-md text-sm">
                    <div className="flex gap-3 text-slate-600">
                      <span className="font-medium">{p.method}</span>
                      <span className="text-slate-400">·</span>
                      <span>{p.date}</span>
                    </div>
                    <span className="font-bold text-green-700">₹{Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Add New Payment</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddPaymentRow}
                  className="h-8"
                  data-testid="button-add-payment-method"
                >
                  Add Payment Method
                </Button>
              </div>

              {newPayments.map((payment, index) => (
                <div key={index} className="flex flex-row items-end gap-3 bg-slate-50 p-3 rounded-md relative group">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Method</label>
                    <Select 
                      value={payment.method} 
                      onValueChange={(val) => handlePaymentRowChange(index, "method", val)}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-payment-method-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI / GPay">UPI / GPay</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Date</label>
                    <Input
                      type="date"
                      value={payment.date}
                      onChange={(e) => handlePaymentRowChange(index, "date", e.target.value)}
                      className="h-9"
                      data-testid={`input-payment-date-${index}`}
                    />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Amount</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={payment.amount}
                      onChange={(e) => handlePaymentRowChange(index, "amount", e.target.value)}
                      placeholder="0"
                      className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      data-testid={`input-payment-amount-${index}`}
                    />
                  </div>
                  <div className="flex-none">
                    {newPayments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemovePaymentRow(index)}
                        className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50"
                        data-testid={`button-remove-payment-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewPaymentDialog(false)} data-testid="button-cancel-payment">Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
              data-testid="button-confirm-payment"
              onClick={() => {
                if (selectedInvoice?.id) {
                  const validPayments = newPayments
                    .filter(p => Number(p.amount) > 0)
                    .map(p => ({
                      amount: Number(p.amount),
                      method: p.method,
                      date: p.date
                    }));
                  
                  if (validPayments.length === 0) {
                    toast({ title: "Invalid Amount", description: "Please enter at least one valid payment amount", variant: "destructive" });
                    return;
                  }
                  
                  const totalNewPayments = validPayments.reduce((sum, p) => sum + p.amount, 0);
                  const remaining = getInvoiceRemaining(selectedInvoice);
                  
                  if (totalNewPayments > remaining + 1) {
                    toast({ title: "Amount Exceeded", description: `Total amount exceeds remaining balance of ₹${remaining.toLocaleString()}`, variant: "destructive" });
                    return;
                  }

                  updatePaymentMutation.mutate({
                    id: selectedInvoice.id,
                    data: { payments: validPayments }
                  });
                }
              }}
              disabled={updatePaymentMutation.isPending || newPayments.every(p => !p.amount || Number(p.amount) <= 0)}
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body.invoice-printing {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body.invoice-printing > *:not(#invoice-print-root) {
            display: none !important;
          }
          body.invoice-printing #invoice-print-root {
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            width: 210mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body.invoice-printing #printable-invoice,
          body.invoice-printing #printable-invoice * {
            visibility: visible !important;
          }
          body.invoice-printing #printable-invoice {
            position: relative !important;
            width: 210mm !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 15mm !important;
          }
          body.invoice-printing .no-print {
            display: none !important;
          }
        }
      `}</style>
    </Layout>
  );
}
