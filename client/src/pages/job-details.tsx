import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useQuery } from "@tanstack/react-query";
import { JobCard } from "@shared/schema";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { 
  ChevronLeft, 
  User, 
  Car, 
  Settings, 
  Clock, 
  IndianRupee,
  Edit,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Trash2,
  Package,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateGstAmounts } from "@shared/gst";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function JobDetailsPage() {
  const [, params] = useRoute("/job-cards/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const id = params?.id;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: jobCards = [], isLoading } = useQuery<JobCard[]>({
    queryKey: ["/api/job-cards"],
  });

  const job = jobCards.find(j => j.id === id);

  const updateStatus = async (status: string) => {
    try {
      await apiRequest("PATCH", `/api/job-cards/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/ppf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Status Updated",
        description: `Job card has been marked as ${status}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteJob = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      await apiRequest("DELETE", `/api/job-cards/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/masters/ppf"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Job Card Deleted",
        description: "The job card has been successfully removed.",
      });
      setLocation("/job-cards");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete job card. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Job Card Not Found</h2>
          <Button onClick={() => setLocation("/job-cards")} className="mt-4">
            Back to Job Cards
          </Button>
        </div>
      </Layout>
    );
  }

  const handleGenerateInvoice = async () => {
    try {
      if (!job) return;

      const items = [
        ...job.services.map(s => ({ ...s, type: "Service" })),
        ...job.ppfs.map(p => ({ ...p, type: "PPF" })),
        ...job.accessories.map(a => ({ ...a, type: "Accessory" }))
      ];

      const businesses = Array.from(new Set(items.map(item => item.business || "Auto Gamma")));
      
      for (const business of businesses) {
        const businessItems = items.filter(item => (item.business || "Auto Gamma") === business);
        const subtotal = businessItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
        
        // Use business-specific discount
        const businessDiscount = business === "Auto Gamma" ? 
          (job.autoGammaDiscount || 0) : 
          (job.agnxDiscount || 0);

        const businessLabor = job.laborBusiness === business ? Number(job.laborCharge || 0) : 0;
        
        // Only Auto Gamma is GST-registered; AGNX invoices have no GST
        const gstPercentage = business === "Auto Gamma" ? Number(job.gst || 0) : 0;
        const totalBeforeGst = subtotal + businessLabor - businessDiscount;
        const gstMode = business === "Auto Gamma" ? (job.gstMode || "exclusive") : "exclusive";
        const { gstAmount, totalAmount: grandTotal } = calculateGstAmounts(
          totalBeforeGst,
          gstPercentage,
          gstMode,
        );

        // For split invoices (multiple businesses), each invoice should only show
        // a payment equal to its own Grand Total, not the combined job payment.
        let invoicePayments: { amount: number; method: string; date: string }[] = [];
        if (job.isPaid && job.payments && job.payments.length > 0) {
          if (businesses.length === 1) {
            // Single business — copy all payments as-is
            invoicePayments = job.payments;
          } else {
            // Split between multiple businesses — assign each invoice a payment
            // equal to its own Grand Total (includes GST for Auto Gamma, none for AGNX)
            const firstPayment = job.payments[0];
            invoicePayments = [{
              amount: grandTotal,
              method: firstPayment.method,
              date: firstPayment.date
            }];
          }
        }

        const invoiceData = {
          jobCardId: job.id,
          business,
          customerName: job.customerName,
          phoneNumber: job.phoneNumber,
          emailAddress: job.emailAddress,
          vehicleMake: job.make,
          vehicleModel: job.model,
          vehicleYear: job.year,
          licensePlate: job.licensePlate,
          vehicleType: job.vehicleType,
          items: businessItems.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            type: item.type,
            category: (item as any).category,
            warranty: (item as any).warranty,
            technician: item.technician
          })),
          subtotal: subtotal + businessLabor,
          discount: businessDiscount,
          laborCharge: businessLabor,
          gstPercentage,
          gstMode,
          gstAmount,
          totalAmount: grandTotal,
          date: job.date,
          isPaid: job.isPaid,
          payments: invoicePayments
        };

        await apiRequest("POST", "/api/invoices", invoiceData);
      }

      toast({
        title: "Success",
        description: "Invoices generated successfully",
      });
      setLocation("/invoice");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate invoices",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">{status}</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{status}</Badge>;
      case "Completed":
        return <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">{status}</Badge>;
      case "Cancelled":
        return <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLocation("/job-cards")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-red-600 tracking-tight">{job.jobNo}</h1>
                {getStatusBadge(job.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Created on {format(new Date(job.date), "MMMM dd, yyyy")}
              </p>
            </div>
          </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="destructive" 
                className="font-bold flex items-center gap-2"
                onClick={() => {
                  const createdFromPos =
                    job.referralSource === "POS" ||
                    job.serviceNotes === "Created from POS";
                  setLocation(
                    createdFromPos
                      ? `/pos?edit=${id}`
                      : `/add-job?id=${id}`,
                  );
                }}
              >
                <Edit className="h-4 w-4" /> Edit Job Card
              </Button>
              <Button 
                variant="outline" 
                className="font-bold text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Customer Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-12">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer Name</p>
                  <p className="text-base font-semibold text-slate-800">{job.customerName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                  <p className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    {job.phoneNumber}
                  </p>
                </div>
                {job.emailAddress && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                    <p className="text-base font-semibold text-slate-800 break-all">{job.emailAddress}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Vehicle Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Make / Model</p>
                    <p className="text-base font-semibold text-slate-800 capitalize">{job.make} {job.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vehicle Type</p>
                    <p className="text-base font-semibold text-slate-800">{(job as any).vehicleType || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Year</p>
                    <p className="text-base font-semibold text-slate-800">{job.year || "NA"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">License Plate</p>
                    <p className="text-base font-semibold text-slate-800 uppercase">{job.licensePlate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Service Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="w-[10%] text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-6">Type</TableHead>
                      <TableHead className="w-[50%] text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</TableHead>
                      <TableHead className="w-[15%] text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantity</TableHead>
                      <TableHead className="w-[25%] text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest pr-6">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.services.map((service, idx) => (
                      <TableRow key={`service-${idx}`}>
                        <TableCell className="pl-6">
                          <Badge variant="outline" className="text-[10px] uppercase bg-blue-50 text-blue-700 border-blue-200">Service</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-800">
                          {service.name?.split(" - Tech:")[0] || (service as any).serviceName || "Unnamed Service"}
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-600">1</TableCell>
                        <TableCell className="text-right pr-6 text-sm font-bold text-slate-900">₹{(service.price || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {job.ppfs.map((ppf, idx) => (
                      <TableRow key={`ppf-${idx}`}>
                        <TableCell className="pl-6">
                          <Badge variant="outline" className="text-[10px] uppercase bg-purple-50 text-purple-700 border-purple-200">PPF</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-800">
                          <div className="flex flex-col">
                            <span>{ppf.name?.split(" - Tech:")[0] || (ppf as any).ppfName || "Unnamed PPF"}</span>
                            {ppf.rollUsed && (
                              <span className="text-[10px] text-slate-500 font-normal mt-0.5">Usage: {ppf.rollUsed} SQFT</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-600">1</TableCell>
                        <TableCell className="text-right pr-6 text-sm font-bold text-slate-900">₹{(ppf.price || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {job.accessories.map((accessory, idx) => (
                      <TableRow key={`acc-${idx}`}>
                        <TableCell className="pl-6">
                          <Badge variant="outline" className="text-[10px] uppercase bg-orange-50 text-orange-700 border-orange-200">Accessory</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-slate-800">{(accessory as any).name || (accessory as any).accessoryName || "Unnamed Accessory"}</TableCell>
                        <TableCell className="text-center text-sm text-slate-600">{accessory.quantity || 1}</TableCell>
                        <TableCell className="text-right pr-6 text-sm font-bold text-slate-900">₹{((accessory.price || 0) * (accessory.quantity || 1)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {job.serviceNotes && (
                  <div className="p-6 border-t bg-slate-50/30">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Service Notes</p>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{job.serviceNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Pricing</CardTitle>
                </div>
                <Button 
                  onClick={handleGenerateInvoice}
                  variant="outline"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700 hover:text-white border-none font-bold text-xs flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" /> Generate Invoice
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {(() => {
                    const itemsTotal = [
                      ...(job.services || []),
                      ...(job.ppfs || []),
                      ...(job.accessories || [])
                    ].reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 1), 0);
                    const subtotal = itemsTotal + (job.laborCharge || 0) - (job.discount || 0);
                    const gstRate = job.gst || 0;
                    const gstMode = job.gstMode || "exclusive";
                    const { gstAmount } = calculateGstAmounts(subtotal, gstRate, gstMode);
                    const gstModeLabel = gstMode === "inclusive" ? "Including GST" : "Excluding GST";

                    return (
                      <>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                          <span>Labor Charge</span>
                          <span className="text-base font-bold text-slate-900">₹{(job.laborCharge || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                          <span>Discount</span>
                          <span className="text-base font-bold text-green-600">-₹{(job.discount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                          <span>GST ({gstRate}%) · {gstModeLabel}</span>
                          <span className="text-base font-bold text-slate-900">₹{Math.round(gstAmount).toLocaleString()}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500 pt-2 border-t border-slate-100">
                         <span>
                           Estimated Cost{" "}
                           <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                             ({job.gstMode === "inclusive" ? "GST included" : "before GST"})
                           </span>
                         </span>
                    <span className="text-lg font-black text-slate-900">
                      {(() => {
                        const itemsTotal = [
                          ...(job.services || []),
                          ...(job.ppfs || []),
                          ...(job.accessories || [])
                        ].reduce((acc, curr) => acc + (curr.price || 0) * (curr.quantity || 1), 0);
                        const subtotal = itemsTotal + (job.laborCharge || 0) - (job.discount || 0);
                        return `₹${subtotal.toLocaleString()}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-slate-500 pt-2 border-t border-slate-100">
                    <span>Assigned Technician</span>
                    <span className="text-base font-bold text-red-600">
                      {(() => {
                        if (job.technician) return job.technician;
                        if (job.services?.[0]?.technician) return job.services[0].technician;
                        
                        // Fallback: Parse from service name "Service Name - Tech: Technician Name"
                        const techMatch = (job.services?.[0]?.name || "").match(/- Tech:\s*(.+)$/i);
                        if (techMatch) return techMatch[1].trim();
                        
                        return "Unassigned";
                      })()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Additional Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referral Source</p>
                  <p className="text-base font-semibold text-slate-800">{job.referralSource}</p>
                </div>
                {job.referralSource === "Friend/Family" && (
                  <>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referrer Name</p>
                      <p className="text-base font-semibold text-slate-800">{job.referrerName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referrer Phone</p>
                      <p className="text-base font-semibold text-slate-800">{job.referrerPhone || "N/A"}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-base font-bold">Timeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  <div className="relative pl-7">
                    <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-600 shadow-sm z-10" />
                    <p className="text-xs font-bold text-slate-800">Created</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(job.date), "MMM dd, yyyy")}</p>
                  </div>
                  <div className="relative pl-7">
                    <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500 shadow-sm z-10" />
                    <p className="text-xs font-bold text-slate-800">Last Updated</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(job.date), "MMM dd, yyyy")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
                <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start font-semibold text-slate-700 h-10 border-slate-200"
                  onClick={() => updateStatus("In Progress")}
                  disabled={job.status === "In Progress"}
                >
                  <PlayCircle className="h-4 w-4 mr-2 text-blue-600" /> Mark as In Progress
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start font-semibold text-green-700 hover:text-green-800 hover:bg-green-50 h-10 border-slate-200"
                  onClick={() => updateStatus("Completed")}
                  disabled={job.status === "Completed"}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Completed
                </Button>
                <div className="pt-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 h-10"
                    onClick={() => updateStatus("Cancelled")}
                    disabled={job.status === "Cancelled"}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Cancel Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this job card?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The job card and its related invoice records will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteJob}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? "Deleting..." : "Delete job card"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
