import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Cards from "./pages/Cards";
import SettingsPage from "./pages/Settings";
import Savings from "./pages/Savings";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [checkingUsers, setCheckingUsers] = useState(true);

  useEffect(() => {
    // Check if any users exist by trying to sign in with dummy - if signup is disabled and no users exist, show setup
    const checkUsers = async () => {
      // We check if there are users by looking at a special flag in localStorage
      const setupDone = localStorage.getItem("fincontrol_setup_done");
      if (setupDone === "true") {
        setHasUsers(true);
      } else {
        setHasUsers(false);
      }
      setCheckingUsers(false);
    };
    checkUsers();
  }, [user]);

  // Mark setup as done when a user successfully logs in
  useEffect(() => {
    if (user) {
      localStorage.setItem("fincontrol_setup_done", "true");
    }
  }, [user]);

  if (loading || checkingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasUsers && !user) {
    return <Setup />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
