import { useState } from "react";
import { Search as SearchIcon, FileCode, FileText, Cpu, Cloud, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const searchResults = [
  {
    id: 1,
    title: "Quantum Teleportation Circuit",
    type: "notebook",
    icon: FileCode,
    description: "Implementation of quantum teleportation protocol",
    lastModified: "2 hours ago",
  },
  {
    id: 2,
    title: "Grover's Algorithm Documentation",
    type: "docs",
    icon: FileText,
    description: "Complete guide to Grover's search algorithm",
    lastModified: "1 day ago",
  },
  {
    id: 3,
    title: "Bell State Simulation",
    type: "simulation",
    icon: Cpu,
    description: "Interactive Bell state preparation simulation",
    lastModified: "3 days ago",
  },
  {
    id: 4,
    title: "VQE Circuit on IBM Hardware",
    type: "cloud-connect",
    icon: Cloud,
    description: "Variational Quantum Eigensolver execution",
    lastModified: "1 week ago",
  },
];

export default function Search() {
  const [query, setQuery] = useState("");

  const filteredResults = searchResults.filter(
    (result) =>
      result.title.toLowerCase().includes(query.toLowerCase()) ||
      result.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">Search</h1>
        
        <div className="relative mb-8">
          <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notebooks, docs, simulations..."
            className="pl-12 h-12 text-lg"
            autoFocus
          />
        </div>

        {query && (
          <p className="text-sm text-muted-foreground mb-4">
            {filteredResults.length} results found
          </p>
        )}

        <div className="space-y-3">
          {filteredResults.map((result) => (
            <Card 
              key={result.id}
              className="cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="p-2 rounded-lg bg-muted">
                  <result.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground">{result.title}</h3>
                    <Badge variant="outline" className="text-xs capitalize">
                      {result.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {result.lastModified}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {query && filteredResults.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No results found for "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
