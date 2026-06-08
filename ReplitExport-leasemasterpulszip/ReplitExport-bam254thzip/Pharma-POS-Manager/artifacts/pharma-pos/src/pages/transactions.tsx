import { useState } from "react";
import { Link } from "wouter";
import { useListTransactions, ListTransactionsStatus } from "@workspace/api-client-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Transactions() {
  const [status, setStatus] = useState<string>("all");
  
  const { data: transactions, isLoading } = useListTransactions({
    status: status !== "all" ? status as ListTransactionsStatus : undefined,
  });

  const getStatusColor = (txStatus: string) => {
    switch (txStatus) {
      case 'completed': return "bg-green-100 text-green-800 hover:bg-green-100";
      case 'pending': return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      case 'refunded': return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case 'cancelled': return "bg-red-100 text-red-800 hover:bg-red-100";
      default: return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Transactions</h2>
          <p className="text-muted-foreground">View and manage past sales and receipts.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md flex-1 overflow-auto bg-card">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : transactions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              transactions?.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-medium">#{tx.id.toString().padStart(6, '0')}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>{tx.customerName || <span className="text-muted-foreground italic">Walk-in</span>}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(tx.status)} variant="outline">
                      {tx.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{tx.paymentMethod.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right font-bold">KES {Number(tx.totalAmount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/checkout/receipt/${tx.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10">
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
