import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit, Trash2, Eye, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

const couponFormSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().min(1),
  currency: z.string().optional(),
  minPurchaseAmount: z.coerce.number().optional(),
  maxDiscountAmount: z.coerce.number().optional(),
  applicablePlans: z.array(z.string()).optional(),
  applicableCurrencies: z.array(z.string()).optional(),
  maxUses: z.coerce.number().optional(),
  maxUsesPerUser: z.coerce.number().default(1),
  isActive: z.boolean().default(true),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
});

type CouponFormData = z.infer<typeof couponFormSchema>;

export default function AdminCoupons() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  const { data: couponsData, isLoading } = useQuery({
    queryKey: ["/api/admin/coupons"],
  });

  const form = useForm<CouponFormData>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: "",
      discountType: "percentage",
      discountValue: 10,
      maxUsesPerUser: 1,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      return await apiRequest("POST", "/api/admin/coupons", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Coupon created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CouponFormData> }) => {
      return await apiRequest("PATCH", `/api/admin/coupons/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Coupon updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setEditingCoupon(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update coupon",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/coupons/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Coupon deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete coupon",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CouponFormData) => {
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setIsCreateDialogOpen(true);
    form.reset({
      code: coupon.code,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      currency: coupon.currency || "",
      minPurchaseAmount: coupon.minPurchaseAmount || undefined,
      maxDiscountAmount: coupon.maxDiscountAmount || undefined,
      maxUses: coupon.maxUses || undefined,
      maxUsesPerUser: coupon.maxUsesPerUser || 1,
      isActive: coupon.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const coupons = (couponsData as any)?.coupons || [];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            Coupon Management
          </h1>
          <p className="text-muted-foreground">
            Create and manage discount coupons for subscriptions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCoupon(null);
            form.reset();
            setIsCreateDialogOpen(true);
          }}
          data-testid="button-create-coupon"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      <Card data-testid="card-coupons-table">
        <CardHeader>
          <CardTitle>Active Coupons</CardTitle>
          <CardDescription>Manage discount codes and promotions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No coupons found. Create your first coupon to get started.
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon: any) => (
                  <TableRow key={coupon.id} data-testid={`row-coupon-${coupon.code}`}>
                    <TableCell className="font-mono font-semibold">{coupon.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {coupon.discountType === "percentage" ? "%" : "Fixed"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coupon.discountType === "percentage" 
                        ? `${coupon.discountValue}%`
                        : `${coupon.currency} ${(coupon.discountValue / 100).toFixed(2)}`
                      }
                    </TableCell>
                    <TableCell>
                      {coupon.usageCount}/{coupon.maxUses || "∞"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={coupon.isActive ? "default" : "secondary"}>
                        {coupon.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(coupon)}
                          data-testid={`button-edit-${coupon.code}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(coupon.id)}
                          data-testid={`button-delete-${coupon.code}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setEditingCoupon(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-coupon-form">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? "Update coupon details" : "Create a new discount coupon for subscriptions"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coupon Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="SAVE20" className="font-mono" data-testid="input-coupon-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="20% off all plans" data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          data-testid="input-discount-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Total Uses (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value || ""}
                          placeholder="Unlimited"
                          data-testid="input-max-uses"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxUsesPerUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Uses Per User</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          data-testid="input-max-uses-per-user"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable or disable this coupon
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-coupon"
                >
                  {editingCoupon ? "Update Coupon" : "Create Coupon"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
