import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mail, Trophy, Lightbulb, Target, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ProgressData {
  currentTier: "amateur" | "professional" | "expert";
  tierProgress: number;
  completedInTier: number;
  threshold: number;
  nextTier: string | null;
  isMaxTier: boolean;
}

interface IdeaData {
  id: string;
  title: string;
  status: string;
}

export default function ProfilePage() {
  const { user, isLoading: userLoading } = useAuth();

  const { data: progress } = useQuery<ProgressData>({
    queryKey: ["/api/progress"],
  });

  const { data: ideas = [] } = useQuery<IdeaData[]>({
    queryKey: ["/api/ideas"],
  });

  const completedIdeas = ideas.filter(i => i.status === "completed").length;
  const activeIdeas = ideas.filter(i => i.status === "in_progress").length;
  const totalIdeas = ideas.length;

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.[0] || "";
    const last = lastName?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case "amateur": return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "professional": return "bg-purple-500/10 text-purple-600 border-purple-200";
      case "expert": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      default: return "bg-muted";
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Please sign in to view your profile.</p>
            <a href="/api/login">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Profile</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = "/api/logout"}
            data-testid="button-logout"
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <Card data-testid="card-profile">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.profileImageUrl || undefined} alt="Profile" />
                <AvatarFallback className="text-2xl">
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              
              <h2 className="text-xl font-bold" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </h2>
              
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-sm" data-testid="text-user-email">{user.email}</span>
              </div>

              {progress && (
                <Badge 
                  className={`mt-4 ${getTierColor(progress.currentTier)}`}
                  data-testid="badge-tier"
                >
                  <Trophy className="w-3 h-3 mr-1" />
                  {progress.currentTier.charAt(0).toUpperCase() + progress.currentTier.slice(1)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card data-testid="card-stat-total">
            <CardContent className="pt-4 text-center">
              <Lightbulb className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{totalIdeas}</p>
              <p className="text-xs text-muted-foreground">Total Ideas</p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stat-active">
            <CardContent className="pt-4 text-center">
              <Target className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{activeIdeas}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stat-completed">
            <CardContent className="pt-4 text-center">
              <Trophy className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{completedIdeas}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {progress && (
          <Card data-testid="card-tier-progress">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Tier Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {progress.currentTier.charAt(0).toUpperCase() + progress.currentTier.slice(1)}
                  </span>
                  <span className="font-medium">
                    {progress.completedInTier} / {progress.threshold} videos
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${Math.min(progress.tierProgress, 100)}%` }}
                  />
                </div>
                {progress.nextTier && (
                  <p className="text-xs text-muted-foreground">
                    {progress.threshold - progress.completedInTier} more videos to reach {progress.nextTier}
                  </p>
                )}
                {progress.isMaxTier && (
                  <p className="text-xs text-green-600 font-medium">
                    You've reached the highest tier!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="card-account-info">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono text-xs">{user.id.slice(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
