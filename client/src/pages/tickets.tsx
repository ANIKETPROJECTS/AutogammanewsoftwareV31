import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ticket, InsertTicket } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Plus, 
  MoreVertical,
  Pencil,
  Trash2,
  Ticket as TicketIcon,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getTicketWorkflowStatus(ticket: Ticket): "IN_PROGRESS" | "RESOLVED" {
  return ticket.status === "RESOLVED" ? "RESOLVED" : "IN_PROGRESS";
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export default function TicketsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [note, setNote] = useState("");

  // Queries
  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: customers = [], isLoading: isLoadingCustomers, error: customersError } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 0,
    refetchOnMount: "always"
  });

  const selectedCustomer = useMemo(() => 
    customers.find(c => c.id === selectedCustomerId),
  [customers, selectedCustomerId]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: InsertTicket) => {
      const res = await apiRequest("POST", "/api/tickets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: "Ticket created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Ticket> }) => {
      const res = await apiRequest("PATCH", `/api/tickets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsFormOpen(false);
      resetForm();
      toast({ title: "Ticket updated successfully" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "IN_PROGRESS" | "RESOLVED" }) => {
      const res = await apiRequest("PATCH", `/api/tickets/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update ticket status",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tickets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Ticket deleted" });
    },
  });

  const resetForm = () => {
    setSelectedCustomerId("");
    setNote("");
    setEditingTicket(null);
  };

  const handleCreateTicket = () => {
    if (!selectedCustomer || !note) return;

    if (editingTicket) {
      updateMutation.mutate({
        id: editingTicket.id!,
        data: { customerId: selectedCustomerId, customerName: selectedCustomer.name, note }
      });
    } else {
      createMutation.mutate({
        customerId: selectedCustomerId,
        customerName: selectedCustomer.name,
        phone: selectedCustomer.phone,
        note
      });
    }
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setSelectedCustomerId(ticket.customerId);
    setNote(ticket.note);
    setIsFormOpen(true);
  };

  const filteredTickets = useMemo(() => {
    return (tickets || []).filter((t) =>
      t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.note.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tickets, searchTerm]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
            <p className="text-sm text-muted-foreground">Manage notes and reminders linked to customers</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="ml-auto">
            <Dialog open={isFormOpen} onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-red-500 hover:bg-red-600 text-white gap-2">
                  <Plus className="h-4 w-4" />
                  Add Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingTicket ? "Edit Ticket" : "Create New Ticket"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2 flex flex-col">
                    <label className="text-sm font-medium">Customer</label>
                    <Popover open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isCustomerSelectOpen}
                          className="justify-between"
                        >
                          {selectedCustomer 
                            ? `${selectedCustomer.name} (${selectedCustomer.phone})`
                            : "Select a customer..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[375px] p-0">
                        <Command>
                          <CommandInput placeholder="Search customer by name or phone..." />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup heading="Latest Customers">
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={`${customer.name} ${customer.phone}`}
                                  onSelect={() => {
                                    setSelectedCustomerId(customer.id);
                                    setIsCustomerSelectOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{customer.name}</span>
                                    <span className="text-xs text-muted-foreground">{customer.phone}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Note</label>
                    <textarea
                      className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Write your note here..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button 
                    className="bg-red-500 hover:bg-red-600 text-white"
                    onClick={handleCreateTicket}
                    disabled={createMutation.isPending || updateMutation.isPending || !selectedCustomerId}
                  >
                    {editingTicket ? "Update Ticket" : "Create Ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <TicketIcon className="h-12 w-12 animate-pulse text-muted-foreground/20" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="p-4 bg-muted rounded-full">
              <TicketIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No tickets found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create your first ticket to keep track of customer notes.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-800">{ticket.customerName}</h3>
                      {ticket.phone && (
                        <p className="text-sm text-muted-foreground">{ticket.phone}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {format(new Date(ticket.createdAt), "MMM dd, yyyy, h:mm a")}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(ticket)} className="gap-2">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(ticket.id!)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-md border border-slate-100 italic text-sm text-slate-600">
                    "{ticket.note}"
                  </div>
                   <div className="flex gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       className={`flex-1 text-xs font-bold ${
                         getTicketWorkflowStatus(ticket) === "IN_PROGRESS"
                           ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                           : "border-slate-200 text-slate-600"
                       }`}
                       disabled={updateStatusMutation.isPending}
                       onClick={() => {
                         if (getTicketWorkflowStatus(ticket) !== "IN_PROGRESS") {
                           updateStatusMutation.mutate({ id: ticket.id!, status: "IN_PROGRESS" });
                         }
                       }}
                     >
                       In-progress
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       className={`flex-1 text-xs font-bold ${
                         getTicketWorkflowStatus(ticket) === "RESOLVED"
                           ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                           : "border-slate-200 text-slate-600"
                       }`}
                       disabled={updateStatusMutation.isPending}
                       onClick={() => {
                         if (getTicketWorkflowStatus(ticket) !== "RESOLVED") {
                           updateStatusMutation.mutate({ id: ticket.id!, status: "RESOLVED" });
                         }
                       }}
                     >
                       Resolved
                     </Button>
                   </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
