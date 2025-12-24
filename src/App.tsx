import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequireAuth } from "@/components/layout/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Shared from "./pages/Shared";
import Starred from "./pages/Starred";
import CloudConnect from "./pages/CloudConnect";
import QuantumNotebook from "./pages/QuantumNotebook";
import Docs from "./pages/Docs";
import Simulations from "./pages/Simulations";
import SimulationWorkspace from "./pages/SimulationWorkspace";
import Settings from "./pages/Settings";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/docs" element={<Docs />} />

              {/* Protected routes */}
              <Route
                element={
                  <RequireAuth>
                    <DashboardLayout />
                  </RequireAuth>
                }
              >
                <Route path="/home" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/shared" element={<Shared />} />
                <Route path="/starred" element={<Starred />} />
                <Route path="/cloud-connect" element={<CloudConnect />} />
                <Route path="/notebook" element={<QuantumNotebook />} />
                <Route path="/simulations" element={<Simulations />} />
                <Route path="/simulation/:id" element={<SimulationWorkspace />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/account" element={<Account />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
