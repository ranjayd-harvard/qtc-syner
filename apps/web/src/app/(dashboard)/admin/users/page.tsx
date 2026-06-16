'use client';

import { useState } from 'react';
import { UserPlus, Trash2, Loader2, Eye, EyeOff, ShieldCheck, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUsers, useAddUser, useDeleteUser } from '@/hooks/useUsers';
import type { UserSummary } from '@/models/User';

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [setPassword, setSetPassword] = useState(false);
  const [password, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const addUser = useAddUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addUser.mutate(
      { name, email, ...(setPassword && password ? { password } : {}) },
      { onSuccess: onClose }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="add-name">Name</Label>
        <Input
          id="add-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="add-email">Email</Label>
        <Input
          id="add-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded"
            checked={setPassword}
            onChange={(e) => setSetPassword(e.target.checked)}
          />
          <span className="text-sm font-medium text-slate-700">Set a password</span>
          <span className="text-xs text-slate-400">(leave off for Google-only access)</span>
        </label>
        {setPassword && (
          <div className="grid gap-2">
            <Label htmlFor="add-password">Password</Label>
            <div className="relative">
              <Input
                id="add-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Min. 8 characters"
                minLength={8}
                required={setPassword}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={addUser.isPending}>
          {addUser.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Adding…</>
          ) : (
            <><UserPlus className="w-4 h-4 mr-2" />Add User</>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteUserDialog({ user }: { user: UserSummary }) {
  const [open, setOpen] = useState(false);
  const deleteUser = useDeleteUser();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User</DialogTitle>
          <DialogDescription>
            Remove <strong>{user.name}</strong> ({user.email})? They will no longer be able to
            sign in. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteUser.isPending}
            onClick={() => deleteUser.mutate(user.id, { onSuccess: () => setOpen(false) })}
          >
            {deleteUser.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''} — only listed emails can sign in
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>
                Add an email to the allowlist. Without a password, they can only sign in via
                Google.
              </DialogDescription>
            </DialogHeader>
            <AddUserDialog onClose={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Auth</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                  No users yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-slate-500">{user.email}</TableCell>
                  <TableCell>
                    {user.hasPassword ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Key className="w-3 h-3" />
                          Password
                        </Badge>
                        <Badge variant="secondary" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <ShieldCheck className="w-3 h-3" />
                          Google
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <ShieldCheck className="w-3 h-3" />
                        Google only
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DeleteUserDialog user={user} />
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
