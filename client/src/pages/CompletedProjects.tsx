import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trophy, Calendar, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";

interface CompletedIdea {
  id: string;
  title: string;
  tierCompletedIn: string | null;
  completionNumber: number | null;
  completedAt: string | null;
}

type Tier = "amateur" | "professional" | "expert";

const TIER_COLORS: Record<Tier, string> = {
  amateur: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  professional: "bg-slate-500/20 text-slate-700 dark:text-slate-400",
  expert: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
};

const TIER_NAMES: Record<Tier, string> = {
  amateur: "Amateur",
  professional: "Professional",
  expert: "Expert",
};

const ITEMS_PER_PAGE = 10;
const EXPANDED_ITEMS = 30;

function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CompletedProjects() {
  const [showExpanded, setShowExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const { data: completedIdeas = [], isLoading, error, refetch } = useQuery<CompletedIdea[]>({
    queryKey: ["/api/ideas", "completed"],
    queryFn: async () => {
      const res = await fetch("/api/ideas?status=completed", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch completed ideas");
      return res.json();
    },
  });

  const itemsToShow = showExpanded ? EXPANDED_ITEMS : ITEMS_PER_PAGE;
  const totalPages = Math.ceil(completedIdeas.length / itemsToShow);
  const needsPagination = completedIdeas.length > EXPANDED_ITEMS;

  const displayedIdeas = useMemo(() => {
    const start = page * itemsToShow;
    const end = start + itemsToShow;
    return completedIdeas.slice(start, end);
  }, [completedIdeas, page, itemsToShow]);

  const canShowMore = completedIdeas.length > ITEMS_PER_PAGE && !showExpanded && page === 0;
  const canShowLess = showExpanded && completedIdeas.length <= EXPANDED_ITEMS;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col bg-background"
      data-testid="completed-projects-page"
    >
      <header className="border-b py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
                <Trophy className="w-6 h-6 text-primary" />
                Completed Projects
              </h1>
              <p className="text-sm text-muted-foreground">
                Your archive of finished video ideas
              </p>
            </div>
          </div>
          <Badge variant="secondary" data-testid="total-completed">
            {completedIdeas.length} completed
          </Badge>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="grid gap-4" data-testid="loading-skeleton">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/4" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-destructive mb-4">Failed to load completed projects</p>
                <Button onClick={() => refetch()} data-testid="retry-btn">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : completedIdeas.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h2 className="text-lg font-semibold mb-2">No completed projects yet</h2>
                <p className="text-muted-foreground mb-6">
                  Complete your first video idea to see it here!
                </p>
                <Link href="/">
                  <Button data-testid="go-to-dashboard">
                    Go to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                <div className="grid gap-4">
                  {displayedIdeas.map((idea, index) => (
                    <motion.div
                      key={idea.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card
                        className="hover-elevate"
                        data-testid={`completed-card-${idea.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <h3
                                className="font-medium mb-2"
                                data-testid={`card-title-${idea.id}`}
                              >
                                {idea.title}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                {idea.completionNumber && idea.tierCompletedIn && (
                                  <span data-testid={`card-completion-${idea.id}`}>
                                    #{idea.completionNumber} in{" "}
                                    {TIER_NAMES[idea.tierCompletedIn as Tier] || idea.tierCompletedIn} tier
                                  </span>
                                )}
                                {idea.completedAt && (
                                  <span
                                    className="flex items-center gap-1"
                                    data-testid={`card-date-${idea.id}`}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(idea.completedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {idea.tierCompletedIn && (
                              <Badge
                                variant="secondary"
                                className={
                                  TIER_COLORS[idea.tierCompletedIn as Tier] || ""
                                }
                                data-testid={`card-tier-badge-${idea.id}`}
                              >
                                {TIER_NAMES[idea.tierCompletedIn as Tier] || idea.tierCompletedIn}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>

              <div className="mt-6 flex items-center justify-center gap-4">
                {canShowMore && (
                  <Button
                    variant="outline"
                    onClick={() => setShowExpanded(true)}
                    data-testid="show-more-btn"
                  >
                    Show More
                  </Button>
                )}

                {canShowLess && (
                  <Button
                    variant="outline"
                    onClick={() => setShowExpanded(false)}
                    data-testid="show-less-btn"
                  >
                    Show Less
                  </Button>
                )}

                {needsPagination && showExpanded && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      data-testid="prev-page-btn"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      data-testid="next-page-btn"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </motion.div>
  );
}
