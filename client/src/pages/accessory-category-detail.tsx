import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, Package, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { AccessoryMaster, AccessoryCategory } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";

export default function AccessoryCategoryDetail() {
  const { toast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newAccessoryName, setNewAccessoryName] = useState("");
  const [newAccessoryQuantity, setNewAccessoryQuantity] = useState("");
  const [newAccessoryPrice, setNewAccessoryPrice] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  
  const [selectedCategory, setSelectedCategory] = useState<AccessoryCategory | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState("");
  
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [editAccessoryName, setEditAccessoryName] = useState("");
  const [editAccessoryQuantity, setEditAccessoryQuantity] = useState("");
  const [editAccessoryPrice, setEditAccessoryPrice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ description: string; onConfirm: () => void } | null>(null);

  const { data: categories = [] } = useQuery<AccessoryCategory[]>({
    queryKey: [api.masters.accessories.categories.list.path],
  });

  const { data: accessories = [] } = useQuery<AccessoryMaster[]>({
    queryKey: [api.masters.accessories.list.path],
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", api.masters.accessories.categories.create.path, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      setNewCategoryName("");
      toast({ title: "Success", description: "Category added successfully" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      apiRequest("PATCH", `/api/masters/accessory-categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      setEditingCategoryId(null);
      toast({ title: "Success", description: "Category updated successfully" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => apiRequest("DELETE", `/api/masters/accessory-categories/${categoryId}`),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.categories.list.path] });
      if (selectedCategory?.id === categoryId) setSelectedCategory(null);
      toast({ title: "Success", description: "Category deleted successfully" });
    },
  });

  const createAccessoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", api.masters.accessories.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      setNewAccessoryName("");
      setNewAccessoryQuantity("");
      setNewAccessoryPrice("");
      toast({ title: "Success", description: "Accessory item added successfully" });
    },
  });

  const updateAccessoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/masters/accessories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      setEditingAccessoryId(null);
      toast({ title: "Success", description: "Accessory updated successfully" });
    },
  });

  const deleteAccessoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/masters/accessories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      toast({ title: "Success", description: "Accessory deleted successfully" });
    },
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/masters?tab=accessories">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
            Manage Categories & Accessories
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-4 w-4" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="New Category" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  data-testid="input-new-category"
                />
                <Button size="icon" onClick={() => createCategoryMutation.mutate(newCategoryName)} data-testid="button-add-category">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Input 
                  placeholder="Search categories..." 
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="mb-3"
                  data-testid="input-search-categories"
                />
                {categories
                  .filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                  .map((cat) => (
                  <div 
                    key={cat.id} 
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                      selectedCategory?.id === cat.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedCategory(cat)}
                    data-testid={`category-item-${cat.id}`}
                  >
                    {editingCategoryId === cat.id ? (
                      <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                        <Input 
                          className="h-7 text-xs text-foreground"
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          data-testid="input-edit-category"
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7"
                          onClick={() => updateCategoryMutation.mutate({ id: cat.id!, name: editCategoryValue })}
                          data-testid="button-confirm-edit-category"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7"
                          onClick={() => setEditingCategoryId(null)}
                          data-testid="button-cancel-edit-category"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${selectedCategory?.id === cat.id ? "text-primary-foreground hover:text-primary-foreground" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategoryId(cat.id!);
                              setEditCategoryValue(cat.name);
                            }}
                            data-testid={`button-edit-category-${cat.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${selectedCategory?.id === cat.id ? "text-primary-foreground hover:text-primary-foreground" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                                    setDeleteTarget({
                                      description: "Delete category?",
                                      onConfirm: () => deleteCategoryMutation.mutate(cat.id!),
                                    });
                            }}
                            data-testid={`button-delete-category-${cat.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                {selectedCategory ? `Accessories in ${selectedCategory.name}` : "Select a Category"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCategory ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2">
                      <Input 
                        placeholder="Name" 
                        value={newAccessoryName}
                        onChange={(e) => setNewAccessoryName(e.target.value)}
                        data-testid="input-new-accessory-name"
                      />
                    </div>
                    <Input 
                      placeholder="Qty" 
                      type="number"
                      value={newAccessoryQuantity}
                      onChange={(e) => setNewAccessoryQuantity(e.target.value)}
                      data-testid="input-new-accessory-qty"
                    />
                    <Input 
                      placeholder="Price" 
                      type="number"
                      value={newAccessoryPrice}
                      onChange={(e) => setNewAccessoryPrice(e.target.value)}
                      data-testid="input-new-accessory-price"
                    />
                    <div className="sm:col-span-4 flex justify-end">
                      <Button 
                        onClick={() => createAccessoryMutation.mutate({
                          category: selectedCategory.name,
                          name: newAccessoryName,
                          quantity: Number(newAccessoryQuantity) || 0,
                          price: Number(newAccessoryPrice) || 0
                        })}
                        data-testid="button-add-accessory"
                      >
                        Add Item
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {accessories
                      .filter(a => a.category === selectedCategory.name)
                      .map((acc) => (
                        <div key={acc.id} className="p-3 border rounded-md" data-testid={`accessory-item-${acc.id}`}>
                          {editingAccessoryId === acc.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <div className="sm:col-span-2">
                                  <Input 
                                    placeholder="Name"
                                    value={editAccessoryName}
                                    onChange={(e) => setEditAccessoryName(e.target.value)}
                                    data-testid="input-edit-accessory-name"
                                  />
                                </div>
                                <Input 
                                  type="number"
                                  placeholder="Qty"
                                  value={editAccessoryQuantity}
                                  onChange={(e) => setEditAccessoryQuantity(e.target.value)}
                                  data-testid="input-edit-accessory-qty"
                                />
                                <Input 
                                  type="number"
                                  placeholder="Price"
                                  value={editAccessoryPrice}
                                  onChange={(e) => setEditAccessoryPrice(e.target.value)}
                                  data-testid="input-edit-accessory-price"
                                />
                              </div>
                              <div className="flex justify-end gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => updateAccessoryMutation.mutate({ 
                                    id: acc.id!, 
                                    data: { 
                                      name: editAccessoryName,
                                      quantity: Number(editAccessoryQuantity) || 0,
                                      price: Number(editAccessoryPrice) || 0
                                    } 
                                  })}
                                  data-testid="button-confirm-edit-accessory"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => setEditingAccessoryId(null)}
                                  data-testid="button-cancel-edit-accessory"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <span className="font-medium truncate" data-testid={`text-accessory-name-${acc.id}`}>{acc.name}</span>
                                <span className="text-sm text-muted-foreground" data-testid={`text-accessory-qty-${acc.id}`}>Qty: {acc.quantity}</span>
                                <span className="text-sm text-muted-foreground text-primary font-bold" data-testid={`text-accessory-price-${acc.id}`}>₹{acc.price}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingAccessoryId(acc.id!);
                                    setEditAccessoryName(acc.name);
                                    setEditAccessoryQuantity(acc.quantity.toString());
                                    setEditAccessoryPrice(acc.price.toString());
                                  }}
                                  data-testid={`button-edit-accessory-${acc.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setDeleteTarget({
                                      description: "Delete accessory?",
                                      onConfirm: () => deleteAccessoryMutation.mutate(acc.id!),
                                    });
                                  }}
                                  data-testid={`button-delete-accessory-${acc.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md">
                  Select a category from the list to manage its accessories
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Confirm deletion"
        description={deleteTarget?.description ?? ""}
        onConfirm={() => {
          deleteTarget?.onConfirm();
          setDeleteTarget(null);
        }}
        isPending={deleteCategoryMutation.isPending || deleteAccessoryMutation.isPending}
      />
    </Layout>
  );
}
