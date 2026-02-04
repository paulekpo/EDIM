import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { IdeasWheel } from "@/components/IdeasWheel";
import { AchievementWheel } from "@/components/AchievementWheel";
import { AnalyticsUpload } from "@/components/AnalyticsUpload";
import { IdeaDetailModal } from "@/components/IdeaDetailModal";
import { ActiveProjectsList } from "@/components/ActiveProjectsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Upload, Trophy, RefreshCw, CheckCircle, Target, Lightbulb, Rocket, ArrowUp, BarChart3, LogOut, User } from "lucide-react";

interface ChecklistItemData {
  id: string;
  text: string;
  isChecked: boolean;
}

interface IdeaData {
  id: string;
  title: string;
  rationale?: string | null;
  status: string;
  checklistItems: ChecklistItemData[];
}

interface ProgressData {
  currentTier: "amateur" | "professional" | "expert";
  tierProgress: number;
  completedInTier: number;
  threshold: number;
  nextTier: string | null;
  isMaxTier: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaData | null>(null);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [activeProjectsOpen, setActiveProjectsOpen] = useState(false);
  const [lastAnalyticsImportId, setLastAnalyticsImportId] = useState<string | null>(null);

  const { data: ideas = [], isLoading: ideasLoading, error: ideasError, refetch: refetchIdeas } = useQuery<IdeaData[]>({
    queryKey: ["/api/ideas"],
  });

  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useQuery<ProgressData>({
    queryKey: ["/api/progress"],
  });

  const { data: analyticsStatus } = useQuery<{ hasAnalytics: boolean }>({
    queryKey: ["/api/analytics/exists"],
  });

  const hasAnalytics = analyticsStatus?.hasAnalytics ?? false;

  const generateIdeasMutation = useMutation({
    mutationFn: async (analyticsImportId?: string) => {
      const response = await apiRequest("POST", "/api/ideas/generate", {
        analyticsImportId,
        count: 5,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: "Ideas Generated!",
        description: "New content ideas have been added to your wheel.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate ideas. Please try again.",
        variant: "destructive",
      });
    },
  });

  const skipIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await apiRequest("PATCH", `/api/ideas/${ideaId}`, {
        status: "skipped",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: "Idea Skipped",
        description: "This idea has been moved to the skipped pile.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to skip idea. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ ideaId, items }: { ideaId: string; items: ChecklistItemData[] }) => {
      const responses = await Promise.all(
        items.map(async (item) => {
          if (item.id.startsWith("new-")) {
            return apiRequest("POST", `/api/ideas/${ideaId}/checklist`, { text: item.text });
          } else {
            await apiRequest("PATCH", `/api/checklist/${item.id}`, { 
              text: item.text,
              isChecked: item.isChecked 
            });
          }
        })
      );
      return responses;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
    },
  });

  const completeIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await apiRequest("POST", `/api/ideas/${ideaId}/complete`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      if (data.tierUp) {
        toast({
          title: "Tier Up!",
          description: `Congratulations! You've reached ${data.newTier} tier!`,
        });
      } else {
        toast({
          title: "Video Completed!",
          description: "Great work! Keep up the momentum.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete idea. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyticsSubmit = useCallback(
    async (data: { trafficSources: Record<string, number>; searchQueries: string[] }) => {
      try {
        const response = await apiRequest("POST", "/api/analytics/manual", data);
        const result = await response.json();
        setLastAnalyticsImportId(result.id);
        setAnalyticsModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/analytics/exists"] });
        toast({
          title: "Analytics Saved",
          description: "Your analytics have been saved. You can now generate ideas!",
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to save analytics. Please try again.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleSelectIdea = useCallback(
    (id: string) => {
      const idea = ideas.find((i) => i.id === id);
      if (idea) {
        setSelectedIdea(idea);
        setIdeaModalOpen(true);
      }
    },
    [ideas]
  );

  const handleSkipIdea = useCallback(
    (ideaId: string) => {
      skipIdeaMutation.mutate(ideaId);
    },
    [skipIdeaMutation]
  );

  const startTaskMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await apiRequest("PATCH", `/api/ideas/${ideaId}`, {
        status: "in_progress",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: "Task Started!",
        description: "Let's make this video happen!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartTask = useCallback(
    (ideaId: string) => {
      startTaskMutation.mutate(ideaId);
      if (selectedIdea) {
        setSelectedIdea({ ...selectedIdea, status: "in_progress" });
      }
    },
    [startTaskMutation, selectedIdea]
  );

  const handleChecklistUpdate = useCallback(
    async (ideaId: string, items: ChecklistItemData[]) => {
      await updateChecklistMutation.mutateAsync({ ideaId, items });

      const allChecked = items.length > 0 && items.every((item) => item.isChecked);
      if (allChecked) {
        await completeIdeaMutation.mutateAsync(ideaId);
      }
    },
    [updateChecklistMutation, completeIdeaMutation]
  );

  const handleGenerateIdeas = useCallback(() => {
    if (!lastAnalyticsImportId) {
      toast({
        title: "No analytics data",
        description: "Please import your channel or page analytics first before generating ideas.",
        variant: "destructive",
      });
      return;
    }
    generateIdeasMutation.mutate(lastAnalyticsImportId);
  }, [generateIdeasMutation, lastAnalyticsImportId, toast]);

  const activeIdeas = ideas.filter((i) => i.status !== "completed" && i.status !== "skipped");

  const tierProgress = progress
    ? Math.round((progress.completedInTier / progress.threshold) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col bg-background"
      data-testid="dashboard-page"
    >
      <header className="border-b py-3 px-4 sm:py-4 sm:px-6 bg-gradient-to-r from-purple-600/10 via-pink-500/10 to-orange-500/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
              🧠
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent" data-testid="app-title">
                EDIM
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground" data-testid="app-subtitle">
                Entertainment Data to Idea Management
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/completed">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm" data-testid="nav-completed">
                <Trophy className="w-4 h-4 mr-1 sm:mr-2 text-yellow-500" />
                <span className="hidden sm:inline">Completed</span>
              </Button>
            </Link>
            {user && (
              <div className="flex items-center gap-2">
                {user.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full"
                    data-testid="user-avatar"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <a href="/api/logout">
                  <Button variant="ghost" size="sm" data-testid="button-logout">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </a>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card data-testid="ideas-section" className="overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 space-y-0 pb-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <span className="text-xl">🎡</span>
                  Ideas Wheel
                </CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAnalyticsModalOpen(true)}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                    data-testid="upload-analytics-btn"
                  >
                    <span className="mr-1 sm:mr-2">📊</span>
                    Import Analytics
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleGenerateIdeas}
                    disabled={generateIdeasMutation.isPending}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-purple-500 to-pink-500 text-xs sm:text-sm"
                    data-testid="generate-ideas-btn"
                  >
                    {generateIdeasMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1 sm:mr-2" />
                    )}
                    Generate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ideasLoading ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <Skeleton className="w-48 h-48 rounded-full" />
                    <Skeleton className="w-32 h-4 mt-4" />
                  </div>
                ) : ideasError ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-destructive mb-4">Failed to load ideas</p>
                    <Button onClick={() => refetchIdeas()} data-testid="retry-ideas-btn">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <IdeasWheel
                    ideas={activeIdeas.map((idea) => ({
                      id: idea.id,
                      title: idea.title,
                      status: idea.status as "unstarted" | "in_progress" | "skipped" | "completed",
                    }))}
                    onSelectIdea={handleSelectIdea}
                    onUpload={() => setAnalyticsModalOpen(true)}
                    onSpinBlocked={() => {
                      toast({
                        title: "Import analytics first",
                        description: "Please import your channel or page analytics before spinning the wheel.",
                        variant: "destructive",
                      });
                    }}
                    hasAnalytics={hasAnalytics}
                    disabled={generateIdeasMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>

            <Card data-testid="achievement-section" className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Achievement Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {progressLoading ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <Skeleton className="w-48 h-48 rounded-full" />
                    <Skeleton className="w-24 h-4 mt-4" />
                  </div>
                ) : progress ? (
                  <AchievementWheel
                    progress={tierProgress}
                    tier={progress.currentTier}
                    videosCompleted={progress.completedInTier}
                    videosRequired={progress.threshold}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-muted-foreground mb-4">No progress data available</p>
                    <Button onClick={() => refetchProgress()} data-testid="retry-progress-btn">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {activeIdeas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 sm:mt-6"
            >
              <Card className="overflow-hidden">
                <CardHeader className="py-3 bg-gradient-to-r from-green-500/5 to-teal-500/5">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-500" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <button
                      onClick={() => setActiveProjectsOpen(true)}
                      className="text-center p-3 sm:p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 cursor-pointer transition-all active:scale-95"
                      data-testid="stat-active-ideas-btn"
                    >
                      <p className="text-xl sm:text-2xl font-bold text-blue-600" data-testid="stat-active-ideas">
                        {activeIdeas.length}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Active
                      </p>
                    </button>
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
                      <p className="text-xl sm:text-2xl font-bold text-green-600" data-testid="stat-in-progress">
                        {activeIdeas.filter((i) => i.status === "in_progress").length}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Rocket className="w-3 h-3" /> In Progress
                      </p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20">
                      <p className="text-xl sm:text-2xl font-bold text-purple-600" data-testid="stat-completed-tier">
                        {progress?.completedInTier || 0}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Done
                      </p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20">
                      <p className="text-xl sm:text-2xl font-bold text-orange-600" data-testid="stat-to-next-tier">
                        {progress ? progress.threshold - progress.completedInTier : 0}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <ArrowUp className="w-3 h-3" /> To Level Up
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      <AnalyticsUpload
        open={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
        onSubmit={handleAnalyticsSubmit}
        isProcessing={false}
      />

      <IdeaDetailModal
        idea={selectedIdea}
        open={ideaModalOpen}
        onClose={() => {
          setIdeaModalOpen(false);
          setSelectedIdea(null);
        }}
        onSkip={handleSkipIdea}
        onStartTask={handleStartTask}
        onComplete={(ideaId) => completeIdeaMutation.mutate(ideaId)}
        onChecklistUpdate={handleChecklistUpdate}
      />

      <ActiveProjectsList
        ideas={activeIdeas}
        open={activeProjectsOpen}
        onClose={() => setActiveProjectsOpen(false)}
        onSelectIdea={handleSelectIdea}
      />
    </motion.div>
  );
}
