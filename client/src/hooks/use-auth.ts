import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { useToast } from "@/hooks/use-toast";

function getCsrfToken() {
  const match = document.cookie.match(new RegExp('(^| )X-CSRF-Token=([^;]+)'));
  return match ? match[2] : null;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return headers;
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user");

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function login(credentials: Record<string, string>): Promise<User> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Login failed");
  }

  return response.json();
}

async function register(credentials: Record<string, string>): Promise<User> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Registration failed");
  }

  return response.json();
}

async function logout(): Promise<void> {
  const response = await fetch("/api/logout", {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Logout failed");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
    onError: (error) => {
       toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
