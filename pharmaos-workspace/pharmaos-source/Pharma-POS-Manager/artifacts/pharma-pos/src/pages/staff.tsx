import { useState } from "react";
import { useCreateStaffMember, useListStaff, useUpdateStaffMember, getListStaffQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, UserPlus, Users } from "lucide-react";

const emptyForm = { name: "", email: "", phone: "", password: "", role: "cashier" as "cashier" | "manager" };
type Module = { key: string; label: string };
type StaffMember = { id: number; name: string; email: string; phone: string; role: "pharmacy_owner" | "manager" | "cashier"; isActive: boolean };
type PermissionEditor = { user: StaffMember; modules: Module[]; enabledModules: string[]; pharmacyModules: string[] };

export default function Staff() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [permissions, setPermissions] = useState<PermissionEditor | null>(null);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const { data: staff, isLoading } = useListStaff();
  const createStaff = useCreateStaffMember();
  const updateStaff = useUpdateStaffMember();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    createStaff.mutate({ data: form }, {
      onSuccess: () => {
        setForm(emptyForm);
        refresh();
        toast({ title: "Staff member created" });
      },
      onError: (error) => toast({ title: error.message, variant: "destructive" }),
    });
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updateStaff.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: refresh,
      onError: (error) => toast({ title: error.message, variant: "destructive" }),
    });
  };

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Request failed");
    return payload;
  };

  const canManage = (member: StaffMember) => user?.role === "pharmacy_owner" ? ["manager", "cashier"].includes(member.role) : member.role === "cashier";

  const openPermissions = async (member: StaffMember) => {
    try {
      const payload = await request(`/api/staff/${member.id}/permissions`);
      setPermissions({ user: member, modules: payload.modules, enabledModules: payload.enabledModules, pharmacyModules: payload.pharmacyModules });
    } catch (error: any) {
      toast({ title: error.message || "Unable to load permissions", variant: "destructive" });
    }
  };

  const savePermissions = async () => {
    if (!permissions) return;
    setPermissionsBusy(true);
    try {
      await request(`/api/staff/${permissions.user.id}/permissions`, { method: "PUT", body: JSON.stringify({ modules: permissions.enabledModules }) });
      setPermissions(null);
      toast({ title: "Permissions saved" });
    } catch (error: any) {
      toast({ title: error.message || "Unable to save permissions", variant: "destructive" });
    } finally {
      setPermissionsBusy(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Pharmacy Staff</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage the people who can operate this pharmacy.</p>
      </div>

      <form onSubmit={submit} className="border rounded-lg bg-white p-4 grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2"><label className="text-xs font-semibold">Name</label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="text-xs font-semibold">Phone</label><Input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="text-xs font-semibold">Email</label><Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="text-xs font-semibold">Role</label><Select value={form.role} onValueChange={(role: "cashier" | "manager") => setForm({ ...form, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{user?.role === "pharmacy_owner" && <SelectItem value="manager">Manager</SelectItem>}<SelectItem value="cashier">Cashier</SelectItem></SelectContent></Select></div>
        <div><label className="text-xs font-semibold">Temporary password</label><Input type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
        <Button className="md:col-span-6 md:w-fit" disabled={createStaff.isPending}><UserPlus className="h-4 w-4 mr-2" /> Add staff member</Button>
      </form>

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr><th className="text-left p-3">Staff member</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Role</th><th className="text-left p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading staff...</td></tr> : staff?.map(member => (
              <tr key={member.id} className="border-t">
                <td className="p-3"><p className="font-semibold">{member.name}</p><p className="text-xs text-muted-foreground">{member.email}</p></td>
                <td className="p-3">{member.phone}</td>
                <td className="p-3 capitalize">{member.role.replace("_", " ")}</td>
                <td className="p-3"><Badge variant={member.isActive ? "default" : "secondary"}>{member.isActive ? "Active" : "Disabled"}</Badge></td>
                <td className="p-3 text-right"><div className="flex justify-end gap-2">{canManage(member) && <Button size="sm" variant="outline" onClick={() => void openPermissions(member)}><ShieldCheck className="h-4 w-4 mr-1" /> Permissions</Button>}{canManage(member) && <Button size="sm" variant="outline" onClick={() => toggleActive(member.id, member.isActive)}>{member.isActive ? "Disable" : "Enable"}</Button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(permissions)} onOpenChange={open => !open && setPermissions(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Permissions for {permissions?.user.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Access can only be granted to modules enabled for this pharmacy.</p>
          <div className="grid sm:grid-cols-2 gap-2 py-2">{permissions?.modules.map(module => {
            const available = permissions.pharmacyModules.includes(module.key);
            const checked = permissions.enabledModules.includes(module.key);
            return <label key={module.key} className={`rounded-lg border p-3 flex items-center gap-3 ${available ? "" : "opacity-40"}`}><input type="checkbox" disabled={!available} checked={checked} onChange={() => setPermissions(current => current ? { ...current, enabledModules: checked ? current.enabledModules.filter(key => key !== module.key) : [...current.enabledModules, module.key] } : current)} /><span>{module.label}</span>{!available && <span className="ml-auto text-[10px] uppercase">Pharmacy disabled</span>}</label>;
          })}</div>
          <Button disabled={permissionsBusy} onClick={() => void savePermissions()}>{permissionsBusy ? "Saving..." : "Save permissions"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
