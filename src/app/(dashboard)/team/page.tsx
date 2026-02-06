'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  MoreHorizontal,
  Crown,
  User,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  Key,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUsers, useCreateUser, useUpdateUser, useRemoveUser, type User as UserType } from '@/hooks/use-users';
import { useSession } from 'next-auth/react';

export default function TeamPage() {
  const { data: session } = useSession();
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const removeUser = useRemoveUser();

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'USER' | 'READWRITE' | 'ADMIN'>('USER');
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<'USER' | 'READWRITE' | 'ADMIN'>('USER');
  const [editUserPassword, setEditUserPassword] = useState('');

  // Current user's role
  const currentUserRole = users?.find(u => u.email === session?.user?.email)?.role;
  const isAdmin = currentUserRole === 'ADMIN';

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'READWRITE':
        return <Pencil className="h-4 w-4 text-blue-500" />;
      case 'USER':
        return <Eye className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Admin</Badge>;
      case 'READWRITE':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Read/Write</Badge>;
      case 'USER':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">User</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateUser = async () => {
    try {
      await createUser.mutateAsync({
        email: newUserEmail,
        name: newUserName,
        password: newUserPassword || undefined,
        role: newUserRole,
      });
      setShowCreateDialog(false);
      resetCreateForm();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await updateUser.mutateAsync({
        id: selectedUser.id,
        data: {
          name: editUserName || undefined,
          role: editUserRole,
          password: editUserPassword || undefined,
        },
      });
      setShowEditDialog(false);
      setSelectedUser(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUser) return;
    try {
      await removeUser.mutateAsync(selectedUser.id);
      setShowDeleteDialog(false);
      setSelectedUser(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const resetCreateForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('USER');
  };

  const openEditDialog = (user: UserType) => {
    setSelectedUser(user);
    setEditUserName(user.name || '');
    setEditUserRole(user.role);
    setEditUserPassword('');
    setShowEditDialog(true);
  };

  const openDeleteDialog = (user: UserType) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // Stats
  const adminCount = users?.filter((m) => m.role === 'ADMIN').length || 0;
  const readwriteCount = users?.filter((m) => m.role === 'READWRITE').length || 0;
  const userCount = users?.filter((m) => m.role === 'USER').length || 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-12 mt-1" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full mt-4 first:mt-0" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load team members: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage team members and their access levels
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Members</CardDescription>
            <CardTitle className="text-2xl">{users?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Crown className="h-4 w-4 text-yellow-500" />
              Admins
            </CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{adminCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Pencil className="h-4 w-4 text-blue-500" />
              Read/Write
            </CardDescription>
            <CardTitle className="text-2xl text-blue-600">{readwriteCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Eye className="h-4 w-4 text-green-500" />
              Read Only
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{userCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Team List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>People with access to this organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.image || undefined} />
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name || 'Unnamed User'}</span>
                      {getRoleBadge(member.role)}
                      {member.email === session?.user?.email && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <Mail className="h-3 w-3" />
                      <span>{member.email}</span>
                      <span>•</span>
                      <span>Joined {formatDate(member.createdAt)}</span>
                      {!member.emailVerified && (
                        <>
                          <span>•</span>
                          <span className="text-yellow-600">Pending verification</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleIcon(member.role)}
                  {isAdmin && member.email !== session?.user?.email && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Member
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                          <Key className="h-4 w-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => openDeleteDialog(member)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
            {users?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No team members found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>Understanding role-based access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Admin</span>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Full organization control</li>
                <li>• Manage team members</li>
                <li>• Configure integrations</li>
                <li>• All permissions</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Read/Write</span>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Create & edit resources</li>
                <li>• Upload files to S3</li>
                <li>• Trigger deployments</li>
                <li>• View all data</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-green-500" />
                <span className="font-medium">User (Read Only)</span>
              </div>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• View dashboards</li>
                <li>• Download files</li>
                <li>• View deployments</li>
                <li>• View monitoring</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to your organization. They will receive an email invitation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                placeholder="Set initial password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                If set, the user can log in immediately with credentials
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as typeof newUserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User (Read Only)</SelectItem>
                  <SelectItem value="READWRITE">Read/Write</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createUser.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{(createUser.error as Error).message}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending || !newUserEmail || !newUserName}>
              {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update member details and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedUser?.image || undefined} />
                <AvatarFallback>{getInitials(selectedUser?.name || null)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser?.name}</p>
                <p className="text-sm text-gray-500">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as typeof editUserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User (Read Only)</SelectItem>
                  <SelectItem value="READWRITE">Read/Write</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPassword">New Password (optional)</Label>
              <Input
                id="editPassword"
                type="password"
                placeholder="Leave empty to keep current"
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
              />
            </div>
            {updateUser.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{(updateUser.error as Error).message}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedUser?.name || selectedUser?.email} from the organization?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {removeUser.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{(removeUser.error as Error).message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveUser} disabled={removeUser.isPending}>
              {removeUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
