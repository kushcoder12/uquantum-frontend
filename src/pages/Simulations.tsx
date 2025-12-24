import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ChevronRight,
  Atom,
  Zap,
  Binary,
  Waves
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const simulations = [
  {
    id: 1,
    title: "Bell State Preparation",
    description: "Create and measure quantum entanglement between two qubits using Hadamard and CNOT gates.",
    category: "Entanglement",
    difficulty: "Beginner",
    duration: "5 min",
    runs: 15234,
    rating: 4.8,
    icon: Atom,
  },
  {
    id: 2,
    title: "Quantum Teleportation",
    description: "Demonstrate quantum state teleportation using entanglement and classical communication.",
    category: "Protocols",
    difficulty: "Intermediate",
    duration: "10 min",
    runs: 8932,
    rating: 4.9,
    icon: Zap,
  },
  {
    id: 3,
    title: "Grover's Search Algorithm",
    description: "Find a marked item in an unsorted database with quadratic speedup over classical algorithms.",
    category: "Algorithms",
    difficulty: "Intermediate",
    duration: "15 min",
    runs: 12456,
    rating: 4.7,
    icon: Binary,
  },
  {
    id: 4,
    title: "Quantum Fourier Transform",
    description: "Implement the quantum version of the discrete Fourier transform - a key building block.",
    category: "Algorithms",
    difficulty: "Advanced",
    duration: "20 min",
    runs: 6789,
    rating: 4.6,
    icon: Waves,
  },
  {
    id: 5,
    title: "Quantum Error Correction",
    description: "Learn how to protect quantum information using the 3-qubit bit-flip code.",
    category: "Error Correction",
    difficulty: "Advanced",
    duration: "25 min",
    runs: 4521,
    rating: 4.5,
    icon: Atom,
  },
  {
    id: 6,
    title: "Variational Quantum Eigensolver",
    description: "Find the ground state energy of a molecular Hamiltonian using a hybrid approach.",
    category: "Chemistry",
    difficulty: "Expert",
    duration: "30 min",
    runs: 3210,
    rating: 4.8,
    icon: Atom,
  },
];

const categories = ["All", "Entanglement", "Algorithms", "Protocols", "Error Correction", "Chemistry"];

export default function Simulations() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredSimulations = selectedCategory === "All"
    ? simulations
    : simulations.filter((sim) => sim.category === selectedCategory);

  const exploreSimulation = (id: number) => {
    navigate(`/simulation/${id}`);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Intermediate":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Advanced":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "Expert":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulations</h1>
            <p className="text-muted-foreground">
              Pre-built quantum simulations to learn and experiment
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-6">
          {filteredSimulations.map((sim) => (
            <Card 
              key={sim.id} 
              className="group hover:bg-secondary/30 transition-all duration-200"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <sim.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {sim.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {sim.category}
                        </Badge>
                        <Badge className={`text-xs border ${getDifficultyColor(sim.difficulty)}`}>
                          {sim.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {sim.description}
                </p>
                
                <div className="flex items-center justify-end">
                  <Button 
                    size="sm" 
                    onClick={() => exploreSimulation(sim.id)}
                  >
                    Explore
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
