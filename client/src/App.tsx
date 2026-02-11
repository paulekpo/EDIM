import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/Dashboard";
import CompletedProjects from "@/pages/CompletedProjects";
import AdminDashboard from "@/pages/AdminDashboard";
import ProfilePage from "@/pages/ProfilePage";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Lightbulb } from "lucide-react";

function AuthenticatedRouter() {
  return (
    <AnimatePresence mode="wait">
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/completed" component={CompletedProjects} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-container">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse" data-testid="loading-icon">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <Skeleton className="h-4 w-32" data-testid="loading-skeleton" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
        <InstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
