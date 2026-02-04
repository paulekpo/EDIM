import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Users, Lightbulb, Trophy, ArrowLeft, Shield, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import type { User } from "@shared/models/auth";

interface AdminStats {
  totalUsers: number;
  totalIdeas: number;
  totalCompletedIdeas: number;
  usersByTier: { tier: string; count: number }[];
}

export default function AdminDashboard() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/admin`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Admin Status Updated",
        description: "User admin status has been changed.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update admin status.",
      });
    },
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "amateur":
        return "bg-blue-500";
      case "professional":
        return "bg-purple-500";
      case "expert":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  if (statsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-users">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-ideas">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ideas</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalIdeas ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-completed">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCompletedIdeas ?? 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-completion-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalIdeas 
                  ? Math.round((stats.totalCompletedIdeas / stats.totalIdeas) * 100) 
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card data-testid="card-tier-distribution">
            <CardHeader>
              <CardTitle className="text-lg">Users by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {stats?.usersByTier.map((tier) => (
                  <Badge 
                    key={tier.tier} 
                    className={`${getTierColor(tier.tier)} text-white px-3 py-1`}
                  >
                    {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}: {tier.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card data-testid="card-users-list">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users?.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`row-user-${user.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.profileImageUrl ?? undefined} />
                        <AvatarFallback>
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.firstName} {user.lastName}
                          {user.isAdmin && (
                            <Shield className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`${getTierColor(user.currentTier)} text-white`}>
                        {user.currentTier}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Admin</span>
                        <Switch
                          checked={user.isAdmin}
                          onCheckedChange={(checked) =>
                            toggleAdminMutation.mutate({ userId: user.id, isAdmin: checked })
                          }
                          disabled={toggleAdminMutation.isPending}
                          data-testid={`switch-admin-${user.id}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(!users || users.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No users found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
