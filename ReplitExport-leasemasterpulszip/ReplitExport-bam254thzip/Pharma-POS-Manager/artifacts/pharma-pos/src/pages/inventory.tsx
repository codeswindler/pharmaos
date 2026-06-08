import { useState } from "react";
import { useListInventory, useAdjustStock, getListInventoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Minus, Settings2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Inventory() {
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [adjustDialog, setAdjustDialog] = useState<{ isOpen: boolean; productId?: number; name?: string; currentQty?: number }>({ isOpen: false });
  const [adjustAmount, setAdjustAmount] = useState<string>("0");
  const [adjustReason, setAdjustReason] = useState("");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: inventory, isLoading } = useListInventory({ 
    lowStock: showOnlyLowStock ? true : undefined
  });
  
  const adjustStock = useAdjustStock();

  const handleAdjustment = (type: "add" | "subtract" | "set") => {
    if (!adjustDialog.productId) return;
    
    const qty = parseInt(adjustAmount, 10);
    if (isNaN(qty) || qty < 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    adjustStock.mutate({
      productId: adjustDialog.productId,
      data: { type, quantity: qty, reason: adjustReason }
    }, {
      onSuccess: () => {
        toast({ title: "Stock adjusted successfully" });
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        setAdjustDialog({ isOpen: false });
        setAdjustAmount("0");
        setAdjustReason("");
      },
      onError: () => {
        toast({ title: "Failed to adjust stock", variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ok': return "bg-green-100 text-green-800";
      case 'low': return "bg-amber-100 text-amber-800";
      case 'out': return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Inventory</h2>
          <p className="text-muted-foreground">Monitor and adjust stock levels.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Import CSV
        </Button>
      </div>

      <div className="flex items-center space-x-2 mb-6 bg-card p-4 rounded-lg border">
        <Switch
          id="low-stock"
          checked={showOnlyLowStock}
          onCheckedChange={setShowOnlyLowStock}
        />
        <Label htmlFor="low-stock">Show Low Stock Only</Label>
      </div>

      <div className="border rounded-md flex-1 overflow-auto bg-card">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock Qty</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Adjust</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : inventory?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No inventory records found.
                </TableCell>
              </TableRow>
            ) : (
              inventory?.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={item.status === 'out' ? 'text-destructive' : item.status === 'low' ? 'text-amber-600' : ''}>
                      {item.stockQty} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{item.lowStockThreshold}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)} variant="outline">
                      {item.status?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(item.lastUpdated).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setAdjustDialog({ isOpen: true, productId: item.productId, name: item.productName, currentQty: item.stockQty })}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={adjustDialog.isOpen} onOpenChange={(o) => !o && setAdjustDialog({ isOpen: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {adjustDialog.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-between items-center text-sm border-b pb-4">
              <span className="text-muted-foreground">Current Quantity</span>
              <span className="font-bold text-lg">{adjustDialog.currentQty}</span>
            </div>
            
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <Input 
                type="number" 
                value={adjustAmount} 
                onChange={(e) => setAdjustAmount(e.target.value)} 
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input 
                value={adjustReason} 
                onChange={(e) => setAdjustReason(e.target.value)} 
                placeholder="e.g. damaged, returned, found"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAdjustment("subtract")} disabled={adjustStock.isPending}>
              <Minus className="mr-2 h-4 w-4" /> Subtract
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => handleAdjustment("set")} disabled={adjustStock.isPending}>
              Set Exactly
            </Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAdjustment("add")} disabled={adjustStock.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
