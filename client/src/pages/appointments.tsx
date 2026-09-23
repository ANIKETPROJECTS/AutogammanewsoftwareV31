import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Appointment, InsertAppointment, AppointmentStatus } from "@shared/schema";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAppointmentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, MoreHorizontal, Search, Trash2, CheckCircle2, XCircle, Clock, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";

export default function AppointmentsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("SCHEDULED");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"OLDEST" | "NEWEST">("OLDEST");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: [api.appointments.list.path],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAppointment) => {
      const res = await apiRequest(api.appointments.create.method, api.appointments.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.get.path] });
      setIsFormOpen(false);
      setEditingAppointment(null);
      toast({ title: "Appointment booked successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Appointment> }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.get.path] });
      setIsFormOpen(false);
      setEditingAppointment(null);
      toast({ title: "Appointment updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.get.path] });
      toast({ title: "Appointment deleted" });
    },
  });

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a) => {
        const matchesSearch =
          a.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.phone.includes(searchTerm);
        const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
        const matchesPriority = priorityFilter === "ALL" || a.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return sortOrder === "OLDEST" ? dateA - dateB : dateB - dateA;
      });
  }, [appointments, searchTerm, statusFilter, priorityFilter, sortOrder]);

  const form = useForm<InsertAppointment>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      customerName: "",
      phone: "",
      vehicleInfo: "",
      serviceType: "",
      date: format(new Date(), "yyyy-MM-dd"),
      time: "09:00",
      priority: "MEDIUM",
    },
  });

  const onSubmit = (data: InsertAppointment) => {
    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id!, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openReschedule = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    form.reset({
      customerName: appointment.customerName,
      phone: appointment.phone,
      vehicleInfo: appointment.vehicleInfo,
      serviceType: appointment.serviceType,
      date: appointment.date,
      time: appointment.time,
      priority: appointment.priority,
    });
    setIsFormOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">HIGH</Badge>;
      case "MEDIUM":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">MEDIUM</Badge>;
      case "LOW":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">LOW</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: AppointmentStatus, reason?: string) => {
    switch (status) {
      case "DONE":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">DONE</Badge>;
      case "CANCELLED":
        return (
          <div className="flex flex-col">
            <Badge variant="destructive" className="w-fit">CANCELLED</Badge>
            {reason && <span className="text-[10px] text-destructive italic mt-0.5">Reason: {reason}</span>}
          </div>
        );
      default:
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">SCHEDULED</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground text-sm">Manage notes and reminders linked to customers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone number..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status Filter</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority Filter</label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priority</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sort by Date</label>
            <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Oldest First" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OLDEST">Oldest First</SelectItem>
                <SelectItem value="NEWEST">Newest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) {
              setEditingAppointment(null);
              form.reset({
                customerName: "",
                phone: "",
                vehicleInfo: "",
                serviceType: "",
                date: format(new Date(), "yyyy-MM-dd"),
                time: "09:00",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-red-500 hover:bg-red-600 text-white font-semibold">
                Book Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingAppointment ? "Reschedule Appointment" : "Book Appointment"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
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
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="9876543210" 
                              {...field} 
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicleInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Info *</FormLabel>
                          <FormControl>
                            <Input placeholder="Toyota Fortuner" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Type *</FormLabel>
                          <FormControl>
                            <Input placeholder="General Service" {...field} />
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
                          <FormLabel>Priority *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
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
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => {
                        const [hours, minutes] = field.value.split(":");
                        const h = parseInt(hours);
                        const period = h >= 12 ? "PM" : "AM";
                        const displayHour = h % 12 || 12;
                        const hourStr = displayHour.toString().padStart(2, "0");

                        const updateTime = (newHour: string, newMinute: string, newPeriod: string) => {
                          let hh = parseInt(newHour);
                          if (newPeriod === "PM" && hh < 12) hh += 12;
                          if (newPeriod === "AM" && hh === 12) hh = 0;
                          const formattedTime = `${hh.toString().padStart(2, "0")}:${newMinute}`;
                          field.onChange(formattedTime);
                        };

                        return (
                          <FormItem>
                            <FormLabel>Time *</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2 border rounded-md px-3 py-1 bg-background h-10">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Select 
                                  value={hourStr} 
                                  onValueChange={(v) => updateTime(v, minutes, period)}
                                >
                                  <SelectTrigger className="border-none shadow-none focus:ring-0 w-[45px] p-0 h-auto">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">:</span>
                                <Select 
                                  value={minutes} 
                                  onValueChange={(v) => updateTime(hourStr, v, period)}
                                >
                                  <SelectTrigger className="border-none shadow-none focus:ring-0 w-[45px] p-0 h-auto">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[200px] overflow-y-auto">
                                    {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0")).map((m) => (
                                      <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select 
                                  value={period} 
                                  onValueChange={(v) => updateTime(hourStr, minutes, v)}
                                >
                                  <SelectTrigger className="border-none shadow-none focus:ring-0 w-[55px] p-0 h-auto font-medium">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingAppointment ? "Update Appointment" : "Book Appointment"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setIsFormOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-400">
              <TableRow>
                <TableHead className="text-white font-semibold">Customer</TableHead>
                <TableHead className="text-white font-semibold">Phone</TableHead>
                <TableHead className="text-white font-semibold">Vehicle</TableHead>
                <TableHead className="text-white font-semibold">Service</TableHead>
                <TableHead className="text-white font-semibold">Date</TableHead>
                <TableHead className="text-white font-semibold">Time</TableHead>
                <TableHead className="text-white font-semibold">Priority</TableHead>
                <TableHead className="text-white font-semibold">Status</TableHead>
                <TableHead className="text-white font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading appointments...
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No appointments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((a) => (
                  <TableRow key={a.id} className="group hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-slate-900">{a.customerName}</TableCell>
                    <TableCell className="text-slate-600">{a.phone}</TableCell>
                    <TableCell className="text-slate-600">{a.vehicleInfo}</TableCell>
                    <TableCell className="text-slate-600">{a.serviceType}</TableCell>
                    <TableCell className="text-slate-600">
                      {format(parseISO(a.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">{a.time}</TableCell>
                    <TableCell>{getPriorityBadge(a.priority)}</TableCell>
                    <TableCell>{getStatusBadge(a.status, a.cancelReason)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.status === "SCHEDULED" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 border-slate-300">
                                Options
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => openReschedule(a)}
                              >
                                <Clock className="h-4 w-4" /> Reschedule
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => {
                                  const reason = prompt("Enter cancellation reason:");
                                  if (reason !== null) {
                                    updateMutation.mutate({ 
                                      id: a.id!, 
                                      data: { status: "CANCELLED", cancelReason: reason } 
                                    });
                                  }
                                }}
                              >
                                <XCircle className="h-4 w-4" /> Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="flex items-center gap-2 text-green-600 focus:text-green-600 cursor-pointer"
                                onClick={() => updateMutation.mutate({ id: a.id!, data: { status: "DONE" } })}
                              >
                                <CheckCircle2 className="h-4 w-4" /> Mark Done
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setAppointmentToDelete(a)}
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
        </div>
      </div>

      <ConfirmActionDialog
        open={!!appointmentToDelete}
        onOpenChange={(open) => !open && setAppointmentToDelete(null)}
        title="Delete appointment?"
        description="Are you sure you want to delete this appointment?"
        onConfirm={() => {
          if (appointmentToDelete?.id) {
            deleteMutation.mutate(appointmentToDelete.id);
            setAppointmentToDelete(null);
          }
        }}
        isPending={deleteMutation.isPending}
      />
    </Layout>
  );
}
