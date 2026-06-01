import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AuraLogo } from "@/components/aura-logo";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: session, isLoading: sessionLoading } = useQuery<{ user: { username: string } } | null>({
    queryKey: ["/api/admin/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (session?.user) {
      navigate("/admin");
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/admin/login", { username, password });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      navigate("/admin");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Skeleton className="w-full max-w-sm h-80 rounded-md" />
      </div>
    );
  }

  if (session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <AuraLogo variant="stacked" className="mx-auto mb-4 text-foreground" showTagline={true} />
          <h1 className="text-lg font-bold" data-testid="text-admin-login-title">Admin Panel</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to manage products</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="input-admin-username"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-admin-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-admin-login">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
