import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Wrench, Shield, Package, Car, X, Edit2, LayoutGrid, ChevronDown, ChevronUp, Archive, ArrowLeft, History, ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw, Layers, Search, Check, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { HsnCombobox } from "@/components/ui/hsn-combobox";
import { HSN_CODES } from "@/lib/hsn-codes";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ServiceMaster, VehicleType, PPFMaster, AccessoryMaster, AccessoryCategory, JobCard, HsnCodeMaster } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

import { Link, useLocation } from "wouter";

export default function MastersPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split("?")[1]);
  const defaultTab = searchParams.get("tab") || "service";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showUsedRolls, setShowUsedRolls] = useState(false);
  const [showRollHistory, setShowRollHistory] = useState(false);

  useEffect(() => {
    if (defaultTab !== activeTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const { toast } = useToast();
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceMaster | null>(null);
  const [isAddPPFOpen, setIsAddPPFOpen] = useState(false);
  const [editingPPF, setEditingPPF] = useState<PPFMaster | null>(null);
  const [isAddAccessoryOpen, setIsAddAccessoryOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<AccessoryMaster | null>(null);
  const [isManageVehicleTypesOpen, setIsManageVehicleTypesOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [newVehicleTypeName, setNewVehicleTypeName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [accessorySearchQuery, setAccessorySearchQuery] = useState("");
  const [expandedRolls, setExpandedRolls] = useState<Set<string>>(new Set());
  const [managingRollsPPF, setManagingRollsPPF] = useState<PPFMaster | null>(null);
  const [usedRollSearch, setUsedRollSearch] = useState("");
  const [usedRollSortKey, setUsedRollSortKey] = useState<"name" | "ppf" | "stock">("stock");
  const [usedRollSortDir, setUsedRollSortDir] = useState<"asc" | "desc">("asc");
  const [usedRollFilterPPF, setUsedRollFilterPPF] = useState("all");

  // HSN Code state
  const [isAddHsnCodeOpen, setIsAddHsnCodeOpen] = useState(false);
  const [editingHsnCode, setEditingHsnCode] = useState<HsnCodeMaster | null>(null);
  const [hsnSearchQuery, setHsnSearchQuery] = useState("");
  const [newHsnCode, setNewHsnCode] = useState({ code: "", description: "" });

  const goToUsedRolls = () => { setShowUsedRolls(true); setShowRollHistory(false); };
  const goToRollHistory = () => { setShowRollHistory(true); setShowUsedRolls(false); };
  const goBackToPPF = () => { setShowUsedRolls(false); setShowRollHistory(false); };

  const toggleRollExpand = (ppfId: string) => {
    setExpandedRolls(prev => {
      const next = new Set(prev);
      if (next.has(ppfId)) next.delete(ppfId);
      else next.add(ppfId);
      return next;
    });
  };

  const { data: services = [] } = useQuery<ServiceMaster[]>({
    queryKey: [api.masters.services.list.path],
  });

  const { data: ppfs = [] } = useQuery<PPFMaster[]>({
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

  const { data: hsnCodes = [] } = useQuery<HsnCodeMaster[]>({
    queryKey: [api.masters.hsnCodes.list.path],
  });

  const categoryNames = accessoryCategories.map(c => c.name);
  const filteredAccessories = accessories.filter(a => categoryNames.includes(a.category) && 
    a.name.toLowerCase().includes(accessorySearchQuery.toLowerCase()));

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.services.list.path] });
      toast({ title: "Success", description: "Service deleted successfully" });
    },
  });

  const deletePPFMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/ppf/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.ppf.list.path] });
      toast({ title: "Success", description: "PPF deleted successfully" });
    },
  });

  const deleteAccessoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/accessories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      toast({ title: "Success", description: "Accessory deleted successfully" });
    },
  });

  const createVehicleTypeMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", api.masters.vehicleTypes.create.path, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.vehicleTypes.list.path] });
      setNewVehicleTypeName("");
      toast({ title: "Success", description: "Vehicle type added successfully" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", api.masters.accessories.categories.create.path, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      setNewCategoryName("");
      toast({ title: "Success", description: "Category added successfully" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/accessory-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
  });

  const createHsnCodeMutation = useMutation({
    mutationFn: (data: { code: string; description: string }) =>
      apiRequest("POST", api.masters.hsnCodes.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.hsnCodes.list.path] });
      toast({ title: "Success", description: "HSN Code added successfully" });
      setNewHsnCode({ code: "", description: "" });
      setIsAddHsnCodeOpen(false);
    },
  });

  const updateHsnCodeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { code: string; description: string } }) =>
      apiRequest("PATCH", `/api/masters/hsn-codes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.hsnCodes.list.path] });
      toast({ title: "Success", description: "HSN Code updated successfully" });
      setEditingHsnCode(null);
    },
  });

  const deleteHsnCodeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/hsn-codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.hsnCodes.list.path] });
      toast({ title: "Success", description: "HSN Code deleted successfully" });
    },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Masters
            </h1>
            <p className="text-muted-foreground">
              Manage your service, PPF, and accessories master data.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setShowUsedRolls(false); setShowRollHistory(false); }} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="service" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Service Master
            </TabsTrigger>
            <TabsTrigger value="ppf" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              PPF Master
            </TabsTrigger>
            <TabsTrigger value="accessories" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Accessories Master
            </TabsTrigger>
            <TabsTrigger value="hsncodes" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              HSN Codes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="service" className="space-y-6">
            <div className="flex justify-end gap-3">
              <Dialog open={isManageVehicleTypesOpen} onOpenChange={setIsManageVehicleTypesOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Manage Vehicle Types
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Vehicle Types</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Vehicle Type Name (e.g. SUV, Sedan)" 
                        value={newVehicleTypeName}
                        onChange={(e) => setNewVehicleTypeName(e.target.value)}
                      />
                      <Button onClick={() => createVehicleTypeMutation.mutate(newVehicleTypeName)}>Add</Button>
                    </div>
                    <div className="space-y-2">
                      {vehicleTypes.map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-2 border rounded-md">
                          <span>{type.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Service</DialogTitle>
                  </DialogHeader>
                  <AddServiceForm onClose={() => setIsAddServiceOpen(false)} vehicleTypes={vehicleTypes} />
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <Card key={service.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      {(service as any).hsnCode && (
                        <p className="text-xs text-muted-foreground mt-0.5">HSN: {(service as any).hsnCode}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => setEditingService(service)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Are you sure you want to delete this service?")) {
                          deleteServiceMutation.mutate(service.id!);
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {service.pricingByVehicleType.map((p) => (
                        <div key={p.vehicleType} className="border-b pb-2 last:border-0 last:pb-0 space-y-1">
                          <span className="text-xs font-bold text-primary uppercase">{p.vehicleType}</span>
                          {(p as any).warrantyOptions && (p as any).warrantyOptions.length > 0 ? (
                            <div className="space-y-0.5 pl-2">
                              {(p as any).warrantyOptions.map((opt: any, i: number) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">{opt.warrantyName}</span>
                                  <span className="font-medium">₹{opt.price}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Base Price</span>
                              <span className="font-medium">₹{p.price}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Service</DialogTitle>
                </DialogHeader>
                {editingService && (
                  <AddServiceForm 
                    onClose={() => setEditingService(null)} 
                    vehicleTypes={vehicleTypes} 
                    initialData={editingService} 
                  />
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="ppf" className="space-y-6">
            {showRollHistory ? (
              <RollHistoryView onBack={goBackToPPF} />
            ) : showUsedRolls ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={goBackToPPF} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to PPF Master
                  </Button>
                  <div>
                    <h2 className="text-lg font-semibold">Used Rolls</h2>
                    <p className="text-sm text-muted-foreground">Rolls with 10 sqft or less remaining. These rolls are considered depleted and cannot be used for new jobs.</p>
                  </div>
                </div>

                {(() => {
                  // Flatten all used rolls across all PPF masters
                  const allUsedRolls = ppfs.flatMap(ppf =>
                    (ppf.rolls || [])
                      .filter(r => r.stock <= 10)
                      .map(r => ({ ...r, ppfName: ppf.name, ppfId: ppf.id }))
                  );

                  if (allUsedRolls.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <Archive className="h-12 w-12 mb-4 opacity-30" />
                        <p className="text-base font-medium">No used rolls yet</p>
                        <p className="text-sm mt-1">Rolls with 10 sqft or less will automatically appear here.</p>
                      </div>
                    );
                  }

                  // Unique PPF names for filter dropdown
                  const uniquePPFs = Array.from(new Set(allUsedRolls.map(r => r.ppfName)));

                  // Apply search
                  let filtered = allUsedRolls.filter(r => {
                    const q = usedRollSearch.toLowerCase();
                    return r.name.toLowerCase().includes(q) || r.ppfName.toLowerCase().includes(q);
                  });

                  // Apply PPF filter
                  if (usedRollFilterPPF !== "all") {
                    filtered = filtered.filter(r => r.ppfName === usedRollFilterPPF);
                  }

                  // Apply sort
                  filtered = [...filtered].sort((a, b) => {
                    let cmp = 0;
                    if (usedRollSortKey === "name") cmp = a.name.localeCompare(b.name);
                    else if (usedRollSortKey === "ppf") cmp = a.ppfName.localeCompare(b.ppfName);
                    else if (usedRollSortKey === "stock") cmp = a.stock - b.stock;
                    return usedRollSortDir === "asc" ? cmp : -cmp;
                  });

                  const toggleSort = (key: "name" | "ppf" | "stock") => {
                    if (usedRollSortKey === key) {
                      setUsedRollSortDir(d => d === "asc" ? "desc" : "asc");
                    } else {
                      setUsedRollSortKey(key);
                      setUsedRollSortDir("asc");
                    }
                  };

                  const SortIcon = ({ col }: { col: "name" | "ppf" | "stock" }) => {
                    if (usedRollSortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
                    return usedRollSortDir === "asc"
                      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />
                      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
                  };

                  return (
                    <div className="space-y-4">
                      {/* Search + Filter bar */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Input
                            placeholder="Search by roll name or PPF..."
                            value={usedRollSearch}
                            onChange={e => setUsedRollSearch(e.target.value)}
                            className="pl-9"
                          />
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Select value={usedRollFilterPPF} onValueChange={setUsedRollFilterPPF}>
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="All PPFs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All PPFs</SelectItem>
                            {uniquePPFs.map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(usedRollSearch || usedRollFilterPPF !== "all") && (
                          <Button variant="ghost" size="sm" onClick={() => { setUsedRollSearch(""); setUsedRollFilterPPF("all"); }} className="flex items-center gap-1 shrink-0">
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset
                          </Button>
                        )}
                      </div>

                      {/* Record count */}
                      <p className="text-sm text-muted-foreground">{filtered.length} roll{filtered.length !== 1 ? "s" : ""} found</p>

                      {/* Table */}
                      {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border rounded-lg">
                          <Archive className="h-8 w-8 mb-3 opacity-30" />
                          <p className="text-sm font-medium">No rolls match your search</p>
                          <p className="text-xs mt-1">Try adjusting your filters.</p>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">
                                  <button onClick={() => toggleSort("name")} className="flex items-center text-xs uppercase tracking-wide font-semibold hover:text-primary transition-colors">
                                    Roll Name <SortIcon col="name" />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  <button onClick={() => toggleSort("ppf")} className="flex items-center text-xs uppercase tracking-wide font-semibold hover:text-primary transition-colors">
                                    PPF <SortIcon col="ppf" />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  <button onClick={() => toggleSort("stock")} className="flex items-center ml-auto text-xs uppercase tracking-wide font-semibold hover:text-primary transition-colors">
                                    Remaining <SortIcon col="stock" />
                                  </button>
                                </th>
                                <th className="px-4 py-3 text-center font-medium text-xs uppercase tracking-wide font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filtered.map((roll, i) => (
                                <tr key={`${roll.ppfId}-${roll.id || i}`} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-medium">{roll.name}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center gap-1.5 text-primary">
                                      <Shield className="h-3.5 w-3.5" />
                                      {roll.ppfName}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={`font-bold ${roll.stock === 0 ? "text-destructive" : "text-orange-600 dark:text-orange-400"}`}>
                                      {roll.stock} <span className="text-xs font-normal text-muted-foreground">sqft</span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {roll.stock === 0
                                      ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Empty</span>
                                      : <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">Low Stock</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
            <>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={goToRollHistory} className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Roll History
              </Button>
              <Button variant="outline" onClick={goToUsedRolls} className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Used Rolls
              </Button>
              <Dialog open={isManageVehicleTypesOpen} onOpenChange={setIsManageVehicleTypesOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Manage Vehicle Types
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Vehicle Types</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Vehicle Type Name (e.g. SUV, Sedan)" 
                        value={newVehicleTypeName}
                        onChange={(e) => setNewVehicleTypeName(e.target.value)}
                      />
                      <Button onClick={() => createVehicleTypeMutation.mutate(newVehicleTypeName)}>Add</Button>
                    </div>
                    <div className="space-y-2">
                      {vehicleTypes.map((type) => (
                        <div key={type.id} className="flex items-center justify-between p-2 border rounded-md">
                          <span>{type.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddPPFOpen} onOpenChange={setIsAddPPFOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add PPF
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New PPF</DialogTitle>
                  </DialogHeader>
                  <AddPPFForm onClose={() => setIsAddPPFOpen(false)} vehicleTypes={vehicleTypes} />
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ppfs.map((ppf) => {
                const activeRolls = (ppf.rolls || []).filter(r => r.stock > 10);
                return (
                <Card key={ppf.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg">{ppf.name}</CardTitle>
                      {(ppf as any).hsnCode && (
                        <p className="text-xs text-muted-foreground mt-0.5">HSN: {(ppf as any).hsnCode}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Manage Rolls" onClick={() => setManagingRollsPPF(ppf)}>
                        <Layers className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingPPF(ppf)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Are you sure you want to delete this PPF?")) {
                          deletePPFMutation.mutate(ppf.id!);
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      {ppf.pricingByVehicleType.map((v) => (
                        <div key={v.vehicleType} className="border-b pb-2 last:border-0 last:pb-0">
                          <div className="text-xs font-bold text-primary uppercase mb-1">{v.vehicleType}</div>
                          {v.options.map((opt, i) => (
                            <div key={i} className="flex justify-between items-center text-xs ml-2">
                              <span className="text-muted-foreground">{opt.warrantyName}</span>
                              <span className="font-medium">₹{opt.price}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      <button
                        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors pt-2 border-t mt-2"
                        onClick={() => setManagingRollsPPF(ppf)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" />
                          Roll Inventory
                        </span>
                        <span className="font-semibold">{activeRolls.length} roll{activeRolls.length !== 1 ? "s" : ""}</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            <Dialog open={!!editingPPF} onOpenChange={(open) => !open && setEditingPPF(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit PPF</DialogTitle>
                </DialogHeader>
                {editingPPF && (
                  <AddPPFForm 
                    onClose={() => setEditingPPF(null)} 
                    vehicleTypes={vehicleTypes} 
                    initialData={editingPPF} 
                  />
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={!!managingRollsPPF} onOpenChange={(open) => !open && setManagingRollsPPF(null)}>
              <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Roll Inventory — {managingRollsPPF?.name}
                  </DialogTitle>
                </DialogHeader>
                {managingRollsPPF && (
                  <ManageRollsForm
                    ppf={managingRollsPPF}
                    onClose={() => setManagingRollsPPF(null)}
                  />
                )}
              </DialogContent>
            </Dialog>
            </>
            )}
          </TabsContent>

          <TabsContent value="accessories" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1">
                <Input 
                  placeholder="Search accessories by name..." 
                  value={accessorySearchQuery}
                  onChange={(e) => setAccessorySearchQuery(e.target.value)}
                  className="h-11"
                  data-testid="input-search-accessories"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Link href="/masters/accessory-category/manage">
                  <Button variant="outline" className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Manage Categories
                  </Button>
                </Link>

                <Dialog open={isAddAccessoryOpen} onOpenChange={setIsAddAccessoryOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Add Accessory
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Accessory</DialogTitle>
                  </DialogHeader>
                  <AddAccessoryForm 
                    onClose={() => setIsAddAccessoryOpen(false)} 
                    categories={accessoryCategories}
                    onAddCategory={(name) => createCategoryMutation.mutate(name)}
                  />
                </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAccessories.map((accessory) => (
                <Card key={accessory.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">{accessory.category}</div>
                      <CardTitle className="text-lg">{accessory.name}</CardTitle>
                      {(accessory as any).hsnCode && (
                        <p className="text-xs text-muted-foreground mt-0.5">HSN: {(accessory as any).hsnCode}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingAccessory(accessory)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Are you sure you want to delete this accessory?")) {
                          deleteAccessoryMutation.mutate(accessory.id!);
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground">Quantity</span>
                        <span className="font-bold text-xl">{accessory.quantity}</span>
                        {Number(accessory.buffer || 0) > 0 && (
                          <span className="text-[10px] font-semibold text-amber-600">
                            Buffer: {accessory.buffer}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] uppercase text-muted-foreground">Price</span>
                        <span className="font-bold text-xl text-primary">₹{accessory.price}</span>
                      </div>
                    </div>
                    {(accessory as any).hasDualPricing && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded p-2 text-center">
                          <div className="text-[10px] uppercase text-muted-foreground font-medium">4 Window</div>
                          <div className="font-bold text-sm text-primary">₹{(accessory as any).price4Window || 0}</div>
                        </div>
                        <div className="bg-slate-50 rounded p-2 text-center">
                          <div className="text-[10px] uppercase text-muted-foreground font-medium">6 Window</div>
                          <div className="font-bold text-sm text-primary">₹{(accessory as any).price6Window || 0}</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Dialog open={!!editingAccessory} onOpenChange={(open) => !open && setEditingAccessory(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Accessory</DialogTitle>
                </DialogHeader>
                {editingAccessory && (
                  <AddAccessoryForm 
                    onClose={() => setEditingAccessory(null)} 
                    initialData={editingAccessory} 
                    categories={accessoryCategories}
                    onAddCategory={(name) => createCategoryMutation.mutate(name)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* HSN Codes Tab */}
          <TabsContent value="hsncodes" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search HSN codes by code or description..."
                  value={hsnSearchQuery}
                  onChange={(e) => setHsnSearchQuery(e.target.value)}
                  className="h-11"
                />
              </div>
              <Dialog open={isAddHsnCodeOpen} onOpenChange={setIsAddHsnCodeOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add HSN Code
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New HSN Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>HSN Code *</Label>
                      <Input
                        placeholder="e.g. 998713"
                        value={newHsnCode.code}
                        onChange={(e) => setNewHsnCode(prev => ({ ...prev, code: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description *</Label>
                      <Input
                        placeholder="e.g. PPF Installation / Ceramic Coating"
                        value={newHsnCode.description}
                        onChange={(e) => setNewHsnCode(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newHsnCode.code.trim() || !newHsnCode.description.trim() || createHsnCodeMutation.isPending}
                      onClick={() => createHsnCodeMutation.mutate({ code: newHsnCode.code.trim(), description: newHsnCode.description.trim() })}
                    >
                      {createHsnCodeMutation.isPending ? "Adding..." : "Add HSN Code"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="border rounded-md overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500 border-b grid grid-cols-12 gap-4">
                <span className="col-span-3">HSN Code</span>
                <span className="col-span-8">Description</span>
                <span className="col-span-1"></span>
              </div>
              {(() => {
                const filtered = hsnCodes.filter(h =>
                  !hsnSearchQuery ||
                  h.code.includes(hsnSearchQuery) ||
                  h.description?.toLowerCase().includes(hsnSearchQuery.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No HSN codes match your search.
                    </div>
                  );
                }
                return filtered.map((hsn) => (
                  <div key={hsn.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-0 items-center">
                    {editingHsnCode?.id === hsn.id ? (
                      <>
                        <div className="col-span-3">
                          <Input
                            value={editingHsnCode.code}
                            onChange={(e) => setEditingHsnCode(prev => prev ? ({ ...prev, code: e.target.value }) : null)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-7">
                          <Input
                            value={editingHsnCode.description}
                            onChange={(e) => setEditingHsnCode(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-2 flex gap-1 justify-end">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (editingHsnCode.id) {
                                updateHsnCodeMutation.mutate({
                                  id: editingHsnCode.id,
                                  data: { code: editingHsnCode.code, description: editingHsnCode.description }
                                });
                              }
                            }}
                            disabled={updateHsnCodeMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingHsnCode(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-3 flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-red-600">{hsn.code}</span>
                        </div>
                        <div className="col-span-8">
                          <span className="text-sm text-slate-700">{hsn.description}</span>
                        </div>
                        <div className="col-span-1 flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => setEditingHsnCode({ id: hsn.id, code: hsn.code, description: hsn.description || "" })}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Delete this HSN code?")) {
                                deleteHsnCodeMutation.mutate(hsn.id!);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function AddServiceForm({ onClose, vehicleTypes, initialData }: { onClose: () => void, vehicleTypes: VehicleType[], initialData?: ServiceMaster }) {
  const { toast } = useToast();
  const [name, setName] = useState(initialData?.name || "");
  const [hsnCode, setHsnCode] = useState((initialData as any)?.hsnCode || "");
  const [pricing, setPricing] = useState<any[]>(
    (initialData?.pricingByVehicleType || []).map((p: any) => ({
      ...p,
      warrantyOptions: p.warrantyOptions || [],
    }))
  );

  const serviceMutation = useMutation({
    mutationFn: (data: any) => {
      if (initialData?.id) {
        return apiRequest("PATCH", `/api/masters/services/${initialData.id}`, data);
      }
      return apiRequest("POST", api.masters.services.create.path, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.services.list.path] });
      toast({ title: "Success", description: initialData ? "Service updated successfully" : "Service added successfully" });
      onClose();
    },
  });

  const addVehiclePricing = (typeName: string) => {
    if (pricing.some(p => p.vehicleType === typeName)) return;
    setPricing([...pricing, { vehicleType: typeName, price: 0, warrantyOptions: [] }]);
  };

  const updatePrice = (typeIndex: number, value: string) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].price = value;
    setPricing(newPricing);
  };

  const addWarrantyOption = (typeIndex: number) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].warrantyOptions = [...(newPricing[typeIndex].warrantyOptions || []), { warrantyName: "", price: 0 }];
    setPricing(newPricing);
  };

  const updateWarrantyOption = (typeIndex: number, optIndex: number, field: string, value: any) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].warrantyOptions[optIndex][field] = value;
    setPricing(newPricing);
  };

  const removeWarrantyOption = (typeIndex: number, optIndex: number) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].warrantyOptions.splice(optIndex, 1);
    setPricing(newPricing);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Service Name</Label>
          <Input placeholder="e.g. Garware Glaze" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>HSN Code <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          <HsnCombobox
            value={hsnCode}
            onChange={setHsnCode}
            placeholder="Search or type HSN code..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-bold">Pricing by Vehicle Type</Label>
          <div className="w-64">
            <Select onValueChange={(value) => addVehiclePricing(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Add Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map(vt => (
                  <SelectItem key={vt.id} value={vt.name} disabled={pricing.some(p => p.vehicleType === vt.name)}>
                    {vt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pricing.map((p, typeIndex) => (
          <Card key={p.vehicleType} className="border-dashed overflow-visible">
            <CardHeader className="py-3 bg-muted/50 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold uppercase">{p.vehicleType}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => {
                const n = [...pricing];
                n.splice(typeIndex, 1);
                setPricing(n);
              }}><X className="h-4 w-4 text-destructive" /></Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Base Price (no warranty)</Label>
                <Input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0" 
                  value={p.price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^[0-9]+$/.test(value)) {
                      updatePrice(typeIndex, value);
                    }
                  }}
                />
              </div>

              {/* Warranty Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase text-muted-foreground">Warranty Options</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addWarrantyOption(typeIndex)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Warranty
                  </Button>
                </div>
                {(p.warrantyOptions || []).map((opt: any, optIndex: number) => (
                  <div key={optIndex} className="flex gap-2 items-center">
                    <Input
                      placeholder="Warranty name (e.g. 1 Year)"
                      value={opt.warrantyName}
                      onChange={(e) => updateWarrantyOption(typeIndex, optIndex, "warrantyName", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Price"
                      value={opt.price}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^[0-9]+$/.test(value)) {
                          updateWarrantyOption(typeIndex, optIndex, "price", value);
                        }
                      }}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeWarrantyOption(typeIndex, optIndex)}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => serviceMutation.mutate({ name, hsnCode, pricingByVehicleType: pricing })}>
          {initialData ? "Update Service" : "Save Service"}
        </Button>
      </div>
    </div>
  );
}

function AddPPFForm({ onClose, vehicleTypes, initialData }: { onClose: () => void, vehicleTypes: VehicleType[], initialData?: PPFMaster }) {
  const { toast } = useToast();
  const [name, setName] = useState(initialData?.name || "");
  const [hsnCode, setHsnCode] = useState((initialData as any)?.hsnCode || "");
  const [pricing, setPricing] = useState<any[]>(initialData?.pricingByVehicleType || []);
  const [rolls, setRolls] = useState<any[]>(initialData?.rolls || []);

  const ppfMutation = useMutation({
    mutationFn: (data: any) => {
      if (initialData?.id) {
        return apiRequest("PATCH", `/api/masters/ppf/${initialData.id}`, data);
      }
      return apiRequest("POST", api.masters.ppf.create.path, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.ppf.list.path] });
      toast({ title: "Success", description: initialData ? "PPF updated successfully" : "PPF added successfully" });
      onClose();
    },
  });

  const addRoll = () => {
    setRolls([...rolls, { name: "", stock: 0 }]);
  };

  const updateRoll = (index: number, field: string, value: any) => {
    const newRolls = [...rolls];
    newRolls[index] = { ...newRolls[index], [field]: value };
    setRolls(newRolls);
  };

  const removeRoll = (index: number) => {
    const newRolls = [...rolls];
    newRolls.splice(index, 1);
    setRolls(newRolls);
  };

  const addVehiclePricing = (typeName: string) => {
    if (pricing.some(p => p.vehicleType === typeName)) return;
    setPricing([...pricing, { 
      vehicleType: typeName, 
      options: [{ warrantyName: "", price: 0 }] 
    }]);
  };

  const addOption = (typeIndex: number) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].options.push({ warrantyName: "", price: 0 });
    setPricing(newPricing);
  };

  const updateOption = (typeIndex: number, optIndex: number, field: string, value: any) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].options[optIndex][field] = value;
    setPricing(newPricing);
  };

  const removeOption = (typeIndex: number, optIndex: number) => {
    const newPricing = [...pricing];
    newPricing[typeIndex].options.splice(optIndex, 1);
    setPricing(newPricing);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>PPF Name</Label>
          <Input placeholder="e.g. Garware Premium" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>HSN Code <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
          <HsnCombobox
            value={hsnCode}
            onChange={setHsnCode}
            placeholder="Search or type HSN code..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-bold">Pricing by Vehicle Type</Label>
          <div className="w-64">
            <Select onValueChange={(value) => addVehiclePricing(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Add Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map(vt => (
                  <SelectItem key={vt.id} value={vt.name} disabled={pricing.some(p => p.vehicleType === vt.name)}>
                    {vt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {pricing.map((p, typeIndex) => (
          <Card key={p.vehicleType} className="border-dashed overflow-visible">
            <CardHeader className="py-3 bg-muted/50 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold uppercase">{p.vehicleType}</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{p.options.length} options</span>
                <Button variant="ghost" size="sm" onClick={() => {
                  const n = [...pricing];
                  n.splice(typeIndex, 1);
                  setPricing(n);
                }}><X className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-[1fr,120px,40px] gap-4 mb-2 items-end">
                <Label className="text-[10px] uppercase text-muted-foreground">Warranty Name</Label>
                <Label className="text-[10px] uppercase text-muted-foreground text-right">Price</Label>
                <span></span>
              </div>
              
              {p.options.map((opt: any, optIndex: number) => (
                <div key={optIndex} className="grid grid-cols-[1fr,120px,40px] gap-4 items-center">
                  <Input 
                    placeholder="e.g. TPU 5 Years Gloss" 
                    value={opt.warrantyName} 
                    onChange={(e) => updateOption(typeIndex, optIndex, "warrantyName", e.target.value)}
                  />
                  <Input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0" 
                    value={opt.price}
                    className="text-right"
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^[0-9]+$/.test(value)) {
                        updateOption(typeIndex, optIndex, "price", value);
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeOption(typeIndex, optIndex)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-dashed"
                onClick={() => addOption(typeIndex)}
              >
                <Plus className="h-3 w-3 mr-2" />
                Add Warranty Option
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => ppfMutation.mutate({ name, hsnCode, pricingByVehicleType: pricing, rolls })}>
          {initialData ? "Update PPF" : "Save PPF"}
        </Button>
      </div>
    </div>
  );
}

function ManageRollsForm({ ppf, onClose }: { ppf: PPFMaster; onClose: () => void }) {
  const { toast } = useToast();
  const allRolls: any[] = ppf.rolls || [];
  const usedRolls = allRolls.filter((r: any) => (r.stock || 0) <= 10);
  const [activeRolls, setActiveRolls] = useState<any[]>(allRolls.filter((r: any) => (r.stock || 0) > 10));
  const [newRollName, setNewRollName] = useState("");
  const [newRollStock, setNewRollStock] = useState("");
  const [rollSearch, setRollSearch] = useState("");
  const [editingRollIndex, setEditingRollIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStock, setEditStock] = useState("");

  const ppfMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/masters/ppf/${ppf.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.ppf.list.path] });
      toast({ title: "Success", description: "Roll inventory updated" });
      onClose();
    },
  });

  const addRoll = () => {
    if (!newRollName.trim()) return;
    setActiveRolls([{ name: newRollName.trim(), stock: parseInt(newRollStock) || 0 }, ...activeRolls]);
    setNewRollName("");
    setNewRollStock("");
  };

  const startEdit = (index: number) => {
    setEditingRollIndex(index);
    setEditName(activeRolls[index].name);
    setEditStock(String(activeRolls[index].stock));
  };

  const confirmEdit = (index: number) => {
    const updated = [...activeRolls];
    updated[index] = { ...updated[index], name: editName, stock: parseInt(editStock) || 0 };
    setActiveRolls(updated);
    setEditingRollIndex(null);
  };

  const removeRoll = (index: number) => {
    const updated = [...activeRolls];
    updated.splice(index, 1);
    setActiveRolls(updated);
    if (editingRollIndex === index) setEditingRollIndex(null);
  };

  const handleSave = () => {
    const mergedRolls = [...activeRolls, ...usedRolls];
    ppfMutation.mutate({ name: ppf.name, pricingByVehicleType: ppf.pricingByVehicleType, rolls: mergedRolls });
  };

  const filteredRolls = activeRolls
    .map((roll, index) => ({ roll, index }))
    .filter(({ roll }) => !rollSearch.trim() || roll.name.toLowerCase().includes(rollSearch.trim().toLowerCase()));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="space-y-3 p-1 overflow-y-auto flex-1">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add New Roll</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Roll Name</Label>
              <Input
                placeholder="e.g. Front Roll"
                value={newRollName}
                onChange={(e) => setNewRollName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoll()}
              />
            </div>
            <div className="w-28 space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Stock (sqft)</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={newRollStock}
                onChange={(e) => {
                  if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) {
                    setNewRollStock(e.target.value);
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && addRoll()}
              />
            </div>
            <Button onClick={addRoll} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {activeRolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No active rolls.</p>
            <p className="text-xs mt-1">Use the form above to add a new roll.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Existing Rolls ({activeRolls.length})</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search rolls..."
                value={rollSearch}
                onChange={(e) => setRollSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
            {filteredRolls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No rolls match your search.</p>
            ) : (
              filteredRolls.map(({ roll, index }) => (
                <div key={index} className="border rounded-lg px-3 py-2 bg-background">
                  {editingRollIndex === index ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          placeholder="Roll name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={editStock}
                          onChange={(e) => {
                            if (e.target.value === "" || /^[0-9]+$/.test(e.target.value)) {
                              setEditStock(e.target.value);
                            }
                          }}
                          className="h-8 text-sm text-right"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">sqft</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-green-600 hover:text-green-700" onClick={() => confirmEdit(index)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingRollIndex(null)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium">{roll.name}</span>
                      <span className="text-sm font-bold">{roll.stock}</span>
                      <span className="text-xs text-muted-foreground shrink-0">sqft</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEdit(index)}>
                        <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRoll(index)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t mt-4 shrink-0">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={ppfMutation.isPending}>
          Save Rolls
        </Button>
      </div>
    </div>
  );
}

function AddAccessoryForm({ 
  onClose, 
  initialData, 
  categories, 
  onAddCategory 
}: { 
  onClose: () => void, 
  initialData?: AccessoryMaster,
  categories: AccessoryCategory[],
  onAddCategory: (name: string) => void
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState(initialData?.category || "");
  const [name, setName] = useState(initialData?.name || "");
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() || "0");
  const [price, setPrice] = useState(initialData?.price?.toString() || "0");
  const [hsnCode, setHsnCode] = useState(initialData?.hsnCode || "");
  const [hasDualPricing, setHasDualPricing] = useState(initialData?.hasDualPricing || false);
  const [price4Window, setPrice4Window] = useState((initialData?.price4Window ?? 0).toString());
  const [price6Window, setPrice6Window] = useState((initialData?.price6Window ?? 0).toString());

  const { data: accessories = [] } = useQuery<AccessoryMaster[]>({
    queryKey: [api.masters.accessories.list.path],
  });

  const accessoryMutation = useMutation({
    mutationFn: async (data: any) => {
      let res: Response;
      if (initialData?.id) {
        res = await apiRequest("PATCH", `/api/masters/accessories/${initialData.id}`, data);
      } else {
        res = await apiRequest("POST", api.masters.accessories.create.path, data);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      queryClient.refetchQueries({ queryKey: [api.masters.accessories.list.path] });
      toast({ title: "Success", description: initialData ? "Accessory updated successfully" : "Accessory added successfully" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  // Get unique accessory names for the current category
  const existingNames = Array.from(new Set(
    accessories
      .filter(a => a.category === category)
      .map(a => a.name)
  )).map(n => ({ label: n, value: n }));

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Category / Type</Label>
        <SearchableSelect
          options={categories.map(c => ({ label: c.name, value: c.name }))}
          value={category}
          onValueChange={setCategory}
          placeholder="Select category"
          searchPlaceholder="Search select category..."
          addNewLabel="Add New Category"
          onAddNew={() => {
            const name = prompt("Enter new category name:");
            if (name) onAddCategory(name);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Accessory Name</Label>
        <SearchableSelect
          options={existingNames}
          value={name}
          onValueChange={setName}
          placeholder="Select or enter name"
          searchPlaceholder="Search accessory name..."
          addNewLabel="Add New Accessory Name"
          onAddNew={() => {
            const newName = prompt("Enter new accessory name:");
            if (newName) setName(newName);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
           <Label>{initialData ? "Available Quantity / Add Stock" : "Quantity"}</Label>
          <Input 
            type="number" 
            placeholder="0" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)} 
          />
           {initialData && (
             <p className="text-[11px] text-muted-foreground">
               Increasing this value consumes the pending buffer first.
             </p>
           )}
        </div>
        <div className="space-y-2">
          <Label>Default Price (₹)</Label>
          <Input 
            type="number" 
            placeholder="0" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)} 
          />
        </div>
      </div>

      {/* Dual Window Pricing Toggle */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50">
        <input
          type="checkbox"
          id="hasDualPricing"
          checked={hasDualPricing}
          onChange={(e) => setHasDualPricing(e.target.checked)}
          className="h-4 w-4 accent-red-600 cursor-pointer"
        />
        <label htmlFor="hasDualPricing" className="text-sm font-medium cursor-pointer select-none">
          Enable Window-based Pricing (4 Window / 6 Window)
        </label>
      </div>

      {hasDualPricing && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>4 Window Price (₹)</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={price4Window} 
              onChange={(e) => setPrice4Window(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label>6 Window Price (₹)</Label>
            <Input 
              type="number" 
              placeholder="0" 
              value={price6Window} 
              onChange={(e) => setPrice6Window(e.target.value)} 
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>HSN Code <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <HsnCombobox
          value={hsnCode}
          onChange={setHsnCode}
          placeholder="Search or type HSN code..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => accessoryMutation.mutate({ 
          category, 
          name, 
          quantity: parseInt(quantity) || 0, 
          price: parseInt(price) || 0,
          hsnCode,
          hasDualPricing,
          price4Window: hasDualPricing ? (parseFloat(price4Window) || 0) : 0,
          price6Window: hasDualPricing ? (parseFloat(price6Window) || 0) : 0,
        })}>
          {initialData ? "Update Accessory" : "Save Accessory"}
        </Button>
      </div>
    </div>
  );
}

function RollHistoryView({ onBack }: { onBack: () => void }) {
  const { data: jobCards = [], isLoading } = useQuery<JobCard[]>({
    queryKey: ["/api/job-cards"],
  });

  const [search, setSearch] = useState("");
  const [filterPPF, setFilterPPF] = useState("all");
  const [filterRoll, setFilterRoll] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function resetFilters() {
    setSearch("");
    setFilterPPF("all");
    setFilterRoll("all");
    setFilterWarranty("all");
    setDateFrom("");
    setDateTo("");
    setSortKey("date");
    setSortDir("desc");
  }

  type HistoryRow = {
    date: string;
    jobNo: string;
    jobCardId: string;
    customerName: string;
    vehicle: string;
    ppfName: string;
    rollName: string;
    sqftUsed: number;
    price: number;
    warranty: string;
    technician: string;
  };

  const historyRows: HistoryRow[] = [];

  // Parse "Quantity: Xsqft (from RollName)" patterns from a name string
  function parseRollsFromName(name: string): Array<{ rollName: string; rollUsed: number }> {
    const regex = /Quantity:\s*([\d.]+)\s*sqft\s*\(from\s+([^)]+?)\s*\)/gi;
    const results: Array<{ rollName: string; rollUsed: number }> = [];
    let match;
    while ((match = regex.exec(name)) !== null) {
      results.push({ rollUsed: parseFloat(match[1]), rollName: match[2].trim() });
    }
    return results;
  }

  // Extract warranty from name like "PPF Name (VehicleType – WarrantyName)\n..."
  function extractWarrantyFromName(name: string): string {
    const firstLine = name?.split("\n")[0] || "";
    const parenMatch = firstLine.match(/\(([^)]+)\)/);
    if (!parenMatch) return "—";
    const parts = parenMatch[1].split(/[–-]/);
    return parts.length >= 2 ? parts.slice(1).join("–").trim() : "—";
  }

  // Extract base PPF name from "PPF Name (VehicleType – ...)" → "PPF Name"
  function extractBaseName(name: string): string {
    const firstLine = name?.split("\n")[0] || "";
    const idx = firstLine.indexOf("(");
    return idx > 0 ? firstLine.slice(0, idx).trim() : firstLine.trim();
  }

  for (const jc of jobCards) {
    for (const ppf of jc.ppfs || []) {
      const vehicle = [jc.make, jc.model, jc.licensePlate].filter(Boolean).join(" · ");
      const basePpfName = extractBaseName(ppf.name || "");
      const warranty = (ppf as any).warranty || extractWarrantyFromName(ppf.name || "") || "—";
      const technician = ppf.technician || "—";

      // Try parsing rolls from the name string first (most reliable)
      const parsedRolls = parseRollsFromName(ppf.name || "");

      if (parsedRolls.length > 0) {
        for (const r of parsedRolls) {
          historyRows.push({
            date: jc.date,
            jobNo: jc.jobNo,
            jobCardId: jc.id || "",
            customerName: jc.customerName,
            vehicle,
            ppfName: basePpfName,
            rollName: r.rollName,
            sqftUsed: r.rollUsed,
            price: ppf.price,
            warranty,
            technician,
          });
        }
      } else {
        // Fallback: use scalar rollUsed field
        const rollUsed = (ppf as any).rollUsed || 0;
        historyRows.push({
          date: jc.date,
          jobNo: jc.jobNo,
          jobCardId: jc.id || "",
          customerName: jc.customerName,
          vehicle,
          ppfName: basePpfName,
          rollName: "—",
          sqftUsed: rollUsed,
          price: ppf.price,
          warranty,
          technician,
        });
      }
    }
  }

  // Build unique filter options from raw data
  const allPPFNames = Array.from(new Set(historyRows.map(r => r.ppfName).filter(n => n && n !== "—"))).sort();
  const allRollNames = Array.from(new Set(historyRows.map(r => r.rollName).filter(n => n && n !== "—"))).sort();
  const allWarranties = Array.from(new Set(historyRows.map(r => r.warranty).filter(n => n && n !== "—"))).sort();

  const activeFilters = [filterPPF, filterRoll, filterWarranty].filter(f => f !== "all").length
    + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (search ? 1 : 0);

  const filtered = historyRows
    .filter(r => {
      const q = search.toLowerCase();
      if (q && !r.jobNo.toLowerCase().includes(q) && !r.customerName.toLowerCase().includes(q)
        && !r.ppfName.toLowerCase().includes(q) && !r.rollName.toLowerCase().includes(q)
        && !r.vehicle.toLowerCase().includes(q)) return false;
      if (filterPPF !== "all" && r.ppfName !== filterPPF) return false;
      if (filterRoll !== "all" && r.rollName !== filterRoll) return false;
      if (filterWarranty !== "all" && r.warranty !== filterWarranty) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === "jobNo") cmp = a.jobNo.localeCompare(b.jobNo);
      else if (sortKey === "customer") cmp = a.customerName.localeCompare(b.customerName);
      else if (sortKey === "ppf") cmp = a.ppfName.localeCompare(b.ppfName);
      else if (sortKey === "roll") cmp = a.rollName.localeCompare(b.rollName);
      else if (sortKey === "sqft") cmp = a.sqftUsed - b.sqftUsed;
      else if (sortKey === "amount") cmp = a.price - b.price;
      else if (sortKey === "warranty") cmp = a.warranty.localeCompare(b.warranty);
      return sortDir === "asc" ? cmp : -cmp;
    });

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 text-primary inline" />
      : <ArrowDown className="h-3 w-3 ml-1 text-primary inline" />;
  }

  function SortTh({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) {
    return (
      <th
        className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${right ? "text-right" : "text-left"}`}
        onClick={() => handleSort(col)}
      >
        {children}<SortIcon col={col} />
      </th>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to PPF Master
        </Button>
        <div>
          <h2 className="text-lg font-semibold">Roll Usage History</h2>
          <p className="text-sm text-muted-foreground">Complete history of PPF rolls used across all job cards.</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <Input
              placeholder="Search job no, customer, PPF, roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={filterPPF} onValueChange={setFilterPPF}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All PPFs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PPFs</SelectItem>
              {allPPFNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterRoll} onValueChange={setFilterRoll}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Rolls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rolls</SelectItem>
              {allRollNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterWarranty} onValueChange={setFilterWarranty}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Warranties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warranties</SelectItem>
              {allWarranties.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[150px] text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[150px] text-sm" />
          </div>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {activeFilters > 0 && <span className="ml-1 text-xs text-primary">({activeFilters} filter{activeFilters !== 1 ? "s" : ""} active)</span>}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <History className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-base font-medium">{historyRows.length === 0 ? "No roll usage history yet" : "No records match your filters"}</p>
          <p className="text-sm mt-1">
            {historyRows.length === 0
              ? "PPF roll usage from job cards will appear here."
              : <button className="underline text-primary" onClick={resetFilters}>Clear all filters</button>}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b">
                <tr>
                  <SortTh col="date">Date</SortTh>
                  <SortTh col="jobNo">Job No</SortTh>
                  <SortTh col="customer">Customer</SortTh>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Vehicle</th>
                  <SortTh col="ppf">PPF</SortTh>
                  <SortTh col="roll">Roll</SortTh>
                  <SortTh col="sqft" right>Sqft Used</SortTh>
                  <SortTh col="amount" right>Amount</SortTh>
                  <SortTh col="warranty">Warranty</SortTh>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Technician</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-semibold">{row.jobNo}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{row.vehicle}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{row.ppfName}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.rollName}</td>
                    <td className="px-4 py-3 text-right">
                      {row.sqftUsed > 0 ? (
                        <span className="font-semibold">{row.sqftUsed} <span className="text-xs font-normal text-muted-foreground">sqft</span></span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">₹{row.price.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{row.warranty}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{row.technician}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
