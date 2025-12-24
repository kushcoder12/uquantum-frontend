import { Star, FileCode, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const starredItems = [
  {
    id: 1,
    title: "Quantum Teleportation Circuit",
    type: "notebook",
    lastModified: "2 hours ago",
  },
  {
    id: 2,
    title: "Grover's Algorithm Guide",
    type: "docs",
    lastModified: "1 day ago",
  },
  {
    id: 3,
    title: "Bell State Simulation",
    type: "simulation",
    lastModified: "3 days ago",
  },
];

export default function Starred() {
  return (
    <div className="min-h-screen p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-yellow-500/10">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Starred</h1>
            <p className="text-muted-foreground">
              Your favorite items for quick access
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {starredItems.map((item) => (
            <Card 
              key={item.id}
              className="cursor-pointer hover:bg-secondary/50 transition-colors group"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="p-3 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                  <FileCode className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" />
                    {item.lastModified}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {item.type}
                </Badge>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {starredItems.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Star className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No starred items yet</p>
            <p className="text-sm">Star items to add them here for quick access</p>
          </div>
        )}
      </div>
    </div>
  );
}
