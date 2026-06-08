import { useState } from "react";
import { useListMessages, useSendMessage, getListMessagesQueryKey, MessageInputRecipientType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, Send, Clock, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

const messageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  recipientType: z.enum(["all", "loyalty", "inactive", "custom"]),
});

type MessageFormValues = z.infer<typeof messageSchema>;

export default function Messages() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: messages, isLoading } = useListMessages();
  const sendMessage = useSendMessage();

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      title: "",
      content: "",
      recipientType: "all",
    },
  });

  const onSubmit = (data: MessageFormValues) => {
    sendMessage.mutate({ 
      data: {
        title: data.title,
        content: data.content,
        recipientType: data.recipientType as MessageInputRecipientType,
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Message campaign created successfully" });
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
        setIsDialogOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "Failed to create message campaign", variant: "destructive" });
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sent</Badge>;
      case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Scheduled</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Messages</h2>
          <p className="text-muted-foreground">Send bulk SMS or email campaigns to customers.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Compose Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>New Message Campaign</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Holiday Sale" {...field} />
                      </FormControl>
                      <FormDescription>Internal name for this campaign.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipients</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select recipients" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          <SelectItem value="loyalty">Loyalty Members</SelectItem>
                          <SelectItem value="inactive">Inactive Customers (30+ days)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Type your message here..." 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground text-right mt-1">
                        {field.value.length} characters ({(Math.ceil(field.value.length / 160)) || 1} SMS)
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="bg-muted p-4 rounded-md flex items-start gap-3">
                  <Users className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Estimated Reach</p>
                    <p className="text-xs text-muted-foreground">
                      This campaign will be sent to approximately {form.watch("recipientType") === "all" ? "all" : form.watch("recipientType") === "loyalty" ? "loyalty" : "inactive"} customers in your database.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={sendMessage.isPending} className="gap-2">
                    <Send className="h-4 w-4" /> Send Now
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Campaigns</p>
              <h3 className="text-2xl font-bold">{messages?.length || 0}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Messages Sent</p>
              <h3 className="text-2xl font-bold">
                {messages?.filter(m => m.status === 'sent').reduce((acc, m) => acc + m.recipientCount, 0) || 0}
              </h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
              <h3 className="text-2xl font-bold">{messages?.filter(m => m.status === 'scheduled').length || 0}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border rounded-md flex-1 overflow-auto bg-card">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Target Audience</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                </TableRow>
              ))
            ) : messages?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  No message campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              messages?.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    <div className="font-medium">{msg.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                      {msg.content}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{msg.recipientType?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-right font-medium">{msg.recipientCount}</TableCell>
                  <TableCell>{getStatusBadge(msg.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {msg.sentAt ? format(new Date(msg.sentAt), 'MMM d, yyyy h:mm a') : 
                     msg.scheduledAt ? `Scheduled: ${format(new Date(msg.scheduledAt), 'MMM d, h:mm a')}` : '-'}
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
