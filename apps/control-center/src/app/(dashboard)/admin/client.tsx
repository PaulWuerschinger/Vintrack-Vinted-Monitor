"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Shield, Crown, User, Monitor, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setUserRole } from "@/actions/admin";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  _count: { monitors: number; proxy_groups: number };
};

const ROLES = [
  { value: "free", label: "Free", icon: User, color: "bg-muted text-muted-foreground" },
  { value: "premium", label: "Premium", icon: Crown, color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  { value: "admin", label: "Admin", icon: Shield, color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
] as const;

function getRoleBadge(role: string) {
  const r = ROLES.find((r) => r.value === role) ?? ROLES[0];
  return (
    <Badge className={`${r.color} text-[10px] font-semibold uppercase tracking-wide gap-1`}>
      <r.icon className="w-3 h-3" />
      {r.label}
    </Badge>
  );
}

export function AdminClient({
  users: initialUsers,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const openRoleDialog = (user: UserRow) => {
    setSelected(user);
    setPendingRole(user.role);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!selected || pendingRole === selected.role) {
      setIsOpen(false);
      return;
    }

    const prevRole = selected.role;
    setUsers((prev) =>
      prev.map((u) => (u.id === selected.id ? { ...u, role: pendingRole } : u))
    );
    setIsOpen(false);

    toast.promise(setUserRole(selected.id, pendingRole), {
      loading: "Updating role...",
      success: `${selected.name ?? "User"} is now ${pendingRole}`,
      error: () => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selected.id ? { ...u, role: prevRole } : u
          )
        );
        return "Failed to update role";
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage roles and view user statistics.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/60 px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Users
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {users.length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Premium
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">
            {users.filter((u) => u.role === "premium").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Admins
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-500 mt-1">
            {users.filter((u) => u.role === "admin").length}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Role
                </th>
                <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Monitors
                </th>
                <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Proxy Groups
                </th>
                <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                          {user.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">{getRoleBadge(user.role)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                      {user._count.monitors}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      {user._count.proxy_groups}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {user.id === currentUserId ? (
                      <span className="text-xs text-muted-foreground italic">You</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openRoleDialog(user)}
                      >
                        Change Role
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update role for <strong>{selected?.name ?? "User"}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => setPendingRole(role.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                  pendingRole === role.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <role.icon
                  className={`w-5 h-5 ${
                    pendingRole === role.value
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {role.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {role.value === "free" && "Standard access, must use own proxies"}
                    {role.value === "premium" && "Can use server proxies"}
                    {role.value === "admin" && "Full access + user management"}
                  </p>
                </div>
                {pendingRole === role.value && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
