import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Inquiry, InsertInquiry, ServiceMaster, AccessoryMaster, VehicleType, AccessoryCategory, PPFMaster } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInquirySchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  Eye, 
  Download, 
  Send, 
  X,
  PlusCircle,
  IndianRupee
} from "lucide-react";
import { format } from "date-fns";

function getInquiryWorkflowStatus(inquiry: Inquiry): "FOLLOW_UP" | "CONVERTED" {
  return inquiry.status === "CONVERTED" || inquiry.isConverted ? "CONVERTED" : "FOLLOW_UP";
}


export default function InquiryPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingInquiry, setViewingInquiry] = useState<Inquiry | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{
    kind: "success" | "warning" | "saved";
    title: string;
    description: string;
  } | null>(null);

  const handleDownloadPDF = (inquiry: Inquiry) => {
    const tableRows = [
      ...(inquiry.services || []).map(s => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;">${s.serviceName}${s.vehicleType ? ` (${s.vehicleType})` : ""}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${s.warrantyName || "-"}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">INR ${(s.price || 0).toLocaleString()}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">INR ${(s.customerPrice ?? s.price ?? 0).toLocaleString()}</td>
        </tr>`),
      ...(inquiry.accessories || []).map(a => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.accessoryName} (${a.category})</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">-</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">INR ${(a.price || 0).toLocaleString()}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">INR ${(a.customerPrice ?? a.price ?? 0).toLocaleString()}</td>
        </tr>`)
    ].join("");

    const html = `<html><head><title>Quotation_${inquiry.inquiryId || "unknown"}</title>
      <style>body{font-family:helvetica,sans-serif;padding:24px;color:#000;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      th{background:#dc2626;color:#fff;padding:8px;text-align:left;border:1px solid #dc2626;}
      @media print{body{padding:0;}}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div style="font-size:20px;font-weight:bold;color:#dc2626;">AUTO GAMMA</div>
          <div style="font-size:10px;color:#64748b;">Car Care Studio</div></div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:bold;">QUOTATION</div>
          <div style="font-size:10px;">ID: ${inquiry.inquiryId || "N/A"}</div>
          <div style="font-size:10px;">Date: ${format(new Date(inquiry.createdAt || new Date()), "MMM dd, yyyy")}</div>
        </div>
      </div>
      <hr style="margin:16px 0;border-color:#e2e8f0;"/>
      <div style="font-size:10px;"><strong>BILL TO:</strong><br/>
        ${inquiry.customerName || "N/A"}<br/>
        ${inquiry.phone || "N/A"}${inquiry.email ? `<br/>${inquiry.email}` : ""}
      </div>
      <table><thead><tr>
        <th>Service/Item</th><th>Warranty</th><th style="text-align:right;">Base Price</th><th style="text-align:right;">Quoted Price</th>
      </tr></thead><tbody>${tableRows}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;">
        <div><strong>Total Quoted Price: INR ${(inquiry.customerPrice || 0).toLocaleString()}</strong></div>
      </div>
      ${inquiry.notes ? `<div style="margin-top:16px;"><strong>Special Notes:</strong><br/>${inquiry.notes}</div>` : ""}
      <div style="margin-top:32px;text-align:center;font-size:9px;color:#999;">Thank you for choosing Auto Gamma!</div>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
  };

  const handleSendWhatsApp = (inquiry: Inquiry) => {
    const servicesList = [
      ...(inquiry.services || []).map(s => `- ${s.serviceName}${s.warrantyName ? ` (${s.warrantyName})` : ""}`),
      ...(inquiry.accessories || []).map(a => `- ${a.accessoryName}`)
    ].join("\n");

    const message = `Hi ${inquiry.customerName},

Thank you for your interest in Auto Gamma Car Care Studio!

*QUOTATION DETAILS:*
ID: ${inquiry.inquiryId || "N/A"}
Date: ${format(new Date(inquiry.createdAt || new Date()), "MMM dd, yyyy")}

*SERVICES REQUESTED:*
${servicesList || "General Inquiry"}

*SPECIAL NOTES:*
${inquiry.notes || "No special notes"}

Please let me know if if you have any questions!

Best regards,
Auto Gamma Car Care Studio`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${inquiry.phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  // Queries
  const { data: inquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/inquiries"],
  });
  const { data: services = [] } = useQuery<ServiceMaster[]>({
    queryKey: [api.masters.services.list.path],
  });
  const { data: ppfMasters = [] } = useQuery<PPFMaster[]>({
    queryKey: [api.masters.ppf.list.path],
  });
  const { data: accessories = [] } = useQuery<AccessoryMaster[]>({
    queryKey: [api.masters.accessories.list.path],
  });
  const { data: vehicleTypes = [] } = useQuery<VehicleType[]>({
    queryKey: [api.masters.vehicleTypes.list.path],
  });
  const { data: accessoryCategories = [] } = useQuery<AccessoryCategory[]>({
    queryKey: [api.masters.accessories.categories.list.path],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: InsertInquiry) => {
      const res = await apiRequest("POST", "/api/inquiries", data);
      return res.json();
    },
    onSuccess: (savedInquiry: Inquiry & {
      whatsapp?: {
        status: "sent" | "skipped" | "failed";
        messageId?: string;
        reason?: string;
      };
    }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsFormOpen(false);
      form.reset();
      if (savedInquiry.whatsapp?.status === "sent") {
        setSaveFeedback({
          kind: "success",
          title: "Inquiry saved and WhatsApp sent",
          description: "The approved inquiry template was sent to the customer.",
        });
        toast({
          title: "Inquiry saved and WhatsApp sent",
          description: "The approved inquiry template was sent to the customer.",
        });
      } else if (savedInquiry.whatsapp) {
        setSaveFeedback({
          kind: "warning",
          title: "Inquiry saved, WhatsApp not sent",
          description: savedInquiry.whatsapp.reason || "Check the WhatsApp configuration and try again.",
        });
        toast({
          title: "Inquiry saved, WhatsApp not sent",
          description: savedInquiry.whatsapp.reason || "Check the WhatsApp configuration and try again.",
          variant: "destructive",
        });
      } else {
        setSaveFeedback({
          kind: "saved",
          title: "Inquiry saved successfully",
          description: "The inquiry was saved without a WhatsApp delivery result.",
        });
        toast({ title: "Inquiry saved successfully" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/inquiries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Inquiry deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "FOLLOW_UP" | "CONVERTED" }) => {
      const res = await apiRequest("PATCH", `/api/inquiries/${id}`, {
        status,
        isConverted: status === "CONVERTED",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inquiries"] });
      toast({ title: "Inquiry status updated" });
    },
  });

  const form = useForm<InsertInquiry>({
    resolver: zodResolver(insertInquirySchema),
    defaultValues: {
      customerName: "",
      phone: "",
      email: "",
      priority: "MEDIUM",
      services: [],
      accessories: [],
      notes: "",
      ourPrice: 0,
      customerPrice: 0,
    },
  });

  const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const { fields: accessoryFields, append: appendAccessory, remove: removeAccessory } = useFieldArray({
    control: form.control,
    name: "accessories",
  });

  // Intermediate state for selection
  const [selectedService, setSelectedService] = useState("");
  const [selectedServiceVehicleType, setSelectedServiceVehicleType] = useState("");

  const [selectedPPF, setSelectedPPF] = useState("");
  const [selectedPPFVehicleType, setSelectedPPFVehicleType] = useState("");
  const [selectedWarranty, setSelectedWarranty] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAccessory, setSelectedAccessory] = useState("");

  const handleAddService = () => {
    const service = services.find(s => s.name === selectedService);
    if (!service || !selectedServiceVehicleType) return;

    let price = 0;
    const vPricing = service.pricingByVehicleType.find(v => v.vehicleType === selectedServiceVehicleType);
    if (vPricing) {
      price = vPricing.price || 0;
    }

    appendService({
      serviceId: service.id || "",
      serviceName: service.name,
      vehicleType: selectedServiceVehicleType,
      warrantyName: undefined,
      price: price,
      customerPrice: price
    });

    const currentOurPrice = form.getValues("ourPrice") || 0;
    form.setValue("ourPrice", currentOurPrice + price);
    const currentCustomerPrice = form.getValues("customerPrice") || 0;
    form.setValue("customerPrice", currentCustomerPrice + price);
    setSelectedService("");
    setSelectedServiceVehicleType("");
  };

  const handleAddPPF = () => {
    const ppf = ppfMasters.find(p => p.name === selectedPPF);
    if (!ppf || !selectedPPFVehicleType || !selectedWarranty) return;

    let price = 0;
    const vPricing = ppf.pricingByVehicleType.find(v => v.vehicleType === selectedPPFVehicleType);
    if (vPricing) {
      const opt = vPricing.options.find((o: any) => o.warrantyName === selectedWarranty);
      price = opt?.price || 0;
    }

    appendService({
      serviceId: ppf.id || "",
      serviceName: ppf.name,
      vehicleType: selectedPPFVehicleType,
      warrantyName: selectedWarranty,
      price: price,
      customerPrice: price
    });

    const currentOurPrice = form.getValues("ourPrice") || 0;
    form.setValue("ourPrice", currentOurPrice + price);
    const currentCustomerPrice = form.getValues("customerPrice") || 0;
    form.setValue("customerPrice", currentCustomerPrice + price);
    setSelectedPPF("");
    setSelectedPPFVehicleType("");
    setSelectedWarranty("");
  };

  const handleAddAccessory = () => {
    const accessory = accessories.find(a => a.name === selectedAccessory);
    if (!accessory) return;

    appendAccessory({
      accessoryId: accessory.id || "",
      accessoryName: accessory.name,
      category: accessory.category,
      price: accessory.price,
      customerPrice: accessory.price
    });

    const currentOurPrice = form.getValues("ourPrice") || 0;
    form.setValue("ourPrice", currentOurPrice + accessory.price);
    const currentCustomerPrice = form.getValues("customerPrice") || 0;
    form.setValue("customerPrice", currentCustomerPrice + accessory.price);
  };

  const onSubmit = (data: InsertInquiry) => {
    setSaveFeedback(null);
    createMutation.mutate(data);
  };

  const handleSaveClick = () => {
    form.handleSubmit(onSubmit)();
  };

  const filteredInquiries = useMemo(() => {
    return (inquiries || []).filter((i) => {
      const matchesSearch = i.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           i.phone?.includes(searchTerm);
      const matchesStatus = statusFilter === "ALL" || 
                           (statusFilter === "CONVERTED" && getInquiryWorkflowStatus(i) === "CONVERTED") ||
                           (statusFilter === "FOLLOW_UP" && getInquiryWorkflowStatus(i) === "FOLLOW_UP");
      return matchesSearch && matchesStatus;
    });
  }, [inquiries, searchTerm, statusFilter]);


  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inquiries</h1>
          <p className="text-sm text-muted-foreground">Manage service and product inquiries from potential customers</p>
        </div>

        {saveFeedback && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 ${
              saveFeedback.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : saveFeedback.kind === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          >
            <p className="font-bold">{saveFeedback.title}</p>
            <p className="mt-1 text-sm opacity-80">{saveFeedback.description}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
              <SelectItem value="CONVERTED">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-500 hover:bg-red-600 text-white font-semibold">
              Add Inquiry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
            <div className="p-6 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Inquiry</DialogTitle>
                <p className="text-sm text-muted-foreground">Create a new inquiry for a customer</p>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground font-bold uppercase">Customer Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Customer name" {...field} className="h-10" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground font-bold uppercase">Phone Number *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Phone number" 
                                {...field} 
                                className="h-10"
                                maxLength={10}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Email address (optional)</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="Email address (optional)" {...field} className="h-10" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground font-bold uppercase">Priority *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || "MEDIUM"}>
                              <FormControl>
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="HIGH">High</SelectItem>
                                <SelectItem value="MEDIUM">Medium</SelectItem>
                                <SelectItem value="LOW">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-muted-foreground uppercase">Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Add any additional notes or special requests..." 
                            {...field} 
                            className="min-h-[100px] resize-none"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      type="button"
                      onClick={handleSaveClick}
                      className="bg-red-500 hover:bg-red-600 text-white px-8"
                      disabled={createMutation.isPending}
                    >
                      {createMutation.isPending ? "Saving..." : "Save Inquiry"}
                    </Button>
                    <Button type="button" variant="outline" className="px-8" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Existing List UI */}
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => {
            const diff = inquiry.customerPrice - inquiry.ourPrice;
            const diffPercent = inquiry.ourPrice > 0 ? (diff / inquiry.ourPrice) * 100 : 0;
            return (
              <Card key={inquiry.id} className="hover-elevate transition-all duration-200 border-slate-200">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column: Customer Details */}
                    <div className="flex-1 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Customer Name</p>
                        <h3 className="text-lg font-bold text-slate-900">{inquiry.customerName}</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</p>
                          <p className="text-sm font-medium flex items-center gap-2 text-blue-600">
                            <Phone className="h-4 w-4" /> {inquiry.phone}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Email Address</p>
                          <p className="text-sm font-medium flex items-center gap-2 text-blue-600">
                            <Mail className="h-4 w-4" /> {inquiry.email || "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Priority Status</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-600">Priority :-</span>
                            {inquiry.priority && (
                              <Badge className={
                                inquiry.priority === "HIGH" ? "bg-red-100 text-red-700 hover:bg-red-100 border-red-200" :
                                inquiry.priority === "MEDIUM" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200" :
                                "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              }>
                                {inquiry.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Special Notes</p>
                        <div className="bg-orange-50/50 p-2 rounded-md border border-orange-100 text-sm italic text-slate-600 min-h-[40px]">
                          "{inquiry.notes || "None"}"
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="lg:w-1/3 space-y-6 flex flex-col">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-400">
                          <span>Inquiry ID: {inquiry.inquiryId}</span>
                          <span>Date: {format(new Date(inquiry.createdAt || new Date()), "MMMM dd, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          {(() => {
                            const workflowStatus = getInquiryWorkflowStatus(inquiry);
                            return (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 h-8 text-[10px] font-bold uppercase ${
                                    workflowStatus === "FOLLOW_UP"
                                      ? "bg-amber-500 hover:bg-amber-600 text-white border-none"
                                      : "border-slate-200 text-slate-600"
                                  }`}
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() => {
                                    if (workflowStatus !== "FOLLOW_UP") {
                                      updateStatusMutation.mutate({ id: inquiry.id!, status: "FOLLOW_UP" });
                                    }
                                  }}
                                >
                                  Follow-up
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`flex-1 h-8 text-[10px] font-bold uppercase ${
                                    workflowStatus === "CONVERTED"
                                      ? "bg-green-600 hover:bg-green-700 text-white border-none"
                                      : "border-slate-200 text-slate-600"
                                  }`}
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() => {
                                    if (workflowStatus !== "CONVERTED") {
                                      updateStatusMutation.mutate({ id: inquiry.id!, status: "CONVERTED" });
                                    }
                                  }}
                                >
                                  Converted
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 h-8 bg-red-600 hover:bg-red-700 text-white border-none text-[10px] font-bold uppercase"
                                  onClick={() => deleteMutation.mutate(inquiry.id!)}
                                >
                                  Delete
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* View Inquiry Dialog */}
        <Dialog open={!!viewingInquiry} onOpenChange={(open) => !open && setViewingInquiry(null)}>
          <DialogContent className="max-w-3xl p-0">
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Inquiry Details</DialogTitle>
                </DialogHeader>
              </div>

              {viewingInquiry && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Name</p>
                      <p className="text-sm font-bold">{viewingInquiry.customerName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Phone</p>
                      <p className="text-sm font-bold">{viewingInquiry.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                      <p className="text-sm font-bold">{viewingInquiry.email || "N/A"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Notes</p>
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-100 text-sm">
                      {viewingInquiry.notes || "No notes"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
