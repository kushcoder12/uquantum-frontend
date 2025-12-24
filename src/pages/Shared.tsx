import { Users, FileCode, Clock, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const sharedItems = [
  {
    id: 1,
    title: "Team Quantum Circuit",
    type: "notebook",
    sharedBy: "Alice Chen",
    sharedAt: "2 hours ago",
    permission: "Edit",
  },
  {
    id: 2,
    title: "Research Notes - VQE",
    type: "docs",
    sharedBy: "Bob Smith",
    sharedAt: "Yesterday",
    permission: "View",
  },
  {
    id: 3,
    title: "Hardware Benchmark Results",
    type: "cloud-connect",
    sharedBy: "Carol Zhang",
    sharedAt: "3 days ago",
    permission: "Edit",
  },
];

export default function Shared() {
  return (
    <div className="min-h-screen p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Shared with me</h1>
            <p className="text-muted-foreground">
              Files and projects shared by your team
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {sharedItems.map((item) => (
            <Card 
              key={item.id}
              className="cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="p-3 rounded-lg bg-muted">
                  <FileCode className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Avatar className="w-4 h-4">
                        <AvatarFallback className="text-[8px]">
                          {item.sharedBy.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {item.sharedBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.sharedAt}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {item.permission}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {sharedItems.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No shared items yet</p>
            <p className="text-sm">Items shared with you will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
