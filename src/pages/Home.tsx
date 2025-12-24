import { useNavigate } from "react-router-dom";
import { 
  Clock, 
  FileCode, 
  BookOpen, 
  Cpu, 
  Cloud, 
  Plus,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const recentWorks = [
  {
    id: 1,
    title: "Quantum Teleportation Circuit",
    type: "notebook",
    path: "/notebook",
    lastEdited: "2 hours ago",
    icon: FileCode,
  },
  {
    id: 2,
    title: "Grover's Algorithm Implementation",
    type: "cloud-connect",
    path: "/cloud-connect",
    lastEdited: "Yesterday",
    icon: Cloud,
  },
  {
    id: 3,
    title: "Quantum Error Correction Notes",
    type: "docs",
    path: "/docs",
    lastEdited: "3 days ago",
    icon: BookOpen,
  },
  {
    id: 4,
    title: "Bell State Simulation",
    type: "simulation",
    path: "/simulations",
    lastEdited: "1 week ago",
    icon: Cpu,
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-muted-foreground">
          Continue where you left off or start something new
        </p>
      </div>

      {/* Recent Works */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Recent Works
          </h2>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
            View all
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {recentWorks.map((work) => (
            <Card 
              key={work.id}
              className="cursor-pointer hover:bg-secondary/50 transition-all duration-200 group"
              onClick={() => navigate(work.path)}
            >
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                    <work.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {work.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {work.lastEdited}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create New */}
      <Card className="mt-8 gradient-border">
        <CardContent className="flex items-center justify-center p-12">
          <Button 
            variant="outline" 
            size="lg" 
            className="gap-2"
            onClick={() => navigate("/notebook")}
          >
            <Plus className="w-5 h-5" />
            Create New Project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
