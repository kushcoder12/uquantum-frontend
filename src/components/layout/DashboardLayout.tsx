import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { 
  Bot, 
  Settings, 
  User, 
  LayoutGrid, 
  Home, 
  Search, 
  Users, 
  Star, 
  Cloud, 
  BookOpen, 
  FileText, 
  Cpu, 
  ChevronDown
} from "lucide-react";
import { AIAssistant } from "./AIAssistant";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: Users, label: "Shared with me", path: "/shared" },
  { icon: Star, label: "Starred", path: "/starred" },
];

const toolsNavItems = [
  { icon: Cloud, label: "Quantum Cloud Multi-Connect", path: "/cloud-connect" },
  { icon: BookOpen, label: "Quantum Notebook", path: "/notebook" },
  { icon: FileText, label: "Docs", path: "/docs" },
  { icon: Cpu, label: "Simulations", path: "/simulations" },
];

export function DashboardLayout() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const logo = theme === 'dark' ? logoDark : logoLight;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 w-full h-16 z-50 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            <img src={logo} alt="UQuantum Labs" className="w-9 h-9 rounded-xl shadow-sm" />
            <span className="hidden md:block text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 select-none tracking-tight">
              UQuantum Labs
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-2 px-3 rounded-lg hover:bg-accent transition-all font-medium text-muted-foreground hover:text-foreground">
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm font-semibold">Navigation</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-2 rounded-xl shadow-2xl border-border/60">
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Main
              </DropdownMenuLabel>
              {mainNavItems.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                      location.pathname === item.path ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-accent"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", location.pathname === item.path ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                </DropdownMenuItem>
              ))}
              
              <DropdownMenuSeparator className="my-2" />
              
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Quantum Tools
              </DropdownMenuLabel>
              {toolsNavItems.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                      location.pathname === item.path ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-accent"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", location.pathname === item.path ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-4 border-r border-border/50 mr-2">
            <NavLink to="/settings" className={({ isActive }) => cn(
              "p-2 rounded-lg transition-all hover:bg-accent",
              isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
            )}>
              <Settings className="w-5 h-5" />
            </NavLink>
            <NavLink to="/account" className={({ isActive }) => cn(
              "p-2 rounded-lg transition-all hover:bg-accent",
              isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
            )}>
              <User className="w-5 h-5" />
            </NavLink>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAIOpen(!isAIOpen)}
                className={cn(
                  "h-9 w-9 rounded-lg transition-all",
                  isAIOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                disabled={!isAuthenticated}
              >
                <Bot className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{!isAuthenticated ? 'Login required' : (isAIOpen ? 'Close' : 'Open') + ' AI Assistant'}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-1 pt-16 relative">
        <main className={cn(
          "flex-1 w-full min-h-[calc(100vh-4rem)] transition-all duration-300 p-6",
          isAIOpen ? "mr-[400px]" : "mr-0"
        )}>
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* AI Assistant Panel */}
        <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      </div>
    </div>
  );
}
