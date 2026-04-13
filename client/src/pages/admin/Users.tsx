import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Crown, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  tier: string;
  createdAt: string;
}

interface Subscription {
  id: string;
  userId: string;
  plan: string;
  currency: string;
  status: string;
  validUntil: string | null;
}

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newTier, setNewTier] = useState<string>("");
  const { toast } = useToast();

  const { data: usersResponse, isLoading } = useQuery<{users: User[]}>({
    queryKey: ["/api/admin/users"],
  });

  const { data: subscriptionsResponse } = useQuery<{subscriptions: Subscription[]}>({
    queryKey: ["/api/admin/subscriptions"],
  });
  
  const usersData = usersResponse?.users || [];
  const subscriptionsData = subscriptionsResponse?.subscriptions || [];

  const updateTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/tier`, { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User tier updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user tier",
        variant: "destructive",
      });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/toggle-admin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Admin status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const users = usersData || [];
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserSubscription = (userId: string) => {
    return subscriptionsData?.find((sub) => sub.userId === userId);
  };

  const handleEditTier = (user: User) => {
    setSelectedUser(user);
    setNewTier(user.tier);
  };

  const handleSaveTier = () => {
    if (selectedUser) {
      updateTierMutation.mutate({ userId: selectedUser.id, tier: newTier });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-muted-foreground">
          Manage user accounts, subscriptions, and admin privileges
        </p>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const subscription = getUserSubscription(user.id);
                return (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.tier === 'enterprise' ? 'default' : 'secondary'}>
                        {user.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription ? (
                        <div className="text-sm">
                          <div className="font-medium">{subscription.plan}</div>
                          <div className="text-muted-foreground">
                            {subscription.status === 'active' ? (
                              subscription.validUntil ? (
                                `Until ${format(new Date(subscription.validUntil), 'MMM dd, yyyy')}`
                              ) : (
                                'Active'
                              )
                            ) : (
                              subscription.status
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No subscription</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isAdmin && <Crown className="h-4 w-4 text-amber-500" />}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTier(user)}
                        data-testid={`button-edit-tier-${user.id}`}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit Tier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAdminMutation.mutate(user.id)}
                        data-testid={`button-toggle-admin-${user.id}`}
                      >
                        {user.isAdmin ? <User className="h-4 w-4 mr-1" /> : <Crown className="h-4 w-4 mr-1" />}
                        {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Tier Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent data-testid="dialog-edit-tier">
          <DialogHeader>
            <DialogTitle>Edit User Tier</DialogTitle>
            <DialogDescription>
              Change the subscription tier for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tier</label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger data-testid="select-tier">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="payg">Pay-as-you-go</SelectItem>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedUser(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTier}
              disabled={updateTierMutation.isPending}
              data-testid="button-save-tier"
            >
              {updateTierMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
