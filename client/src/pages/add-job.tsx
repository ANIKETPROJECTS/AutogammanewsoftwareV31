import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { calculateGstAmounts, formatGstAmount, splitGstAmount } from "@shared/gst";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceMaster, PPFMaster, AccessoryMaster, JobCard, Inquiry, InsertInquiry } from "@shared/schema";
import { api } from "@shared/routes";
import { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, 
  ChevronDown,
  ChevronRight,
  User, 
  Car, 
  Settings, 
  Shield, 
  Package, 
  FileText, 
  Ticket as TicketIcon,
  Trash2 
} from "lucide-react";
import { HsnCombobox } from "@/components/ui/hsn-combobox";

function getPpfRollId(roll: any): string {
  const rawId = roll?._id ?? roll?.id ?? roll?.rollId;
  if (rawId == null) return "";
  if (typeof rawId === "object" && rawId.$oid) return String(rawId.$oid);
  return String(rawId);
}

function RollCombobox({
  rolls,
  value,
  onChange,
  disabled,
}: {
  rolls: { id: string; name: string; availableStock: number }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = rolls.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedRoll = rolls.find(r => r.id === value);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(prev => !prev); }}
        className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedRoll ? "text-foreground" : "text-muted-foreground"}>
          {selectedRoll ? `${selectedRoll.name} (${selectedRoll.availableStock} sqft)` : "Select Roll"}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-[9999] bg-white border border-border rounded-lg shadow-2xl w-full min-w-[220px]">
          <div className="p-2 border-b border-border/40">
            <Input
              autoFocus
              className="h-8 text-sm"
              placeholder="Search rolls..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "288px" }}>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No rolls found</div>
            ) : (
              filtered.map(roll => (
                <button
                  key={roll.id}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b border-border/20 last:border-0 ${value === roll.id ? "bg-red-50 text-red-700 font-medium" : ""}`}
                  onMouseDown={e => { e.preventDefault(); onChange(roll.id); setOpen(false); setSearch(""); }}
                >
                  <span className="font-medium">{roll.name}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">({roll.availableStock} sqft)</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

  const jobCardSchema = z.object({
    customerName: z.string().min(1, "Customer name is required").transform(val => 
      val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
    ),
    phoneNumber: z.string().length(10, "Phone number must be exactly 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),
    emailAddress: z.string().email("Invalid email address").optional().or(z.literal("")),
    referralSource: z.string().min(1, "Referral source is required"),
    referrerName: z.string().optional().or(z.literal("")),
    referrerPhone: z.string().optional().or(z.literal("")),
    make: z.string().min(1, "Vehicle make is required").transform(val => 
      val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
    ),
    model: z.string().min(1, "Vehicle model is required").transform(val => 
      val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
    ),
    year: z.string().optional().or(z.literal("")).refine(val => !val || /^\d{4}$/.test(val), "Year must be a 4-digit number"),
    licensePlate: z.string().min(1, "License plate is required").refine(val => {
      const standard = /^[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4}$/;
      const bharat = /^\d{2}\sBH\s\d{4}\s[A-Z]{2}$/;
      return standard.test(val) || bharat.test(val);
    }, "Format: AA 00 AA 0000 or YY BH 0000 AA"),
    vehicleType: z.string().optional(),
    services: z.array(z.any()).default([]),
    ppfs: z.array(z.any()).default([]),
    accessories: z.array(z.any()).default([]),
    laborCharge: z.coerce.number().default(0),
    discount: z.coerce.number().default(0),
    gst: z.coerce.number().default(0),
    gstMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
    serviceNotes: z.string().optional().or(z.literal("")),
    status: z.string().optional(),
    date: z.string().min(1, "Job date is required"),
    estimatedCost: z.number().optional(),
    technician: z.string().optional(),
  });

  type JobCardFormValues = z.infer<typeof jobCardSchema>;

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import logoImage from "@/assets/autogamma-logo.png";

function SelfKioskHome({
  onOpenInquiry,
  onOpenTicket,
  onStartCheckIn,
}: {
  onOpenInquiry: () => void;
  onOpenTicket: () => void;
  onStartCheckIn: () => void;
}) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f8fa] px-5 py-8 text-slate-900 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-red-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-slate-200/70 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-center border-b border-slate-200/80 pb-6">
          <img src={logoImage} alt="Auto Gamma" className="h-12 w-auto object-contain sm:h-14" />
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto w-full max-w-3xl text-center">
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              How can we help today?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
              Choose the option that best matches what you would like to do.
            </p>
          </div>

          <div className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            <button
              type="button"
              onClick={onOpenInquiry}
              className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:border-red-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <FileText className="h-7 w-7" strokeWidth={1.8} />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Option 01</span>
              </div>
              <div className="mt-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Send an inquiry</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  Share your name, phone number, and questions. Our team will contact you shortly.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-red-600">
                Start inquiry
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenTicket}
              className="group rounded-3xl border border-slate-200 bg-white p-6 text-left text-slate-900 shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-1 hover:border-red-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <TicketIcon className="h-7 w-7" strokeWidth={1.8} />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Option 03</span>
              </div>
              <div className="mt-8">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Raise a ticket</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                  Report a customer issue and our team will track it for you.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-red-600">
                Raise ticket
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={onStartCheckIn}
              className="group order-first rounded-3xl bg-[#e52429] p-6 text-left text-white shadow-[0_16px_40px_rgba(229,36,41,0.24)] transition duration-200 hover:-translate-y-1 hover:bg-[#cf1e23] hover:shadow-[0_20px_48px_rgba(229,36,41,0.3)] focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 sm:p-8 lg:col-span-2 lg:w-1/2 lg:justify-self-center"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <CheckCircle2 className="h-7 w-7" strokeWidth={1.8} />
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-red-50">Option 02</span>
              </div>
              <div className="mt-8">
                <h2 className="text-2xl font-semibold tracking-tight text-white">Start your check-in</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-red-50">
                  Enter your customer and vehicle details to begin your service visit.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-white">
                Begin check-in
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}

function SelfKioskInquiry({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: inquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/inquiries"],
  });

  const createInquiryMutation = useMutation({
    mutationFn: async (payload: InsertInquiry) => {
      const response = await apiRequest("POST", "/api/inquiries", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      setCustomerName("");
      setPhone("");
      setNotes("");
      toast({
        title: "Inquiry saved",
        description: "Your details have been shared with our team.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to save inquiry",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredInquiries = [...inquiries]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .filter((inquiry) => {
      const createdDate = (inquiry.createdAt || "").slice(0, 10);
      const searchable = `${inquiry.customerName} ${inquiry.phone} ${inquiry.notes || ""}`.toLowerCase();
      return (
        (!searchTerm || searchable.includes(searchTerm.toLowerCase())) &&
        (!fromDate || createdDate >= fromDate) &&
        (!toDate || createdDate <= toDate)
      );
    });

  const handleSave = () => {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!customerName.trim()) {
      toast({ title: "Name required", description: "Please enter the customer name.", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast({ title: "Valid phone number required", description: "Enter exactly 10 digits.", variant: "destructive" });
      return;
    }

    createInquiryMutation.mutate({
      customerName: customerName.trim(),
      phone: normalizedPhone,
      email: "",
      services: [],
      accessories: [],
      notes: notes.trim(),
      ourPrice: 0,
      customerPrice: 0,
      priority: "MEDIUM",
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 px-4 py-5 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-2xl min-h-0 flex-col gap-5">
        <div className="flex shrink-0 items-start gap-3">
          <Button type="button" variant="outline" size="icon" onClick={onBack} className="mt-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Inquiry</h1>
            <p className="text-sm text-slate-500">Leave your contact details and our team will get back to you.</p>
          </div>
        </div>

        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>Save Your Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Customer Name</label>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Phone Number</label>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Notes</label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What would you like help with?" rows={4} />
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={createInquiryMutation.isPending}
              className="h-12 w-full bg-red-600 font-bold hover:bg-red-700"
            >
              {createInquiryMutation.isPending ? "Saving..." : "Save Inquiry"}
            </Button>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>Saved Inquiries</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="grid shrink-0 gap-3 sm:grid-cols-3">
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search name, phone, notes" />
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <p className="py-6 text-center text-sm text-slate-500">Loading inquiries...</p>
              ) : filteredInquiries.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No inquiries found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredInquiries.map((inquiry) => (
                    <div key={inquiry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{inquiry.customerName}</p>
                          <p className="text-sm text-slate-600">{inquiry.phone}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-500">
                          {inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString("en-IN") : "Date unavailable"}
                        </p>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{inquiry.notes || "No notes added."}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type KioskCustomer = {
  id: string;
  name: string;
  phone: string;
};

function SelfKioskTicket({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [matchedCustomerId, setMatchedCustomerId] = useState("");

  const { data: customers = [] } = useQuery<KioskCustomer[]>({
    queryKey: ["/api/customers"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: {
      customerId: string;
      customerName: string;
      phone: string;
      note: string;
    }) => {
      const response = await apiRequest("POST", "/api/tickets", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setCustomerName("");
      setPhone("");
      setNote("");
      setMatchedCustomerId("");
      toast({
        title: "Ticket raised",
        description: "Your issue has been shared with our team.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to raise ticket",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (phone.length !== 10) {
      setMatchedCustomerId("");
      return;
    }

    const existingCustomer = customers.find((customer) => customer.phone === phone);
    if (existingCustomer) {
      setMatchedCustomerId(existingCustomer.id);
      setCustomerName(existingCustomer.name);
    } else {
      setMatchedCustomerId("");
    }
  }, [customers, phone]);

  const handleSave = () => {
    if (!customerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter the customer name.",
        variant: "destructive",
      });
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      toast({
        title: "Valid phone number required",
        description: "Enter exactly 10 digits.",
        variant: "destructive",
      });
      return;
    }
    if (!note.trim()) {
      toast({
        title: "Issue required",
        description: "Please describe the customer issue.",
        variant: "destructive",
      });
      return;
    }

    createTicketMutation.mutate({
      customerId: matchedCustomerId,
      customerName: customerName.trim(),
      phone,
      note: note.trim(),
    });
  };

  const isExistingCustomer = Boolean(matchedCustomerId);

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5">
        <div className="flex shrink-0 items-start gap-3">
          <Button type="button" variant="outline" size="icon" onClick={onBack} className="mt-1">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Raise a ticket</h1>
            <p className="text-sm text-slate-500">
              Tell our team about an issue and we will track it for you.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer and issue details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Phone Number</label>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile number"
              />
              {phone.length === 10 && (
                <p className={`text-xs font-medium ${isExistingCustomer ? "text-emerald-600" : "text-slate-500"}`}>
                  {isExistingCustomer
                    ? "Existing customer found. This ticket will be linked to the customer."
                    : "New customer. Enter the name below to create this ticket."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Customer Name</label>
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Issue</label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Describe the customer issue..."
                rows={5}
              />
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={createTicketMutation.isPending}
              className="h-12 w-full bg-slate-900 font-bold hover:bg-slate-800"
            >
              {createTicketMutation.isPending ? "Raising ticket..." : "Raise Ticket"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AddJobPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const isSelfKiosk = location === "/selfkiosk";
  const searchParams = new URLSearchParams(useSearch());
  const [kioskScreen, setKioskScreen] = useState<"home" | "checkin" | "inquiry" | "ticket">(
    isSelfKiosk && searchParams.get("mode") === "checkin" ? "checkin" : "home",
  );
  const [kioskStep, setKioskStep] = useState(1);
  const [kioskProductSection, setKioskProductSection] = useState<"services" | "ppf" | "accessories">("services");
  const jobId = searchParams.get("id");
  const prefillPhone = searchParams.get("phone");
  const prefillName = searchParams.get("name");
  const prefillEmail = searchParams.get("email");
  const prefillVehiclesStr = searchParams.get("vehicles");

  const { data: jobCards = [], isFetched: isJobCardsFetched } = useQuery<JobCard[]>({
    queryKey: ["/api/job-cards"],
  });

  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [isFetchingCustomer, setIsFetchingCustomer] = useState(false);
  const [fetchedCustomerVehicles, setFetchedCustomerVehicles] = useState<Array<{
    make: string; model: string; year: string; licensePlate: string; vehicleType: string;
  }>>([]);
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string>("");

  const form = useForm<JobCardFormValues>({
    resolver: zodResolver(jobCardSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      emailAddress: "",
      referralSource: "",
      referrerName: "",
      referrerPhone: "",
      make: "",
      model: "",
      year: "",
      licensePlate: "",
      vehicleType: "",
      services: [],
      ppfs: [],
      accessories: [],
      laborCharge: 0,
      discount: 0,
      gst: 0,
      gstMode: "exclusive",
      serviceNotes: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  // Watch phone number and fetch customer data when it reaches 10 digits
  useEffect(() => {
    const phoneNumber = form.watch("phoneNumber");
    if (phoneNumber && phoneNumber.length === 10) {
      setIsFetchingCustomer(true);
      fetch(`/api/customers/by-phone/${phoneNumber}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Not found");
        })
        .then(customer => {
          if (customer) {
            form.setValue("customerName", customer.customerName || "");
            form.setValue("emailAddress", customer.emailAddress || "");

            const vehicles: Array<{ make: string; model: string; year: string; licensePlate: string; vehicleType: string }> =
              customer.vehicles && customer.vehicles.length > 0
                ? customer.vehicles
                : [{ make: customer.make || "", model: customer.model || "", year: customer.year || "", licensePlate: customer.licensePlate || "", vehicleType: customer.vehicleType || "" }];

            setFetchedCustomerVehicles(vehicles);

            if (vehicles.length === 1) {
              // Only one vehicle — auto-fill as before
              const v = vehicles[0];
              form.setValue("make", v.make);
              form.setValue("model", v.model);
              form.setValue("year", v.year);
              form.setValue("licensePlate", v.licensePlate);
              form.setValue("vehicleType", v.vehicleType);
              setSelectedVehicleKey(`${v.make}-${v.model}-${v.licensePlate}`);
            } else {
              // Multiple vehicles — show selector, auto-select the most recent one
              const v = vehicles[0];
              form.setValue("make", v.make);
              form.setValue("model", v.model);
              form.setValue("year", v.year);
              form.setValue("licensePlate", v.licensePlate);
              form.setValue("vehicleType", v.vehicleType);
              setSelectedVehicleKey(`${v.make}-${v.model}-${v.licensePlate}`);
            }
          }
        })
        .catch(() => {
          // Customer not found — allow user to enter new data
          setFetchedCustomerVehicles([]);
          setSelectedVehicleKey("");
        })
        .finally(() => setIsFetchingCustomer(false));
    } else if (!phoneNumber || phoneNumber.length < 10) {
      // Phone cleared or incomplete — reset vehicle selector
      setFetchedCustomerVehicles([]);
      setSelectedVehicleKey("");
    }
  }, [form.watch("phoneNumber"), form]);

  useEffect(() => {
    if ((prefillPhone || prefillName) && !jobId && isJobCardsFetched && !hasPrefilled) {
      const existingJob = jobCards.find(j => j.phoneNumber === prefillPhone);
      let previousVehicles: any[] = [];
      
      // Parse vehicles from URL parameter
      if (prefillVehiclesStr) {
        try {
          const decoded = decodeURIComponent(prefillVehiclesStr);
          previousVehicles = JSON.parse(decoded);
          console.log("Parsed vehicles from URL:", previousVehicles);
        } catch (e) {
          console.error("Failed to parse vehicles from URL:", e, "Raw string:", prefillVehiclesStr);
        }
      }
      
      // Get the first vehicle or fallback to existing job's first vehicle
      let firstVehicle: any = null;
      if (previousVehicles && previousVehicles.length > 0) {
        firstVehicle = previousVehicles[0];
      } else if (existingJob) {
        // Fallback: try to construct from existing job
        firstVehicle = {
          make: existingJob.make,
          model: existingJob.model,
          year: existingJob.year,
          plate: existingJob.licensePlate,
          type: existingJob.vehicleType
        };
      }
      
      form.reset({
        customerName: prefillName || existingJob?.customerName || "",
        phoneNumber: prefillPhone || existingJob?.phoneNumber || "",
        emailAddress: prefillEmail || existingJob?.emailAddress || "",
        referralSource: existingJob?.referralSource || "",
        referrerName: existingJob?.referrerName || "",
        referrerPhone: existingJob?.referrerPhone || "",
        make: firstVehicle?.make || "",
        model: firstVehicle?.model || "",
        year: firstVehicle?.year || "",
        licensePlate: firstVehicle?.plate || "",
        vehicleType: firstVehicle?.type || "",
        services: [],
        ppfs: [],
        accessories: [],
        laborCharge: 0,
        discount: 0,
        gst: 18,
        gstMode: "exclusive",
        serviceNotes: "",
      });
      setHasPrefilled(true);
    }
  }, [prefillPhone, prefillName, prefillEmail, prefillVehiclesStr, jobId, jobCards, isJobCardsFetched, hasPrefilled, form]);

  const { data: jobToEdit, isLoading: isLoadingJob, refetch: refetchJob } = useQuery<JobCard>({
    queryKey: ["/api/job-cards", jobId],
    queryFn: async () => {
      console.log("Fetching job for edit, jobId:", jobId);
      const res = await fetch(`/api/job-cards/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      const data = await res.json();
      console.log("Fetched job data:", data);
      return data;
    },
    enabled: !!jobId,
    staleTime: 0, 
    gcTime: 0,    
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Force refetch whenever jobId changes and also on component mount
  useEffect(() => {
    if (jobId) {
      console.log("Job ID effect triggered for", jobId, "- forcing refetch");
      refetchJob();
    }
  }, [jobId, refetchJob]);

  // Handle initial form reset and subsequent Job ID changes
  useEffect(() => {
    // If we have a jobId but the jobToEdit is either missing or belongs to a different ID, don't reset yet
    if (jobId && jobToEdit && String(jobToEdit.id) === String(jobId)) {
      console.log("Resetting form with matched jobToEdit data for jobId:", jobId);
      form.reset({
        customerName: jobToEdit.customerName || "",
        phoneNumber: jobToEdit.phoneNumber || "",
        emailAddress: jobToEdit.emailAddress || "",
        referralSource: jobToEdit.referralSource || "",
        referrerName: jobToEdit.referrerName || "",
        referrerPhone: jobToEdit.referrerPhone || "",
        make: jobToEdit.make || "",
        model: jobToEdit.model || "",
        year: jobToEdit.year || "",
        licensePlate: jobToEdit.licensePlate || "",
        vehicleType: jobToEdit.vehicleType || "",
        services: (jobToEdit.services || []).map(s => ({
          serviceId: (s as any).serviceId || (s as any).id,
          id: (s as any).serviceId || (s as any).id,
          name: s.name,
          price: s.price,
          technician: s.technician,
          hsnCode: (s as any).hsnCode || ""
        })),
        ppfs: (jobToEdit.ppfs || []).reduce((acc: any[], p: any) => {
          const ppfId = String((p as any).ppfId || (p as any).id || (p as any)._id);
          const warranty = (p as any).warranty || p.name?.match(/\((.*)\)/)?.[1]?.split(" - ")?.[1] || "";
          
          console.log('Mapping PPF entry:', { ppfId, warranty, original: p });
          
          // Improved existing entry matching: explicitly handle cases where ppfId might be missing or different field names
          const existing = acc.find(item => {
            const itemPpfId = String(item.ppfId || item.id || item._id);
            return itemPpfId === ppfId && item.warranty === warranty;
          });
          
          if (existing) {
            // Group rolls for same PPF and Warranty
            existing.rollUsed = (existing.rollUsed || 0) + (p.rollUsed || 0);
            
            // Rebuild the name by aggregating quantities from the name strings
            // We need to parse all quantities from the incoming name too
            const rollMatches = (p.name || "").matchAll(/Quantity: (\d+(?:\.\d+)?)sqft \(from (.*?)\)/g);
            for (const match of rollMatches) {
              const qty = match[1];
              const rollName = match[2];
              
              const existingRollRegex = new RegExp(`Quantity: (\\d+(?:\\.\\d+)?)sqft \\(from ${rollName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`);
              const existingRollMatch = (existing.name || "").match(existingRollRegex);
              
              if (existingRollMatch) {
                const oldQty = parseFloat(existingRollMatch[1]);
                const newQty = oldQty + parseFloat(qty);
                existing.name = existing.name.replace(existingRollRegex, `Quantity: ${newQty}sqft (from ${rollName})`);
              } else {
                existing.name += ` , Quantity: ${qty}sqft (from ${rollName})`;
              }
            }
            
            // Update rollsUsed array
            const rollsToMerge = p.rollsUsed || (p.rollId ? [{
              rollId: p.rollId,
              rollName: p.rollName || "Unknown Roll",
              rollUsed: p.rollUsed
            }] : []);

            rollsToMerge.forEach((newRoll: any) => {
              existing.rollsUsed = existing.rollsUsed || [];
              const existingRollEntry = existing.rollsUsed.find((r: any) => r.rollId === newRoll.rollId);
              if (existingRollEntry) {
                existingRollEntry.rollUsed += newRoll.rollUsed;
              } else {
                existing.rollsUsed.push({
                  rollId: newRoll.rollId,
                  rollName: newRoll.rollName || "Unknown Roll",
                  rollUsed: newRoll.rollUsed
                });
              }
            });
          } else {
            acc.push({
              ppfId,
              id: ppfId,
              name: p.name,
              price: p.price,
              technician: p.technician,
              rollUsed: p.rollUsed,
              rollsUsed: p.rollsUsed || (p.rollId ? [{
                rollId: p.rollId,
                rollName: p.rollName || "Unknown Roll",
                rollUsed: p.rollUsed
              }] : []),
              warranty,
              hsnCode: p.hsnCode || ""
            });
          }
          return acc;
        }, []),
          accessories: (jobToEdit.accessories || []).map(a => {
            const accId = (a as any).accessoryId || (a as any).id || (a as any)._id;
            return {
              accessoryId: String(accId),
              id: String(accId),
              name: a.name,
              category: (a as any).category || "",
              price: a.price,
              quantity: a.quantity || 1,
              hsnCode: (a as any).hsnCode || ""
            };
          }),
        laborCharge: jobToEdit.laborCharge || 0,
        discount: jobToEdit.discount || 0,
        gst: jobToEdit.gst ?? 0,
        gstMode: jobToEdit.gstMode ?? "exclusive",
        serviceNotes: jobToEdit.serviceNotes || "",
        date: jobToEdit.date ? new Date(jobToEdit.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      });
    } else if (!jobId && !prefillPhone) {
      // Only clear form if there's no prefillPhone (prefillPhone is handled by its own useEffect)
      console.log("No jobId and no prefillPhone - Clearing form for new job card");
      form.reset({
        customerName: "",
        phoneNumber: "",
        emailAddress: "",
        referralSource: "",
        referrerName: "",
        referrerPhone: "",
        make: "",
        model: "",
        year: "",
        licensePlate: "",
        vehicleType: "",
        services: [],
        ppfs: [],
        accessories: [],
        laborCharge: 0,
        discount: 0,
        gst: 0,
        gstMode: "exclusive",
        serviceNotes: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [jobToEdit, jobId, prefillPhone, form.reset]);

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const { fields: ppfFields, append: appendPPF, remove: removePPF } = useFieldArray({
    control: form.control,
    name: "ppfs",
  });

  const { fields: accessoryFields, append: appendAccessory, remove: removeAccessory } = useFieldArray({
    control: form.control,
    name: "accessories",
  });

  // Masters Queries
  const { data: services = [] } = useQuery<ServiceMaster[]>({
    queryKey: [api.masters.services.list.path],
  });
  const { data: ppfMasters = [] } = useQuery<PPFMaster[]>({
    queryKey: [api.masters.ppf.list.path],
  });
  const { data: accessories = [] } = useQuery<AccessoryMaster[]>({
    queryKey: [api.masters.accessories.list.path],
  });
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: [api.technicians.list.path],
  });

  // Local selection states
  const [selectedService, setSelectedService] = useState("");
  const [selectedServiceVehicleType, setSelectedServiceVehicleType] = useState("");
  const [selectedServiceWarranty, setSelectedServiceWarranty] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [selectedPPF, setSelectedPPF] = useState("");
  const currentPPF = ppfMasters.find(p => p.id === selectedPPF);
  const [selectedPPFRoll, setSelectedPPFRoll] = useState("");
  const [selectedPPFVehicleType, setSelectedPPFVehicleType] = useState("");
  const [selectedWarranty, setSelectedWarranty] = useState("");
  const [rollQty, setRollQty] = useState(0);
  const [selectedAccessoryCategory, setSelectedAccessoryCategory] = useState("");
  const [accessorySearch, setAccessorySearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [newAccessoryPrice, setNewAccessoryPrice] = useState<string>("");
  const [selectedAccessory, setSelectedAccessory] = useState("");
  const [accessoryQty, setAccessoryQty] = useState(1);
  const [accessoryWindowType, setAccessoryWindowType] = useState<"4window" | "6window" | "">("");

  const filteredCategories = Array.from(new Set(accessories.map(a => a.category))).filter(cat => 
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredAccessories = accessories.filter(a => 
    a.category === selectedAccessoryCategory && 
    a.name.toLowerCase().includes(accessorySearch.toLowerCase())
  );

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/masters/accessory-categories", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      toast({ title: "Category added successfully" });
    }
  });

  const [showAddAccessoryDialog, setShowAddAccessoryDialog] = useState(false);
  const [newAccessoryData, setNewAccessoryData] = useState({
    category: "",
    name: "",
    price: "",
    quantity: "100"
  });

  const createAccessoryMutation = useMutation({
    mutationFn: async (data: { category: string, name: string, price: number, quantity: number }) => {
      // First ensure the category exists in the AccessoryCategory collection
      try {
        await apiRequest("POST", "/api/masters/accessory-categories", { name: data.category });
      } catch (e) {
        // Ignore if category already exists
        console.log("Category might already exist or failed to create:", e);
      }
      const res = await apiRequest("POST", "/api/masters/accessories", data);
      return res.json();
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      toast({ title: "Accessory added successfully" });
      setShowAddAccessoryDialog(false);
      
      // Automatically select and add the newly created accessory to the job
      setSelectedAccessoryCategory(newItem.category);
      setSelectedAccessory(newItem.id);
      
      // Small delay to ensure state updates before adding
      setTimeout(() => {
        appendAccessory({
          accessoryId: newItem.id,
          id: newItem.id,
          name: newItem.name,
          price: newItem.price,
          quantity: 1,
          business: "Auto Gamma"
        } as any);
        setSelectedAccessory("");
      }, 100);
    }
  });
  const [showBusinessDialog, setShowBusinessDialog] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(isSelfKiosk);
  const [ppfExpanded, setPpfExpanded] = useState(isSelfKiosk);
  const [accessoriesExpanded, setAccessoriesExpanded] = useState(isSelfKiosk);
  const [serviceHsn, setServiceHsn] = useState("");
  const [ppfHsn, setPpfHsn] = useState("");
  const [accessoryHsn, setAccessoryHsn] = useState("");
  const [hasGst, setHasGst] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [ppfTouchupMode, setPpfTouchupMode] = useState(false);
  const [ppfTouchupPrice, setPpfTouchupPrice] = useState(0);

  useEffect(() => {
    if (selectedPPF) {
      const p = ppfMasters.find(m => m.id === selectedPPF);
      setPpfHsn(p?.hsnCode || "");
    } else {
      setPpfHsn("");
    }
  }, [selectedPPF, ppfMasters]);

  useEffect(() => {
    if (selectedAccessory) {
      const a = accessories.find(m => m.id === selectedAccessory);
      setAccessoryHsn(a?.hsnCode || "");
    } else {
      setAccessoryHsn("");
    }
  }, [selectedAccessory, accessories]);

  const [laborBusiness, setLaborBusiness] = useState<string>("Auto Gamma");
  const [discountBusiness, setDiscountBusiness] = useState<string>("Auto Gamma");
  const [discountSplit, setDiscountSplit] = useState<{ autoGamma: number; agnx: number }>({ autoGamma: 0, agnx: 0 });
  const [discountType, setDiscountType] = useState<"Total" | "Split">("Total");

  // Update discount split when total discount changes if in Total mode
  useEffect(() => {
    if (discountType === "Total") {
      const totalDiscount = form.getValues("discount");
      setDiscountSplit({ autoGamma: totalDiscount, agnx: 0 });
    }
  }, [form.watch("discount"), discountType]);
  const [businessAssignments, setBusinessAssignments] = useState<Record<string, string>>({});
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [payments, setPayments] = useState<{ amount: number; method: string; date: string }[]>([
    { amount: 0, method: "Cash", date: new Date().toISOString().split("T")[0] }
  ]);
  const [perBusinessPayments, setPerBusinessPayments] = useState<Record<string, { amount: string; method: string; date: string }>>({});
  const updatePerBizPayment = (biz: string, field: string, value: string) => {
    setPerBusinessPayments(prev => ({
      ...prev,
      [biz]: { amount: "", method: "Cash", date: new Date().toISOString().split("T")[0], ...prev[biz], [field]: value }
    }));
  };

  const handleAddPayment = () => {
    setPayments([...payments, { amount: 0, method: "Cash", date: new Date().toISOString().split("T")[0] }]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index: number, field: string, value: any) => {
    const newPayments = [...payments];
    let finalValue = value;
    
    if (field === "amount") {
      // Remove any non-numeric characters except for the decimal point
      const sanitizedValue = String(value).replace(/[^0-9.]/g, "");
      finalValue = sanitizedValue === "" ? 0 : sanitizedValue;

      const totalEstimatedCost = [...form.getValues("services"), ...form.getValues("ppfs"), ...form.getValues("accessories")].reduce((acc, curr) => {
        const itemPrice = Number(curr.price || 0);
        const itemQty = Number(curr.quantity || 1);
        return acc + (itemPrice * itemQty);
      }, 0) + Number(form.getValues("laborCharge") || 0) - Number(form.getValues("discount") || 0);
      const gstRate = Number(form.getValues("gst") || 0);
      const gstMode = form.getValues("gstMode") || "exclusive";
      const { totalAmount: totalEstimatedCostWithGst } = calculateGstAmounts(
        totalEstimatedCost,
        gstRate,
        gstMode,
      );
      
      const otherPaymentsTotal = payments.reduce((acc, p, i) => i === index ? acc : acc + Number(p.amount || 0), 0);
      const maxAllowed = totalEstimatedCostWithGst - otherPaymentsTotal;
      
      if (Number(finalValue) > maxAllowed) {
        finalValue = maxAllowed;
      }
    }
    
    newPayments[index] = { ...newPayments[index], [field]: finalValue };
    setPayments(newPayments);
  };

  const handleAddService = () => {
    const s = services.find(item => item.id === selectedService);
    const tech = technicians.find(t => t.id === selectedTechnician);
    const vehicleType = form.getValues("vehicleType");
    
    if (!vehicleType) {
      toast({
        title: "Vehicle Type Required",
        description: "Please select a Vehicle Type in the Vehicle Information section first.",
        variant: "destructive",
      });
      return;
    }

    const vehiclePricing = (s?.pricingByVehicleType as any[])?.find(p => p.vehicleType === vehicleType);
    const hasWarrantyOptions = vehiclePricing?.warrantyOptions && vehiclePricing.warrantyOptions.length > 0;

    let price = vehiclePricing?.price || 0;
    let serviceName = `${s?.name} (${vehicleType})`;
    let warranty: string | undefined;

    if (hasWarrantyOptions && selectedServiceWarranty) {
      const warrantyOpt = vehiclePricing.warrantyOptions.find((o: any) => o.warrantyName === selectedServiceWarranty);
      price = warrantyOpt?.price || 0;
      serviceName = `${s?.name} (${vehicleType} - ${selectedServiceWarranty})`;
      warranty = selectedServiceWarranty;
    }
    
    if (s) {
      appendService({ 
        serviceId: s.id!, 
        id: s.id!,
        name: serviceName,
        price,
        technician: tech?.name,
        hsnCode: serviceHsn || "",
        warranty,
      } as any);
      setSelectedService("");
      setSelectedTechnician("");
      setServiceHsn("");
      setSelectedServiceWarranty("");
    }
  };

  const handleAddPPF = () => {
    const p = ppfMasters.find(item => item.id === selectedPPF);
    const selectedRollId = String(selectedPPFRoll || "");
    const roll = p?.rolls?.find((r: any) => getPpfRollId(r) === selectedRollId);
    const rollId = getPpfRollId(roll) || selectedRollId;
    const tech = technicians.find(t => t.id === selectedTechnician);
    const vehicleType = form.getValues("vehicleType");

    if (!vehicleType) {
      toast({
        title: "Vehicle Type Required",
        description: "Please select a Vehicle Type in the Vehicle Information section first.",
        variant: "destructive",
      });
      return;
    }

    if (!rollId || !roll) {
      toast({
        title: "PPF Roll Required",
        description: "Please select a valid PPF roll before adding this item.",
        variant: "destructive",
      });
      return;
    }

    // Check if roll has enough quantity using real-time stock
    if (roll && rollQty > realTimeStock) {
      toast({
        title: "Insufficient Stock",
        description: `Selected roll only has ${realTimeStock} sqft remaining (accounting for other items in this job).`,
        variant: "destructive",
      });
      return;
    }

    const vehiclePricing = p?.pricingByVehicleType.find(v => v.vehicleType === vehicleType);
    const option = vehiclePricing?.options.find(o => o.warrantyName === selectedWarranty);
    
    if (p && (selectedWarranty || ppfTouchupMode)) {
      console.log('=== Adding PPF Roll ===');
      console.log('Selected PPF:', p);
      console.log('Selected Warranty:', selectedWarranty);
      console.log('Selected Roll:', roll);
      console.log('Quantity Used:', rollQty);

      const currentPPFs = [...form.getValues("ppfs")];
      console.log('Current PPF List in form:', currentPPFs);

      // Updated matching logic to be more robust during edits
      const existingPPFIndex = currentPPFs.findIndex(
        (field: any) => {
          const fieldPpfId = String(field.ppfId || field.id || field._id);
          const match = fieldPpfId === String(p.id) && String(field.warranty) === String(selectedWarranty);
          console.log(`Checking match for field:`, {
            fieldPpfId,
            pId: p.id,
            fieldWarranty: field.warranty,
            selectedWarranty,
            isMatch: match
          });
          return match;
        }
      );

      console.log('Found existing match index:', existingPPFIndex);
      if (existingPPFIndex !== -1) {
        const existingField = currentPPFs[existingPPFIndex];
        
        const newRollUsed = (existingField.rollUsed || 0) + (rollQty || 0);
        
        const rollsUsed = existingField.rollsUsed || [];
        const existingRollIndex = rollsUsed.findIndex((r: any) => String(r.rollId) === rollId);
        
        if (existingRollIndex !== -1) {
          rollsUsed[existingRollIndex].rollUsed += (rollQty || 0);
        } else {
          rollsUsed.push({
            rollId,
            rollName: roll?.name || "Unknown Roll",
            rollUsed: rollQty || 0
          });
        }

        const effectivePrice = ppfTouchupMode ? ppfTouchupPrice : (option?.price || 0);
        const effectiveWarranty = ppfTouchupMode ? "Touchup" : selectedWarranty;
        let updatedName = ppfTouchupMode
          ? `${p.name} (Touchup)`
          : `${p.name} (${vehicleType} - ${selectedWarranty})`;
        const newRollDesc = `Quantity: ${rollQty}sqft (from ${roll?.name || 'Unknown Roll'})`;
        
        // Robust multi-line name parsing and rebuilding
        if (existingField.name.includes("Quantity:")) {
          const rollRegex = new RegExp(`Quantity: (\\d+(?:\\.\\d+)?)sqft \\(from ${roll?.name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || 'Unknown Roll'}\\)`);
          const nameLines = existingField.name.split('\n');
          const header = nameLines[0];
          let quantitiesPart = nameLines.slice(1).join('\n');
          
          if (quantitiesPart.match(rollRegex)) {
            const rollMatch = quantitiesPart.match(rollRegex);
            const oldQty = parseFloat(rollMatch![1]);
            const newQtyForThisRoll = oldQty + (rollQty || 0);
            quantitiesPart = quantitiesPart.replace(rollRegex, `Quantity: ${newQtyForThisRoll}sqft (from ${roll?.name || 'Unknown Roll'})`);
            updatedName = `${header}\n${quantitiesPart}`;
          } else {
            updatedName = `${header}\n${quantitiesPart} , ${newRollDesc}`;
          }
        } else {
          updatedName = `${updatedName}\n${newRollDesc}`;
        }

        currentPPFs[existingPPFIndex] = {
          ...existingField,
          rollUsed: newRollUsed > 0 ? newRollUsed : undefined,
          rollsUsed: rollsUsed,
          name: updatedName,
          warranty: effectiveWarranty,
          technician: tech?.name || existingField.technician,
          price: effectivePrice,
          hsnCode: ppfHsn || existingField.hsnCode || ""
        };
        form.setValue("ppfs", currentPPFs);
      } else {
        const effectivePrice = ppfTouchupMode ? ppfTouchupPrice : (option?.price || 0);
        const effectiveWarranty = ppfTouchupMode ? "Touchup" : selectedWarranty;
        const entryName = ppfTouchupMode
          ? `${p.name} (Touchup)\nQuantity: ${rollQty}sqft (from ${roll?.name || 'Unknown Roll'})`
          : `${p.name} (${vehicleType} - ${selectedWarranty})\nQuantity: ${rollQty}sqft (from ${roll?.name || 'Unknown Roll'})`;
        appendPPF({ 
          ppfId: p.id!, 
          id: p.id!,
          name: entryName,
          rollId,
          rollName: roll?.name || "Unknown Roll",
          rollUsed: rollQty > 0 ? rollQty : undefined,
          rollsUsed: [{
            rollId,
            rollName: roll?.name || "Unknown Roll",
            rollUsed: rollQty || 0
          }],
          price: effectivePrice,
          technician: tech?.name,
          warranty: effectiveWarranty,
          hsnCode: ppfHsn || ""
        } as any);
      }
      setSelectedPPF("");
      setSelectedPPFRoll("");
      setSelectedWarranty("");
      setRollQty(0);
      setPpfHsn("");
      setSelectedTechnician("");
      if (ppfTouchupMode) {
        setPpfTouchupMode(false);
        setPpfTouchupPrice(0);
      }
    }
  };

  const getEffectiveAccessoryPrice = (a: typeof accessories[number]) => {
    if (a.hasDualPricing) {
      if (accessoryWindowType === "4window") return a.price4Window || a.price;
      if (accessoryWindowType === "6window") return a.price6Window || a.price;
    }
    return a.price;
  };

  const handleAddAccessory = () => {
    const a = accessories.find(item => item.id === selectedAccessory);
    if (a) {
      if (a.hasDualPricing && !accessoryWindowType) {
        toast({
          title: "Select Window Type",
          description: "Please select 4 Window or 6 Window pricing for this accessory.",
          variant: "destructive",
        });
        return;
      }

      const usedInCurrentJob = accessoryFields.reduce((sum, field: any) => {
        if (field.accessoryId === selectedAccessory) {
          return sum + (Number(field.quantity) || 0);
        }
        return sum;
      }, 0);

      const originalQty = jobToEdit?.accessories?.find((acc: any) => 
        (acc.accessoryId || acc.id || acc._id) === selectedAccessory
      )?.quantity || 0;

      const currentFormQty = accessoryFields.reduce((sum, field: any) => {
        if (field.accessoryId === selectedAccessory) {
          return sum + (Number(field.quantity) || 0);
        }
        return sum;
      }, 0);

      const effectiveAvailable = a.quantity + originalQty - currentFormQty;

       const shortage = Math.max(0, accessoryQty - Math.max(0, effectiveAvailable));

      const effectivePrice = getEffectiveAccessoryPrice(a);
      const windowLabel = a.hasDualPricing && accessoryWindowType
        ? ` (${accessoryWindowType === "4window" ? "4 Window" : "6 Window"})`
        : "";

      const existingIndex = accessoryFields.findIndex((field: any) => field.accessoryId === a.id);
      if (existingIndex !== -1) {
        const currentAccessories = [...form.getValues("accessories")];
        currentAccessories[existingIndex] = {
          ...currentAccessories[existingIndex],
          category: a.category,
          quantity: (Number(currentAccessories[existingIndex].quantity) || 0) + accessoryQty
        };
        form.setValue("accessories", currentAccessories);
      } else {
        appendAccessory({ 
          accessoryId: a.id!, 
          id: a.id!,
          name: `${a.name}${windowLabel}`, 
          category: a.category,
          price: effectivePrice,
          quantity: accessoryQty,
          hsnCode: accessoryHsn || ""
        } as any);
      }
       if (shortage > 0) {
         toast({
           title: "Accessory added to buffer",
           description: `${shortage} unit${shortage === 1 ? "" : "s"} will be tracked as pending stock.`,
         });
       }
      setSelectedAccessory("");
      setAccessoryQty(1);
      setAccessoryHsn("");
      setAccessoryWindowType("");
    }
  };

  const createJobMutation = useMutation({
    mutationFn: async (payload: any) => {
      console.log("Mutation starting - Payload:", payload);
      const method = jobId ? "PATCH" : "POST";
      const url = jobId ? `/api/job-cards/${jobId}` : "/api/job-cards";
      const res = await apiRequest(method, url, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards", jobId] });
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.masters.ppf.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: jobId ? "Job Card Updated" : "Job Card Created",
        description: `Successfully ${jobId ? "updated" : "created"} the job card.`,
      });
      if (!isSelfKiosk) {
        setLocation("/job-cards");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = async (data: JobCardFormValues) => {
    try {
      console.log("Form submitted with data:", data);
      
      const subtotal = [...data.services, ...data.ppfs, ...data.accessories].reduce((acc, curr) => {
        const itemPrice = Number(curr.price || 0);
        const itemQty = Number(curr.quantity || 1);
        return acc + (itemPrice * itemQty);
      }, 0) + (Number(data.laborCharge) || 0) - (Number(data.discount) || 0);
      const gstRate = Number(data.gst || 0);
      const { totalAmount: totalEstimatedCost } = calculateGstAmounts(
        subtotal,
        gstRate,
        data.gstMode || "exclusive",
      );
      
      const payload = {
        ...data,
        licensePlate: String(data.licensePlate || "").toUpperCase().trim(),
        gstNumber: hasGst ? gstNumber : "",
        estimatedCost: totalEstimatedCost,
        status: jobToEdit?.status || "Pending",
        autoGammaDiscount: discountSplit.autoGamma,
        agnxDiscount: discountSplit.agnx,
        discount: (discountSplit.autoGamma || 0) + (discountSplit.agnx || 0),
        laborBusiness,
        accessories: data.accessories.map(a => ({
          ...a,
          quantity: Number(a.quantity || 1),
          accessoryId: a.accessoryId || a.id
        })),
        ppfs: data.ppfs.map((ppf: any) => {
          const ppfMaster = ppfMasters.find((master: any) =>
            String(master.id) === String(ppf.ppfId || ppf.id) ||
            (ppf.name && String(ppf.name).startsWith(String(master.name))),
          );
          const rollNameFromDescription = String(ppf.name || "").match(/\(from ([^)]+)\)/)?.[1] || "";
          const submittedRollName = String(ppf.rollName || rollNameFromDescription);
          const fallbackRoll = ppfMaster?.rolls?.find((masterRoll: any) =>
            String(masterRoll.name || "").trim().toLowerCase() === submittedRollName.trim().toLowerCase(),
          );
          const fallbackRollId = getPpfRollId(fallbackRoll);
          const sourceRolls = Array.isArray(ppf.rollsUsed) && ppf.rollsUsed.length > 0
            ? ppf.rollsUsed
            : ppf.rollId || ppf.rollName || fallbackRollId
              ? [ppf]
              : [];
          const rollsUsed = sourceRolls
            .map((roll: any) => {
              const rollName = String(roll.rollName || submittedRollName || "Unknown Roll");
              const matchingRoll = ppfMaster?.rolls?.find((masterRoll: any) =>
                String(masterRoll.name || "").trim().toLowerCase() === rollName.trim().toLowerCase(),
              );
              return {
                rollId: getPpfRollId(roll) || getPpfRollId(matchingRoll) || fallbackRollId,
                rollName,
                rollUsed: Number(roll.rollUsed ?? ppf.rollUsed ?? 0) || 0,
              };
            })
            .filter((roll: any) => roll.rollId && roll.rollUsed > 0);
          const rollUsed =
            rollsUsed.reduce((total: number, roll: any) => total + roll.rollUsed, 0) ||
            Number(ppf.rollUsed) ||
            0;
          return {
            ...ppf,
            id: ppf.id || ppf.ppfId,
            rollId: ppf.rollId || fallbackRollId || undefined,
            rollUsed,
            rollsUsed,
          };
        }),
      };

      // If it's an update, check what changed
      if (jobId && jobToEdit) {
        const businessFields = ["services", "ppfs", "accessories", "laborCharge", "discount", "gst"];
        const businessChanged = businessFields.some(field => {
          const formVal = data[field as keyof typeof data];
          const editVal = jobToEdit[field as keyof any];
          
          // Special handling for arrays to compare content
          if (Array.isArray(formVal) && Array.isArray(editVal)) {
            if (formVal.length !== editVal.length) return true;
            // Compare items ignoring business assignment as that's what the popup sets
            return JSON.stringify(formVal.map(i => ({ ...i, business: undefined }))) !== 
                   JSON.stringify(editVal.map(i => ({ ...i, business: undefined })));
          }
          
          return String(formVal) !== String(editVal);
        });

        if (!businessChanged) {
          // Only basic details (Customer/Vehicle) changed, skip popup
          await createJobMutation.mutateAsync(payload);
          return;
        }
      }

      if (!showBusinessDialog) {
        setPendingFormData(payload);
        const assignments: Record<string, string> = {};
        data.services.forEach((_, i) => assignments[`service-${i}`] = "Auto Gamma");
        data.ppfs.forEach((_, i) => assignments[`ppf-${i}`] = "Auto Gamma");
        data.accessories.forEach((_, i) => assignments[`accessory-${i}`] = "Auto Gamma");
        setBusinessAssignments(assignments);
        setShowBusinessDialog(true);
      } else {
        await createJobMutation.mutateAsync(payload);
      }
    } catch (error) {
      console.error("Error in onSubmit:", error);
      toast({
        title: "Submission Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteWithBusiness = () => {
    if (!pendingFormData) return;

    const laborCharge = Number(pendingFormData.laborCharge || 0);
    const discount = Number(pendingFormData.discount || 0);

    // Validate per-business payment amounts don't exceed invoice totals
    const activeBizSetValidate = new Set<string>();
    (pendingFormData.services || []).forEach((_: any, i: number) => activeBizSetValidate.add(businessAssignments[`service-${i}`] || "Auto Gamma"));
    (pendingFormData.ppfs || []).forEach((_: any, i: number) => activeBizSetValidate.add(businessAssignments[`ppf-${i}`] || "Auto Gamma"));
    (pendingFormData.accessories || []).forEach((_: any, i: number) => activeBizSetValidate.add(businessAssignments[`accessory-${i}`] || "Auto Gamma"));

    if (activeBizSetValidate.size > 1) {
      const bizTotalsValidate: Record<string, number> = {};
      (pendingFormData.services || []).forEach((s: any, i: number) => {
        const biz = businessAssignments[`service-${i}`] || "Auto Gamma";
        bizTotalsValidate[biz] = (bizTotalsValidate[biz] || 0) + Number(s.price || 0);
      });
      (pendingFormData.ppfs || []).forEach((p: any, i: number) => {
        const biz = businessAssignments[`ppf-${i}`] || "Auto Gamma";
        bizTotalsValidate[biz] = (bizTotalsValidate[biz] || 0) + Number(p.price || 0);
      });
      (pendingFormData.accessories || []).forEach((a: any, i: number) => {
        const biz = businessAssignments[`accessory-${i}`] || "Auto Gamma";
        bizTotalsValidate[biz] = (bizTotalsValidate[biz] || 0) + (Number(a.price || 0) * (Number(a.quantity) || 1));
      });
      if (laborCharge > 0 && laborBusiness) {
        bizTotalsValidate[laborBusiness] = (bizTotalsValidate[laborBusiness] || 0) + laborCharge;
      }
      const gstRate = Number(pendingFormData.gst || 0);
      const gstMode = pendingFormData.gstMode || "exclusive";
      Object.keys(bizTotalsValidate).forEach((biz) => {
        const businessDiscount =
          discountBusiness === "Split"
            ? biz === "Auto Gamma"
              ? Number(discountSplit.autoGamma) || 0
              : Number(discountSplit.agnx) || 0
            : discountBusiness === biz
              ? discount
              : 0;
        const businessSubtotal = Math.max(0, bizTotalsValidate[biz] - businessDiscount);
        bizTotalsValidate[biz] = calculateGstAmounts(
          businessSubtotal,
          gstRate,
          gstMode,
        ).totalAmount;
      });

      for (const biz of Array.from(activeBizSetValidate)) {
        const paid = Number(perBusinessPayments[biz]?.amount) || 0;
        const total = bizTotalsValidate[biz] || 0;
        if (paid > total) {
          toast({
            title: "Invalid Payment Amount",
            description: `Payment for ${biz} (₹${paid.toLocaleString()}) cannot exceed the invoice total (₹${total.toLocaleString()}).`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const businessesPresent = new Set(Object.values(businessAssignments));
    if (laborCharge > 0) businessesPresent.add(laborBusiness);

    if (discount > 0) {
      if (discountBusiness === "Split") {
        const splitTotal = Number(discountSplit.autoGamma) + Number(discountSplit.agnx);
        if (Math.abs(splitTotal - discount) > 0.01) {
          toast({
            title: "Invalid Split",
            description: `Split discount total (₹${splitTotal.toLocaleString()}) must equal total discount (₹${discount.toLocaleString()}).`,
            variant: "destructive",
          });
          return;
        }
        if (discountSplit.autoGamma > 0 && !businessesPresent.has("Auto Gamma")) {
          toast({
            title: "Invalid Split",
            description: "Auto Gamma discount split specified but no items are assigned to Auto Gamma.",
            variant: "destructive",
          });
          return;
        }
        if (discountSplit.agnx > 0 && !businessesPresent.has("AGNX")) {
          toast({
            title: "Invalid Split",
            description: "AGNX discount split specified but no items are assigned to AGNX.",
            variant: "destructive",
          });
          return;
        }
      } else {
        if (discountBusiness === "Auto Gamma" && !businessesPresent.has("Auto Gamma")) {
          toast({
            title: "Invalid Assignment",
            description: "Discount assigned to Auto Gamma but no items are assigned to Auto Gamma.",
            variant: "destructive",
          });
          return;
        }

        if (discountBusiness === "AGNX" && !businessesPresent.has("AGNX")) {
          toast({
            title: "Invalid Assignment",
            description: "Discount assigned to AGNX but no items are assigned to AGNX.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    const autoGammaDiscount = discountBusiness === "Split" ? (Number(discountSplit.autoGamma) || 0) : (discountBusiness === "Auto Gamma" ? discount : 0);
    const agnxDiscount = discountBusiness === "Split" ? (Number(discountSplit.agnx) || 0) : (discountBusiness === "AGNX" ? discount : 0);

    const formattedData = {
      ...pendingFormData,
      services: (pendingFormData.services || []).map((s: any, i: number) => ({ 
        ...s, 
        price: Number(s.price),
        business: businessAssignments[`service-${i}`] || "Auto Gamma"
      })),
      ppfs: (pendingFormData.ppfs || []).map((p: any, i: number) => ({ 
        ...p, 
        price: Number(p.price),
        business: businessAssignments[`ppf-${i}`] || "Auto Gamma"
      })),
      accessories: (pendingFormData.accessories || []).map((a: any, i: number) => ({ 
        ...a, 
        price: Number(a.price),
        business: businessAssignments[`accessory-${i}`] || "Auto Gamma"
      })),
      isPaid: markAsPaid,
      payments: markAsPaid ? payments.map((p: any) => ({ ...p, amount: Number(p.amount) })) : [],
      perBusinessPayments: Object.fromEntries(
        Object.entries(perBusinessPayments).map(([biz, d]) => [biz, { ...d, amount: Number(d.amount) || 0 }])
      ),
      laborCharge: laborCharge,
      laborBusiness: laborBusiness,
      discount: discount,
      autoGammaDiscount: autoGammaDiscount,
      agnxDiscount: agnxDiscount,
      gst: Number(pendingFormData.gst),
    };

    // Fix: Pass the split discounts to invoice generation
    const generateInvoices = async (jobId: string) => {
      // Logic for creating invoices is now handled on the server within storage.createJobCard/updateJobCard
      // This client-side call is redundant and removed to avoid conflicts
      console.log("Invoices generated on server for job:", jobId);
    };

    createJobMutation.mutate(formattedData, {
      onSuccess: (data) => {
        generateInvoices(data.id || jobId);
        setLocation(isSelfKiosk ? `/invoice/${data.id || jobId}?kiosk=1` : "/invoice");
      }
    });
    setShowBusinessDialog(false);
  };

  const realTimeStock = (() => {
    if (!selectedPPF || !selectedPPFRoll) return 0;
    const p = ppfMasters.find(item => item.id === selectedPPF);
    const roll = p?.rolls?.find((r: any) => (r._id?.toString() === selectedPPFRoll) || (r.id?.toString() === selectedPPFRoll));
    if (!roll) return 0;
    
    const usedInCurrentJob = (form.watch("ppfs") || []).reduce((acc: number, field: any) => {
      if (field.rollId === selectedPPFRoll) {
        return acc + (Number(field.rollUsed) || 0);
      }
      return acc;
    }, 0);
    
    const usableStock = Math.max(0, Number(roll.stock) || 0);
    return usableStock - usedInCurrentJob;
  })();
  const { data: vehicleTypes = [] } = useQuery<any[]>({
    queryKey: [api.masters.vehicleTypes.list.path],
  });
  const { data: accessoryCategories = [] } = useQuery<any[]>({
    queryKey: [api.masters.accessories.categories.list.path],
  });

  const goToKioskStep = async (nextStep: number) => {
    if (!isSelfKiosk) return;

    if (nextStep > kioskStep) {
      if (kioskStep === 1) {
        const valid = await form.trigger([
          "phoneNumber",
          "customerName",
          "referralSource",
          "make",
          "model",
          "licensePlate",
          "vehicleType",
          "date",
        ]);
        if (!valid) {
          toast({
            title: "Complete customer and vehicle details",
            description: "Please fill the required fields before continuing.",
            variant: "destructive",
          });
          return;
        }
      }

      if (kioskStep === 2) {
        const hasSelectedWork =
          form.getValues("services").length > 0 ||
          form.getValues("ppfs").length > 0 ||
          form.getValues("accessories").length > 0 ||
          Number(form.getValues("laborCharge") || 0) > 0;
        if (!hasSelectedWork) {
          toast({
            title: "Add at least one service",
            description: "Select a service, PPF, accessory, or labor charge before billing.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setKioskStep(Math.max(1, Math.min(3, nextStep)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isSelfKiosk && kioskScreen === "home") {
    return (
      <SelfKioskHome
        onOpenInquiry={() => setKioskScreen("inquiry")}
        onOpenTicket={() => setKioskScreen("ticket")}
        onStartCheckIn={() => setKioskScreen("checkin")}
      />
    );
  }

  if (isSelfKiosk && kioskScreen === "inquiry") {
    return <SelfKioskInquiry onBack={() => setKioskScreen("home")} />;
  }

  if (isSelfKiosk && kioskScreen === "ticket") {
    return <SelfKioskTicket onBack={() => setKioskScreen("home")} />;
  }

  const kioskStepLabels = ["Customer & Vehicle", "Services & Products", "Billing"];

  const pageContent = (
      <div className={`${isSelfKiosk ? "mx-auto min-h-screen w-full max-w-2xl space-y-6 px-4 py-5 sm:px-6" : "space-y-6 max-w-5xl mx-auto pb-12"}`}>
        <div className="flex items-start gap-4">
          {isSelfKiosk ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setKioskScreen("home")}
              className="mt-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/job-cards")}
              className="mt-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isSelfKiosk ? "Customer Self-Service Check-In" : jobId ? "Edit Job Card" : "Create New Job Card"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSelfKiosk
                ? "Enter your details first. Our service advisor will complete the service and billing."
                : jobId
                  ? `Updating details for job card ${jobToEdit?.jobNo || ""}`
                  : "Fill in the details below to create a new service job card"}
            </p>
          </div>
        </div>

        {isSelfKiosk && (
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-red-100 bg-white p-2 shadow-sm">
            {kioskStepLabels.map((label, index) => {
              const step = index + 1;
              const active = kioskStep === step;
              const complete = kioskStep > step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => step < kioskStep && goToKioskStep(step)}
                  className={`rounded-lg px-2 py-2 text-center text-[11px] font-bold transition-colors ${
                    active
                      ? "bg-red-600 text-white"
                      : complete
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wider">Step {step}</span>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {(!isSelfKiosk || kioskStep === 1) && (
              <>
            {/* Customer Information Section */}
            <Card className="border-slate-200">
              <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-lg font-bold">Customer Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Phone Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="10-digit number" 
                            {...field} 
                            maxLength={10}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              field.onChange(value);
                            }}
                            className={`h-11 ${form.formState.errors.phoneNumber ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {isFetchingCustomer && (
                          <p className="text-xs text-slate-500 mt-1">Fetching...</p>
                        )}
                        {form.formState.errors.phoneNumber && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.phoneNumber.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Customer Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Doe" 
                            {...field} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const transformed = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                              field.onChange(transformed);
                            }}
                            className={`h-11 ${form.formState.errors.customerName ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {form.formState.errors.customerName && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.customerName.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="emailAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" {...field} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hasGst"
                      checked={hasGst}
                      onChange={(e) => {
                        setHasGst(e.target.checked);
                        if (!e.target.checked) setGstNumber("");
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-red-600"
                    />
                    <label htmlFor="hasGst" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Customer has GST number
                    </label>
                  </div>
                  {hasGst && (
                    <Input
                      placeholder="Enter GST number (e.g. 27AAPFU0939F1ZV)"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                      className="h-11"
                    />
                  )}
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Job Date *</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            className={`h-11 ${form.formState.errors.date ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`}
                          />
                        </FormControl>
                        {form.formState.errors.date && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.date.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">How did you hear about us? *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger className={`h-11 ${form.formState.errors.referralSource ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`}>
                              <SelectValue placeholder="Select referral source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Google Search">Google Search</SelectItem>
                            <SelectItem value="Social Media">Social Media</SelectItem>
                            <SelectItem value="Friend/Family">Friend/Family</SelectItem>
                            <SelectItem value="Advertisement">Advertisement</SelectItem>
                            <SelectItem value="Walk-in">Walk-in</SelectItem>
                          </SelectContent>
                        </Select>
                        {form.formState.errors.referralSource && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.referralSource.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                    {form.watch("referralSource") === "Friend/Family" && (
                      <div className="contents">
                        <FormField
                          control={form.control}
                          name="referrerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-slate-700">Referrer's Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter name of the person who referred" {...field} className="h-11" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="referrerPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-slate-700">Referrer's Phone Number</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="10-digit mobile number" 
                                  {...field} 
                                  className="h-11" 
                                  maxLength={10}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "");
                                    field.onChange(value);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
              </CardContent>
            </Card>

            {/* Vehicle Information Section */}
            <Card className="border-slate-200">
              <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <Car className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-lg font-bold">Vehicle Information</CardTitle>
                  </div>
                  {/* Inline vehicle selector — only for new job cards when customer exists */}
                  {!jobId && fetchedCustomerVehicles.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedVehicleKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          if (key === "__new__") {
                            setSelectedVehicleKey("__new__");
                            form.setValue("make", "");
                            form.setValue("model", "");
                            form.setValue("year", "");
                            form.setValue("licensePlate", "");
                            form.setValue("vehicleType", "");
                          } else {
                            const v = fetchedCustomerVehicles.find(
                              (v) => `${v.make}-${v.model}-${v.licensePlate}` === key
                            );
                            if (v) {
                              setSelectedVehicleKey(key);
                              form.setValue("make", v.make);
                              form.setValue("model", v.model);
                              form.setValue("year", v.year);
                              form.setValue("licensePlate", v.licensePlate);
                              form.setValue("vehicleType", v.vehicleType);
                            }
                          }
                        }}
                        className="h-9 rounded-md border border-red-200 bg-white px-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23dc2626' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "28px" }}
                      >
                        {fetchedCustomerVehicles.map((v, idx) => {
                          const key = `${v.make}-${v.model}-${v.licensePlate}`;
                          return (
                            <option key={idx} value={key}>
                              {v.make} {v.model}{v.year ? ` (${v.year})` : ""} · {v.licensePlate.toUpperCase()}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVehicleKey("__new__");
                          form.setValue("make", "");
                          form.setValue("model", "");
                          form.setValue("year", "");
                          form.setValue("licensePlate", "");
                          form.setValue("vehicleType", "");
                        }}
                        className={`h-9 px-3 rounded-md border text-sm font-semibold transition-colors whitespace-nowrap ${
                          selectedVehicleKey === "__new__"
                            ? "bg-red-600 border-red-600 text-white"
                            : "border-red-300 text-red-600 bg-white hover:bg-red-50"
                        }`}
                      >
                        + New
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Make *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Toyota" 
                            {...field} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const transformed = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                              field.onChange(transformed);
                            }}
                            className={`h-11 ${form.formState.errors.make ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {form.formState.errors.make && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.make.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Model *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Camry" 
                            {...field} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const transformed = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                              field.onChange(transformed);
                            }}
                            className={`h-11 ${form.formState.errors.model ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {form.formState.errors.model && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.model.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Year (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="2024 or leave blank for NA" 
                            {...field}
                            inputMode="numeric"
                            maxLength={4}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                            className={`h-11 ${form.formState.errors.year ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {form.formState.errors.year && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.year.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="licensePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">License Plate *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="AA 00 AA 0000 / YY BH 0000 AA" 
                            {...field} 
                            onChange={(e) => {
                              let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                              
                              // Check if it's Bharat Series (starts with 2 digits followed by BH)
                              const isBH = val.length >= 4 && /^\d{2}BH/.test(val);
                              
                              let formatted = "";
                              if (isBH) {
                                // YY BH 0000 AA
                                if (val.length > 0) formatted += val.substring(0, 2);
                                if (val.length > 2) formatted += " " + val.substring(2, 4);
                                if (val.length > 4) formatted += " " + val.substring(4, 8);
                                if (val.length > 8) formatted += " " + val.substring(8, 10);
                                field.onChange(formatted.trim());
                              } else {
                                // AA 00 AA 0000
                                if (val.length > 0) formatted += val.substring(0, 2);
                                if (val.length > 2) formatted += " " + val.substring(2, 4);
                                if (val.length > 4) formatted += " " + val.substring(4, 6);
                                if (val.length > 6) formatted += " " + val.substring(6, 10);
                                field.onChange(formatted.trim());
                              }
                            }}
                            maxLength={13} // Max length for YY BH 0000 AA is 13 with spaces
                            className={`h-11 ${form.formState.errors.licensePlate ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`} 
                          />
                        </FormControl>
                        {form.formState.errors.licensePlate && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.licensePlate.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vehicleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Vehicle Type *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger className={`h-11 ${form.formState.errors.vehicleType ? "border-red-500 ring-1 ring-red-500 bg-red-50" : ""}`}>
                              <SelectValue placeholder="Select vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vehicleTypes.map((type: any) => (
                              <SelectItem key={type.id} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.vehicleType && (
                          <p className="text-xs font-bold text-red-600 mt-1">
                            {form.formState.errors.vehicleType.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
              </>
            )}

            {(!isSelfKiosk || kioskStep === 2) && (
              <>
            {isSelfKiosk && (
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-red-100 bg-white p-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => {
                    setKioskProductSection("services");
                    setServicesExpanded(true);
                  }}
                  className={`rounded-lg px-2 py-3 text-center text-xs font-bold transition-colors ${
                    kioskProductSection === "services" ? "bg-red-600 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <Settings className="mx-auto mb-1 h-4 w-4" />
                  Services
                  {serviceFields.length > 0 && <span className="ml-1">({serviceFields.length})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKioskProductSection("ppf");
                    setPpfExpanded(true);
                  }}
                  className={`rounded-lg px-2 py-3 text-center text-xs font-bold transition-colors ${
                    kioskProductSection === "ppf" ? "bg-red-600 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <Shield className="mx-auto mb-1 h-4 w-4" />
                  PPF
                  {ppfFields.length > 0 && <span className="ml-1">({ppfFields.length})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKioskProductSection("accessories");
                    setAccessoriesExpanded(true);
                  }}
                  className={`rounded-lg px-2 py-3 text-center text-xs font-bold transition-colors ${
                    kioskProductSection === "accessories" ? "bg-red-600 text-white" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  <Package className="mx-auto mb-1 h-4 w-4" />
                  Accessories
                  {accessoryFields.length > 0 && <span className="ml-1">({accessoryFields.length})</span>}
                </button>
              </div>
            )}

            {(!isSelfKiosk || kioskProductSection === "services") && (
              <>
            {/* Service Section */}
            <Card className="border-slate-200">
              <CardHeader 
                className="border-b bg-slate-50/50 py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => setServicesExpanded(!servicesExpanded)}
                data-testid="section-services-header"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-lg font-bold">Services</CardTitle>
                    {serviceFields.length > 0 && (
                      <span className="text-sm text-muted-foreground">({serviceFields.length} added)</span>
                    )}
                  </div>
                  {servicesExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  )}
                </div>
              </CardHeader>
              {servicesExpanded && (
              <CardContent className="p-6 space-y-4">
                {(() => {
                  const vehicleType = form.watch("vehicleType");
                  const selectedSvc = services.find(s => s.id === selectedService);
                  const vehiclePricing = (selectedSvc?.pricingByVehicleType as any[])?.find(p => p.vehicleType === vehicleType);
                  const warrantyOptions: any[] = vehiclePricing?.warrantyOptions || [];
                  const hasWarranty = warrantyOptions.length > 0;
                  return (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className={hasWarranty ? "md:col-span-3 space-y-1.5" : "md:col-span-4 space-y-1.5"}>
                    <label className="text-xs font-bold text-muted-foreground uppercase">Service</label>
                    <Select value={selectedService} onValueChange={(val) => {
                      setSelectedService(val);
                      setSelectedServiceWarranty("");
                      const svc = services.find(s => s.id === val);
                      if (svc && (svc as any).hsnCode) {
                        setServiceHsn((svc as any).hsnCode);
                      } else {
                        setServiceHsn("");
                      }
                    }}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Service" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id!}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasWarranty && (
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Warranty</label>
                      <Select value={selectedServiceWarranty} onValueChange={setSelectedServiceWarranty}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Warranty" />
                        </SelectTrigger>
                        <SelectContent>
                          {warrantyOptions.map((opt: any, i: number) => (
                            <SelectItem key={i} value={opt.warrantyName}>
                              {opt.warrantyName} — ₹{opt.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Technician (Optional)</label>
                    <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Tech" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {technicians.filter(t => t.status === "active").map(t => (
                          <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={hasWarranty ? "md:col-span-2 space-y-1.5" : "md:col-span-3 space-y-1.5"}>
                    <label className="text-xs font-bold text-muted-foreground uppercase">HSN Code</label>
                    <HsnCombobox value={serviceHsn} onChange={setServiceHsn} placeholder="HSN code (search or type)..." />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={handleAddService} className="w-full h-11 bg-red-100 text-red-600 hover:bg-red-200 border-none font-semibold">
                      Add Service
                    </Button>
                  </div>
                </div>
                  );
                })()}
                {serviceFields.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="bg-slate-50 p-3 text-xs font-bold uppercase text-slate-500 border-b">Selected Services</div>
                    <div className="divide-y">
                      {serviceFields.map((field, index) => (
                        <div key={field.id} className="flex items-center justify-between p-3">
                          <span className="text-sm font-medium">{(field as any).name}</span>
                          <Button variant="ghost" size="icon" type="button" onClick={() => removeService(index)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              )}
            </Card>
              </>
            )}

            {(!isSelfKiosk || kioskProductSection === "ppf") && (
              <>
            {/* PPF Section */}
            <Card className="border-slate-200">
              <CardHeader 
                className="border-b bg-slate-50/50 py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => setPpfExpanded(!ppfExpanded)}
                data-testid="section-ppf-header"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-lg font-bold">PPF (Paint Protection Film)</CardTitle>
                    {ppfFields.length > 0 && (
                      <span className="text-sm text-muted-foreground">({ppfFields.length} added)</span>
                    )}
                  </div>
                  {ppfExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  )}
                </div>
              </CardHeader>
              {ppfExpanded && (
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">PPF</label>
                    <Select value={selectedPPF} onValueChange={setSelectedPPF}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select PPF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ppfMasters.map(p => (
                          <SelectItem key={p.id} value={p.id!}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        {ppfTouchupMode ? "Touchup Price (₹)" : "Warranty"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPpfTouchupMode(!ppfTouchupMode);
                          setSelectedWarranty("");
                          setPpfTouchupPrice(0);
                        }}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${ppfTouchupMode ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        {ppfTouchupMode ? "✓ Touchup" : "Touchup?"}
                      </button>
                    </div>
                    {ppfTouchupMode ? (
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={ppfTouchupPrice || ""}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setPpfTouchupPrice(parseFloat(value) || 0);
                        }}
                        placeholder="Enter custom price"
                        className="h-11"
                        disabled={!selectedPPF}
                      />
                    ) : (
                      <Select value={selectedWarranty} onValueChange={setSelectedWarranty} disabled={!selectedPPF || !form.watch("vehicleType")}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select Warranty" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentPPF?.pricingByVehicleType
                            ?.find(v => v.vehicleType === form.watch("vehicleType"))
                            ?.options.map(o => (
                              <SelectItem key={o.warrantyName} value={o.warrantyName}>{o.warrantyName}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Select Roll</label>
                    <RollCombobox
                      disabled={!selectedPPF}
                      value={selectedPPFRoll}
                      onChange={setSelectedPPFRoll}
                      rolls={(currentPPF?.rolls ?? [])
                        .filter((roll: any) => (roll.stock || 0) > 10)
                        .map((roll: any) => {
                          const used = form.watch("ppfs")
                            .filter((p: any) => p.ppfId === selectedPPF)
                            .reduce((sum: number, p: any) => {
                              const rollNameEscaped = roll.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const regex = new RegExp(`Quantity: (\\d+(?:\\.\\d+)?)sqft \\(from ${rollNameEscaped}\\)`);
                              const match = p.name.match(regex);
                              return sum + (match ? parseFloat(match[1]) : 0);
                            }, 0);
                          return {
                            id: getPpfRollId(roll),
                            name: roll.name as string,
                            availableStock: Math.max(0, (roll.stock || 0) - used),
                          };
                        })
                        .filter((roll: any) => roll.id)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Sqft Used</label>
                    <Input 
                      type="text" 
                      inputMode="decimal"
                      value={rollQty || ""} 
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setRollQty(parseFloat(value) || 0);
                      }}
                      placeholder="0"
                      className="h-11"
                      disabled={!selectedPPF}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={handleAddPPF} className="w-full h-11 bg-red-100 text-red-600 hover:bg-red-200 border-none font-semibold">
                      Add PPF
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">HSN Code</label>
                    <HsnCombobox value={ppfHsn} onChange={setPpfHsn} placeholder="HSN code (search or type)..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Available Stock (sqft)</label>
                    <div className="h-11 flex items-center px-3 border rounded-md bg-slate-50 font-medium text-slate-700">
                      {selectedPPF ? (() => {
                        const totalStock = currentPPF?.rolls
                          ?.filter((r: any) => (r.stock || 0) > 10)
                          .reduce((acc: number, r: any) => acc + (r.stock || 0), 0) || 0;
                        const usedInCurrentJob = ppfFields.reduce((acc, field: any) => {
                          const isSamePPF = field.ppfId === selectedPPF;
                          if (!isSamePPF) return acc;
                          
                          // Sum all quantities from the description
                          const matches = field.name.match(/Quantity: (\d+(?:\.\d+)?)sqft/g);
                          if (matches) {
                            return acc + matches.reduce((sum: number, m: string) => {
                              const q = m.match(/Quantity: (\d+(?:\.\d+)?)sqft/);
                              return sum + (q ? parseFloat(q[1]) : 0);
                            }, 0);
                          }
                          return acc + (field.rollUsed || 0);
                        }, 0);
                        return `${totalStock - usedInCurrentJob} sqft`;
                      })() : "Select PPF"}
                    </div>
                  </div>
                </div>
                {ppfFields.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    <div className="bg-slate-50 p-3 text-xs font-bold uppercase text-slate-500 border-b">Selected PPF</div>
                      {ppfFields.map((field, index) => (
                        <div key={field.id} className="flex items-center justify-between p-3">
                          <div className="flex flex-col">
                            {field.name.split('\n').map((line: string, i: number) => (
                              <span key={i} className={i === 0 ? "text-sm font-medium" : "text-xs text-slate-500"}>
                                {line}
                              </span>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" type="button" onClick={() => removePPF(index)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
              )}
            </Card>
              </>
            )}

            {(!isSelfKiosk || kioskProductSection === "accessories") && (
              <>
            {/* Accessories Section */}
            <Card className="border-slate-200">
              <CardHeader 
                className="border-b bg-slate-50/50 py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => setAccessoriesExpanded(!accessoriesExpanded)}
                data-testid="section-accessories-header"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-lg font-bold">Accessories</CardTitle>
                    {accessoryFields.length > 0 && (
                      <span className="text-sm text-muted-foreground">({accessoryFields.length} added)</span>
                    )}
                  </div>
                  {accessoriesExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  )}
                </div>
              </CardHeader>
              {accessoriesExpanded && (
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Accessory Category</label>
                    <Select 
                      value={selectedAccessoryCategory} 
                      onValueChange={(val) => {
                        setSelectedAccessoryCategory(val);
                        setSelectedAccessory("");
                        setAccessorySearch("");
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b sticky top-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                          <div className="relative mb-2">
                            <input
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Search select category..."
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start font-bold text-red-600 h-8 px-2 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewAccessoryData(prev => ({ ...prev, category: categorySearch || "" }));
                              setShowAddAccessoryDialog(true);
                            }}
                          >
                            + Add New Category
                          </Button>
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Accessory Name</label>
                    <Select 
                      value={selectedAccessory} 
                      onValueChange={(val) => { setSelectedAccessory(val); setAccessoryWindowType(""); }} 
                      disabled={!selectedAccessoryCategory}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Accessory" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b sticky top-0 bg-white z-10" onClick={(e) => e.stopPropagation()}>
                          <div className="relative mb-2">
                            <input
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Search accessory..."
                              value={accessorySearch}
                              onChange={(e) => setAccessorySearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {accessorySearch.trim() && (
                            <div className="space-y-2 p-2 bg-slate-50 rounded-md border border-slate-200">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Add New Accessory</p>
                              <div className="flex gap-2">
                                <Input 
                                  type="number" 
                                  placeholder="Price" 
                                  value={newAccessoryPrice}
                                  onChange={(e) => setNewAccessoryPrice(e.target.value)}
                                  className="h-8 text-xs"
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                                <Button 
                                  size="sm"
                                  className="h-8 bg-red-600 text-white text-xs px-2 whitespace-nowrap"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (accessorySearch.trim()) {
                                      createAccessoryMutation.mutate({
                                        category: selectedAccessoryCategory,
                                        name: accessorySearch.trim(),
                                        price: Number(newAccessoryPrice || 0),
                                        quantity: 100
                                      });
                                      setNewAccessoryPrice("");
                                      setAccessorySearch("");
                                    }
                                  }}
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredAccessories.map(a => (
                            <SelectItem key={a.id} value={a.id!}>{a.name} (₹{a.price})</SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Quantity</label>
                    <Input 
                      type="number" 
                      value={accessoryQty} 
                      onChange={(e) => setAccessoryQty(parseInt(e.target.value) || 1)}
                      min="1"
                      className="h-11"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Price</label>
                    <div className="h-11 flex items-center px-3 border rounded-md bg-slate-50 font-medium text-slate-700">
                      ₹{selectedAccessory ? (() => {
                        const a = accessories.find(acc => acc.id === selectedAccessory);
                        return a ? getEffectiveAccessoryPrice(a) * accessoryQty : 0;
                      })() : 0}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={handleAddAccessory} className="w-full h-11 bg-red-100 text-red-600 hover:bg-red-200 border-none font-semibold">
                      Add Item
                    </Button>
                  </div>
                </div>
                {/* Window type selector for dual pricing accessories */}
                {(() => {
                  const a = selectedAccessory ? accessories.find(acc => acc.id === selectedAccessory) : null;
                  if (!a || !a.hasDualPricing) return null;
                  return (
                    <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-xs font-bold text-amber-700 uppercase whitespace-nowrap">Window Type *</span>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAccessoryWindowType("4window")}
                          className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-colors ${accessoryWindowType === "4window" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-300 hover:border-red-400"}`}
                        >
                          4 Window — ₹{(a.price4Window || 0).toLocaleString("en-IN")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccessoryWindowType("6window")}
                          className={`px-4 py-1.5 rounded-md text-sm font-semibold border transition-colors ${accessoryWindowType === "6window" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-300 hover:border-red-400"}`}
                        >
                          6 Window — ₹{(a.price6Window || 0).toLocaleString("en-IN")}
                        </button>
                      </div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">HSN Code</label>
                    <HsnCombobox value={accessoryHsn} onChange={setAccessoryHsn} placeholder="HSN code (search or type)..." />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Available Amount</label>
                    <div className="h-11 flex items-center px-3 border rounded-md bg-slate-50 font-medium text-slate-700">
                      {selectedAccessory ? (() => {
                        const accessory = accessories.find(a => a.id === selectedAccessory);
                        const originalQty = jobToEdit?.accessories?.find((acc: any) => 
                          (acc.accessoryId || acc.id || acc._id) === selectedAccessory
                        )?.quantity || 0;
                        const usedInCurrentJob = accessoryFields.reduce((sum, field: any) => {
                          if (field.accessoryId === selectedAccessory) {
                            return sum + (Number(field.quantity) || 0);
                          }
                          return sum;
                        }, 0);
                         const available = Math.max(
                           0,
                           (accessory?.quantity || 0) + originalQty - usedInCurrentJob,
                         );
                         const buffer = Number(accessory?.buffer || 0);
                         return buffer > 0
                           ? `${available} units · ${buffer} buffered`
                           : `${available} units`;
                      })() : "Select Accessory"}
                    </div>
                  </div>
                </div>
            {accessoryFields.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="bg-slate-50 p-3 text-xs font-bold uppercase text-slate-500 border-b">Selected Accessories</div>
                <div className="divide-y">
                  {accessoryFields.map((field, index) => (
                    <div key={field.id} className="flex items-center justify-between p-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{(field as any).name}</span>
                        <span className="text-xs text-muted-foreground">Quantity: {(field as any).quantity || 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" type="button" onClick={() => removeAccessory(index)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </CardContent>
              )}
            </Card>
              </>
            )}
              </>
            )}

            {(!isSelfKiosk || kioskStep === 3) && (
              <>
            {/* Charges and Notes Section */}
            <Card className="border-slate-200">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="laborCharge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Labor Charge (₹)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value} 
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, "");
                              field.onChange(val === "" ? 0 : parseInt(val));
                            }} 
                            placeholder="0"
                            className="h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Discount (₹)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value} 
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, "");
                              field.onChange(val === "" ? 0 : parseInt(val));
                            }} 
                            placeholder="0"
                            className="h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gst"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel className="text-sm font-semibold text-slate-700">GST (%)</FormLabel>
                          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                            {(["exclusive", "inclusive"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => form.setValue("gstMode", mode, { shouldDirty: true })}
                                className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                                  form.watch("gstMode") === mode
                                    ? "bg-white text-red-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                {mode === "exclusive" ? "Excluding GST" : "Including GST"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={field.value} 
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, "");
                              field.onChange(val === "" ? 0 : parseInt(val));
                            }} 
                            placeholder="0"
                            className="h-11 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="serviceNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Service Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Additional notes for the invoice..." {...field} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Pricing Table */}
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <FileText className="h-5 w-5 text-red-600" />
                    Estimated Pricing
                  </h3>
                  <div className="bg-slate-50 rounded-lg border overflow-hidden">
                    <div className="p-4 space-y-3">
                      {[...form.watch("services"), ...form.watch("ppfs"), ...form.watch("accessories")].map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">{item.name} {Number(item.quantity) > 1 ? `(x${item.quantity})` : ""}</span>
                          <span className="font-semibold">₹{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                        </div>
                      ))}
                      {form.watch("laborCharge") > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Labor Charge</span>
                          <span className="font-semibold">₹{form.watch("laborCharge").toLocaleString()}</span>
                        </div>
                      )}
                      
                      {form.watch("discount") > 0 && (
                        <div className="flex justify-between items-center text-sm text-red-600">
                          <span className="font-medium">Discount</span>
                          <span className="font-semibold">- ₹{form.watch("discount").toLocaleString()}</span>
                        </div>
                      )}
                      
                      <div className="border-t pt-2 mt-2 space-y-2">
                        {(() => {
                          const grandTotal = [...form.watch("services"), ...form.watch("ppfs"), ...form.watch("accessories")].reduce((acc, curr) => acc + ((Number(curr.price) || 0) * (Number(curr.quantity) || 1)), 0) +
                            Number(form.watch("laborCharge") || 0) -
                            Number(form.watch("discount") || 0);
                           const gstRate = Number(form.watch("gst") || 0);
                           const gstMode = form.watch("gstMode") || "exclusive";
                           const {
                             taxableSubtotal,
                             gstAmount,
                             totalAmount: totalWithGst,
                           } = calculateGstAmounts(grandTotal, gstRate, gstMode);
                            const { sgstAmount, cgstAmount } = splitGstAmount(gstAmount);
                          return (
                            <>
                              <div className="flex justify-between items-center text-sm font-medium">
                                 <span className="text-slate-500">
                                   Subtotal{gstMode === "inclusive" ? " (GST included)" : ""}
                                 </span>
                                <span>₹{Math.round(grandTotal).toLocaleString()}</span>
                              </div>
                              {gstRate > 0 && (
                                <>
                                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                                    <span>SGST ({(gstRate / 2).toFixed(2)}%)</span>
                                      <span>₹{formatGstAmount(sgstAmount)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                                    <span>CGST ({(gstRate / 2).toFixed(2)}%)</span>
                                      <span>₹{formatGstAmount(cgstAmount)}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                <span className="text-base font-bold text-slate-900">Total Estimated Cost</span>
                                <span className="text-xl font-black text-red-600">₹{Math.round(totalWithGst).toLocaleString()}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
              </>
            )}

            {isSelfKiosk ? (
              <div className="flex gap-3 pt-2">
                {kioskStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => goToKioskStep(kioskStep - 1)}
                    className="h-12 flex-1"
                  >
                    Back
                  </Button>
                )}
                {kioskStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => goToKioskStep(kioskStep + 1)}
                    className="h-12 flex-1 bg-red-600 font-bold hover:bg-red-700"
                  >
                    Continue to {kioskStep === 1 ? "Services" : "Billing"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-12 flex-1 bg-red-600 font-bold hover:bg-red-700"
                    disabled={createJobMutation.isPending}
                    onClick={() => onSubmit(form.getValues())}
                  >
                    {createJobMutation.isPending ? "Saving..." : "Continue to Business Assignment"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/job-cards")} className="h-12 px-8">
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-12 px-8 bg-red-600 hover:bg-red-700 font-bold"
                  disabled={createJobMutation.isPending}
                  onClick={async () => {
                    console.log("Update button clicked manually");
                    const data = form.getValues();
                    await onSubmit(data);
                  }}
                >
                  {createJobMutation.isPending ? "Saving..." : (jobId ? "Update Job Card" : "Create Job Card")}
                </Button>
              </div>
            )}
          </form>
        </Form>

        <Dialog open={showAddAccessoryDialog} onOpenChange={setShowAddAccessoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Accessory</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Category Name</label>
                <Input 
                  value={newAccessoryData.category}
                  onChange={(e) => setNewAccessoryData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g. Interior"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Accessory Name</label>
                <Input 
                  value={newAccessoryData.name}
                  onChange={(e) => setNewAccessoryData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Seat Cover"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Price (₹)</label>
                  <Input 
                    type="number"
                    value={newAccessoryData.price}
                    onChange={(e) => setNewAccessoryData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Initial Stock Quantity</label>
                  <Input 
                    type="number"
                    value={newAccessoryData.quantity}
                    onChange={(e) => setNewAccessoryData(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="100"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddAccessoryDialog(false)}>Cancel</Button>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (!newAccessoryData.category || !newAccessoryData.name || !newAccessoryData.price) {
                    toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
                    return;
                  }
                  createAccessoryMutation.mutate({
                    category: newAccessoryData.category,
                    name: newAccessoryData.name,
                    price: Number(newAccessoryData.price),
                    quantity: Number(newAccessoryData.quantity || 0)
                  });
                }}
              >
                Save & Add to Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showBusinessDialog} onOpenChange={setShowBusinessDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Complete Service - Assign Business</DialogTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Select which business each service item belongs to. Separate invoices will be generated for each business.
              </p>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {pendingFormData?.services.map((item: any, i: number) => (
                <div key={`service-${i}`} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">₹{item.price}</p>
                  </div>
                  <div className="w-48">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Assign To</p>
                    <Select 
                      value={businessAssignments[`service-${i}`]} 
                      onValueChange={(val: any) => setBusinessAssignments(prev => ({ ...prev, [`service-${i}`]: val }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
                        <SelectItem value="AGNX">AGNX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              {pendingFormData?.ppfs.map((item: any, i: number) => (
                <div key={`ppf-${i}`} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">₹{item.price}</p>
                  </div>
                  <div className="w-48">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Assign To</p>
                    <Select 
                      value={businessAssignments[`ppf-${i}`]} 
                      onValueChange={(val: any) => setBusinessAssignments(prev => ({ ...prev, [`ppf-${i}`]: val }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
                        <SelectItem value="AGNX">AGNX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              {pendingFormData?.accessories.map((item: any, i: number) => (
                <div key={`accessory-${i}`} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">₹{item.price}</p>
                  </div>
                  <div className="w-48">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Assign To</p>
                    <Select 
                      value={businessAssignments[`accessory-${i}`]} 
                      onValueChange={(val: any) => setBusinessAssignments(prev => ({ ...prev, [`accessory-${i}`]: val }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
                        <SelectItem value="AGNX">AGNX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              {pendingFormData && pendingFormData.laborCharge > 0 && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-900">Labor Charge</p>
                    <p className="text-sm text-slate-500">₹{pendingFormData.laborCharge}</p>
                  </div>
                  <div className="w-48">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Assign To</p>
                    <Select 
                      value={laborBusiness} 
                      onValueChange={(val: any) => setLaborBusiness(val)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
                        <SelectItem value="AGNX">AGNX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {pendingFormData && Number(pendingFormData.discount) > 0 && (
                <div className="pt-4 border-t space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                    <div>
                      <p className="font-semibold text-slate-900">Discount</p>
                      <p className="text-sm text-slate-500">₹{pendingFormData.discount}</p>
                    </div>
                    <div className="w-48">
                      <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Assign To</p>
                      <Select 
                        value={discountBusiness} 
                        onValueChange={(val: any) => setDiscountBusiness(val)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Auto Gamma">Auto Gamma</SelectItem>
                          <SelectItem value="AGNX">AGNX</SelectItem>
                          <SelectItem value="Split">Split</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {discountBusiness === "Split" && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-red-50/30">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Auto Gamma Portion (₹)</label>
                        <Input 
                          type="number"
                          value={discountSplit.autoGamma}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const target = Number(pendingFormData.discount) || 0;
                            if (val > target) {
                              setDiscountSplit({ autoGamma: target, agnx: 0 });
                            } else {
                              setDiscountSplit({ autoGamma: val, agnx: Math.max(0, target - val) });
                            }
                          }}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AGNX Portion (₹)</label>
                        <Input 
                          type="number"
                          value={discountSplit.agnx}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const target = Number(pendingFormData.discount) || 0;
                            if (val > target) {
                              setDiscountSplit({ autoGamma: 0, agnx: target });
                            } else {
                              setDiscountSplit({ agnx: val, autoGamma: Math.max(0, target - val) });
                            }
                          }}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2 text-[10px] font-medium text-slate-500 text-center">
                        Total Split: ₹{(Number(discountSplit.autoGamma) + Number(discountSplit.agnx)).toLocaleString()} / Target: ₹{Number(pendingFormData.discount).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t space-y-4">
                {(() => {
                  // Compute which businesses are active based on current assignments
                  const activeBizSet = new Set<string>();
                  (pendingFormData?.services || []).forEach((_: any, i: number) => activeBizSet.add(businessAssignments[`service-${i}`] || "Auto Gamma"));
                  (pendingFormData?.ppfs || []).forEach((_: any, i: number) => activeBizSet.add(businessAssignments[`ppf-${i}`] || "Auto Gamma"));
                  (pendingFormData?.accessories || []).forEach((_: any, i: number) => activeBizSet.add(businessAssignments[`accessory-${i}`] || "Auto Gamma"));
                  if ((pendingFormData?.laborCharge || 0) > 0 && laborBusiness) activeBizSet.add(laborBusiness);
                  const isMultiBiz = activeBizSet.size > 1;

                  if (isMultiBiz) {
                    // Compute per-business subtotals
                    const bizTotals: Record<string, number> = {};
                    (pendingFormData?.services || []).forEach((s: any, i: number) => {
                      const biz = businessAssignments[`service-${i}`] || "Auto Gamma";
                      bizTotals[biz] = (bizTotals[biz] || 0) + Number(s.price || 0);
                    });
                    (pendingFormData?.ppfs || []).forEach((p: any, i: number) => {
                      const biz = businessAssignments[`ppf-${i}`] || "Auto Gamma";
                      bizTotals[biz] = (bizTotals[biz] || 0) + Number(p.price || 0);
                    });
                    (pendingFormData?.accessories || []).forEach((a: any, i: number) => {
                      const biz = businessAssignments[`accessory-${i}`] || "Auto Gamma";
                      bizTotals[biz] = (bizTotals[biz] || 0) + (Number(a.price || 0) * (Number(a.quantity) || 1));
                    });
                    if ((pendingFormData?.laborCharge || 0) > 0 && laborBusiness) {
                      bizTotals[laborBusiness] = (bizTotals[laborBusiness] || 0) + Number(pendingFormData.laborCharge || 0);
                    }
                     const gstRate = Number(pendingFormData?.gst || 0);
                     const gstMode = pendingFormData?.gstMode || "exclusive";
                     Object.keys(bizTotals).forEach((biz) => {
                       const businessDiscount =
                         discountBusiness === "Split"
                           ? biz === "Auto Gamma"
                             ? Number(discountSplit.autoGamma) || 0
                             : Number(discountSplit.agnx) || 0
                           : discountBusiness === biz
                             ? Number(pendingFormData?.discount || 0)
                             : 0;
                       const businessSubtotal = Math.max(0, bizTotals[biz] - businessDiscount);
                       bizTotals[biz] = calculateGstAmounts(
                         businessSubtotal,
                         gstRate,
                         gstMode,
                       ).totalAmount;
                     });
                    const today = new Date().toISOString().split("T")[0];

                    return (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900">Payment Details</h4>
                        <p className="text-xs text-muted-foreground">Enter how much has been paid for each business invoice separately.</p>
                        {Array.from(activeBizSet).map(biz => {
                          const total = bizTotals[biz] || 0;
                          const d = perBusinessPayments[biz] || { amount: "", method: "Cash", date: today };
                          const paid = Number(d.amount) || 0;
                          const remaining = Math.max(0, total - paid);
                          return (
                            <div key={biz} className="border rounded-lg p-3 space-y-3 bg-slate-50/50">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">{biz}</span>
                                <div className="flex gap-3 text-right">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Invoice Total</span>
                                    <span className="text-sm font-semibold text-slate-700">₹{total.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Remaining</span>
                                    <span className={`text-sm font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>₹{remaining.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Method</label>
                                  <Select value={d.method} onValueChange={(val) => updatePerBizPayment(biz, "method", val)}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Cash">Cash</SelectItem>
                                      <SelectItem value="UPI / GPay">UPI / GPay</SelectItem>
                                      <SelectItem value="Card">Card</SelectItem>
                                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Date</label>
                                  <Input type="date" value={d.date || today} onChange={(e) => updatePerBizPayment(biz, "date", e.target.value)} className="h-9" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Amount Paid (₹)</label>
                                  <Input
                                    type="text" inputMode="decimal"
                                    value={d.amount}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/[^0-9.]/g, "");
                                      const num = parseFloat(raw);
                                      const capped = !isNaN(num) && num > total ? String(total) : raw;
                                      updatePerBizPayment(biz, "amount", capped);
                                    }}
                                    placeholder="0"
                                    className={`h-9 ${Number(d.amount) > total ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                  />
                                  {Number(d.amount) > total && (
                                    <p className="text-[10px] text-red-500 mt-0.5">Cannot exceed ₹{total.toLocaleString()}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // Single business — original UI
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-bold">Mark as Paid</label>
                          <p className="text-xs text-muted-foreground">Has the customer already paid for this service?</p>
                        </div>
                        <div className="flex items-center h-9">
                          <input type="checkbox" checked={markAsPaid} onChange={(e) => setMarkAsPaid(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-600" />
                        </div>
                      </div>

                       {markAsPaid && (() => {
                         const invoiceSubtotal = [...form.watch("services"), ...form.watch("ppfs"), ...form.watch("accessories")].reduce(
                           (acc, curr) => acc + ((Number(curr.price) || 0) * (Number(curr.quantity) || 1)),
                           0,
                         ) + Number(form.watch("laborCharge") || 0) - Number(form.watch("discount") || 0);
                         const gstRate = Number(form.watch("gst") || 0);
                         const gstMode = form.watch("gstMode") || "exclusive";
                         const invoiceTotal = calculateGstAmounts(
                           invoiceSubtotal,
                           gstRate,
                           gstMode,
                         ).totalAmount;
                         const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
                         const remaining = Math.max(0, invoiceTotal - totalPaid);

                         return (
                           <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                             <div className="flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-100">
                               <div className="flex items-center gap-2 text-red-700">
                                 <FileText className="h-4 w-4" />
                                 <span className="text-sm font-bold uppercase tracking-wider">Total Invoice Amount:</span>
                                 <span className="text-lg font-black tracking-tight">₹{Math.round(invoiceTotal).toLocaleString()}</span>
                               </div>
                               <div className="flex gap-4">
                                 <div className="text-right">
                                   <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-1">Total Paid</span>
                                   <span className="text-sm font-bold text-slate-700">₹{totalPaid.toLocaleString()}</span>
                                 </div>
                                 <div className="text-right">
                                   <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-1">Remaining</span>
                                   <span className={`text-sm font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                                     ₹{Math.round(remaining).toLocaleString()}
                                   </span>
                                 </div>
                               </div>
                             </div>

                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-900">Payment Details</h4>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddPayment} className="h-8">Add Payment Method</Button>
                          </div>

                          {payments.map((payment, index) => (
                            <div key={index} className="flex flex-row items-end gap-3 bg-slate-50 p-3 rounded-md relative group">
                              <div className="flex-1 min-w-[140px]">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Method</label>
                                <Select value={payment.method} onValueChange={(val) => handlePaymentChange(index, "method", val)}>
                                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="UPI / GPay">UPI / GPay</SelectItem>
                                    <SelectItem value="Card">Card</SelectItem>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1 min-w-[140px]">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Date</label>
                                <Input type="date" value={payment.date} onChange={(e) => handlePaymentChange(index, "date", e.target.value)} className="h-9" />
                              </div>
                              <div className="flex-1 min-w-[120px]">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase tracking-wider">Amount</label>
                                <Input type="text" inputMode="decimal" value={payment.amount === 0 ? "" : payment.amount} onChange={(e) => handlePaymentChange(index, "amount", e.target.value)} placeholder="0" className="h-9" />
                              </div>
                              <div className="flex-none">
                                {payments.length > 1 && (
                                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePayment(index)} className="h-9 w-9 text-slate-300 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                           </div>
                         );
                       })()}
                    </>
                  );
                })()}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowBusinessDialog(false)}>Cancel</Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white" 
                onClick={handleCompleteWithBusiness}
                disabled={createJobMutation.isPending}
              >
                {createJobMutation.isPending ? "Generating..." : "Complete & Generate Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  return isSelfKiosk ? (
    <div className="min-h-screen bg-slate-50 text-slate-900">{pageContent}</div>
  ) : (
    <Layout>{pageContent}</Layout>
  );
}
