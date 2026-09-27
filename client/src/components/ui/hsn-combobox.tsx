import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { HSN_CODES } from "@/lib/hsn-codes";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";

export function HsnCombobox({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: dbCodes = [] } = useQuery<{ id: string; code: string; description: string }[]>({
    queryKey: [api.masters.hsnCodes.list.path],
  });

  const addMutation = useMutation({
    mutationFn: (data: { code: string; description: string }) =>
      apiRequest("POST", api.masters.hsnCodes.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.hsnCodes.list.path] });
    },
  });

  useEffect(() => { setSearch(value); }, [value]);

  const dbCodeSet = new Set(dbCodes.map(c => c.code));
  const allCodes = [
    ...dbCodes,
    ...HSN_CODES.filter(h => !dbCodeSet.has(h.code)),
  ];

  const filtered = allCodes.filter(h =>
    !search || h.code.includes(search) || h.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (code: string) => {
    onChange(code);
    setSearch(code);
    setOpen(false);
  };

  const handleOpenDialog = () => {
    setOpen(false);
    setNewCode("");
    setNewDescription("");
    setDialogOpen(true);
  };

  const handleConfirmAdd = () => {
    if (!newCode.trim() || !newDescription.trim()) return;
    addMutation.mutate(
      { code: newCode.trim(), description: newDescription.trim() },
      {
        onSuccess: () => {
          onChange(newCode.trim());
          setSearch(newCode.trim());
          setDialogOpen(false);
          setNewCode("");
          setNewDescription("");
        },
      }
    );
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              className={compact ? "h-7 px-2 text-[10px]" : "h-11 text-sm"}
              placeholder={placeholder || "HSN code (search or type)..."}
              value={search}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={e => {
                setSearch(e.target.value);
                onChange(e.target.value);
                setOpen(true);
              }}
            />
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="z-[100] flex max-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-white p-0 shadow-2xl"
          style={{
            width: `min(max(var(--radix-popover-trigger-width), ${compact ? 280 : 340}px), calc(100vw - 16px))`,
          }}
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <div
              className="p-2 border-b border-border/40 shrink-0"
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm rounded-md transition-colors"
                onClick={() => handleOpenDialog()}
              >
                <Plus className="w-4 h-4" />
                Add New HSN Code
              </button>
            </div>

            <div className="p-2 border-b border-border/30 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  placeholder="Search by code or description..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); onChange(e.target.value); }}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                  No matching HSN codes. Use "Add New HSN Code" above.
                </div>
              ) : (
                filtered.map(h => (
                  <button
                    key={h.code}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/20 last:border-0"
                    onClick={() => handleSelect(h.code)}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono font-bold text-xs text-red-600 shrink-0">{h.code}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{h.description}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
        </PopoverContent>
      </Popover>

      {/* Add HSN Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New HSN Code</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="hsn-code-input">
                HSN Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="hsn-code-input"
                placeholder="e.g. 998713"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleConfirmAdd(); }}
                className="font-mono"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hsn-desc-input">
                Description <span className="text-red-500">*</span>
              </Label>
              <Input
                id="hsn-desc-input"
                placeholder="e.g. PPF Installation / Ceramic Coating"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleConfirmAdd(); }}
              />
            </div>

            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmAdd}
              disabled={!newCode.trim() || !newDescription.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? "Saving..." : "Add HSN Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
