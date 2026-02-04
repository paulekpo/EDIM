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
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">🎡</div>
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
