import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
  Trash2,
  SkipForward,
  Plus,
  FileText,
  Code,
  X,
  PlayCircle,
  Settings,
  BarChart3,
  CircuitBoard,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";

interface Cell {
  id: string;
  type: "code" | "markdown";
  content: string;
  /**
   * Logical language for this cell's code.
   * For now we support:
   * - 'qasm'   – OpenQASM 2.0 (goes through the RL / Qiskit pipeline)
   * - 'python' – generic Python (including Qiskit/Braket style Python)
   * - 'qiskit' – explicit hint for Qiskit Python
   * - 'braket' – explicit hint for Braket Python
   * - 'auto'   – let backend auto-detect
   */
  language?: "qasm" | "python" | "qiskit" | "braket" | "auto";
  output?: string;
  isRunning?: boolean;
  skipped?: boolean;
}

const defaultSimulationParams = `from qiskit import QuantumCircuit, Aer, execute
from qiskit.providers.aer import noise
from qiskit.visualization import plot_bloch_multivector, plot_histogram
import matplotlib.pyplot as plt

# Initialize Aer simulator
simulator = Aer.get_backend('aer_simulator')

# Optional: Add noise model
# noise_model = noise.NoiseModel()
# simulator = Aer.get_backend('aer_simulator', noise_model=noise_model)`;

const defaultCode = `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];
h q[0];
cx q[0],q[1];
measure q -> c;`;

// Lightweight circuit preview builder (shared approach with CloudConnect)
function extractQubitCountFromQasm(qasm: string): number {
  const qasmMatch = qasm.match(/qreg\s+q\[(\d+)\]/i);
  const count = qasmMatch?.[1];
  const parsed = count ? parseInt(count, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8) : 3;
}

function buildPreviewFromQasm(code: string): string {
  const clean = code.trim();
  if (!clean) return "// No circuit defined yet";

  const qubits = extractQubitCountFromQasm(code);
  const steps: { label: string; targets: number[] }[] = [];
  const lines = clean.split("\n");

  lines.forEach((raw) => {
    const line = raw.toLowerCase();
    const nums = (raw.match(/\d+/g) || []).map((n) => parseInt(n, 10));

    if (line.includes("cx")) {
      if (nums.length >= 2) steps.push({ label: "CX", targets: [nums[0], nums[1]] });
      return;
    }
    if (line.includes("h ")) {
      if (nums.length >= 1) steps.push({ label: "H", targets: [nums[0]] });
      return;
    }
    if (line.includes(" x ") || line.startsWith("x ") || line.trim().startsWith("x")) {
      if (nums.length >= 1) steps.push({ label: "X", targets: [nums[0]] });
      return;
    }
    if (line.includes("rz(") || line.includes("ry(") || line.includes("rx(")) {
      if (nums.length >= 1) steps.push({ label: "R", targets: [nums[0]] });
      return;
    }
    if (line.includes("measure")) {
      if (nums.length) {
        nums.slice(0, qubits).forEach((n) => steps.push({ label: "M", targets: [n] }));
      } else {
        for (let i = 0; i < qubits; i += 1) steps.push({ label: "M", targets: [i] });
      }
    }
  });

  if (!steps.length) return clean.slice(0, 400);

  const lanes = Array.from({ length: qubits }, (_, idx) => `q${idx}: `);
  steps.slice(0, 32).forEach((step) => {
    for (let q = 0; q < qubits; q += 1) {
      if (step.targets.includes(q)) {
        lanes[q] += `[${step.label}]`;
      } else {
        lanes[q] += "───";
      }
    }
  });

  return lanes.join("\n");
}

export default function SimulationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cells, setCells] = useState<Cell[]>([
    {
      id: "1",
      type: "code",
      content: defaultCode,
      language: "qasm",
    },
  ]);
  const [simulationParams, setSimulationParams] = useState(defaultSimulationParams);
  const [isRunning, setIsRunning] = useState(false);
  const [transpilerMode, setTranspilerMode] = useState<"qiskit" | "safe-rl">("qiskit");
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("results");
  const [simulationResults, setSimulationResults] = useState<any>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const blochCanvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef({ x: 0.3, y: 0.5 });
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Simulation configuration & analysis controls
  const [showParams, setShowParams] = useState(false);
  const [noiseEnabled, setNoiseEnabled] = useState(false);
  const [noiseStrength, setNoiseStrength] = useState(0.01);
  const [noiseMetrics, setNoiseMetrics] = useState<string[]>([
    "total_variation_distance",
    "kl_divergence",
    "fidelity",
  ]);
  const [visualizationOptions, setVisualizationOptions] = useState<string[]>(["bar", "donut"]);

  // Bloch sphere dynamic state for all qubits (from backend statevector)
  const [blochVectors, setBlochVectors] = useState<[number, number, number][]>([]);
  const blochVectorsRef = useRef<[number, number, number][]>([]);

  // Combined circuit text for preview / live circuit section
  const combinedCircuitCode = useMemo(
    () =>
      cells
        .filter((c) => !c.skipped && c.type === "code")
        .map((c) => c.content)
        .join("\n\n"),
    [cells]
  );
  const liveCircuitPreview = useMemo(
    () => buildPreviewFromQasm(combinedCircuitCode),
    [combinedCircuitCode]
  );

  const autoResize = (id: string) => {
    const el = textareaRefs.current[id];
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // Quantum states with their positions on Bloch sphere
  const quantumStates = [
    { name: "|0⟩", label: "|0⟩", x: 0, y: 0, z: 1, color: "rgba(59, 130, 246, 1)" },
    { name: "|1⟩", label: "|1⟩", x: 0, y: 0, z: -1, color: "rgba(239, 68, 68, 1)" },
    { name: "|+⟩", label: "|+⟩", x: 1, y: 0, z: 0, color: "rgba(34, 197, 94, 1)" },
    { name: "|-⟩", label: "|-⟩", x: -1, y: 0, z: 0, color: "rgba(168, 85, 247, 1)" },
    { name: "|i+⟩", label: "|i+⟩", x: 0, y: 1, z: 0, color: "rgba(251, 146, 60, 1)" },
    { name: "|i-⟩", label: "|i-⟩", x: 0, y: -1, z: 0, color: "rgba(236, 72, 153, 1)" },
  ];

  // Initialize 3D Bloch sphere visualization
  useEffect(() => {
    const canvas = blochCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const project3D = (x: number, y: number, z: number) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const scale = Math.min(canvas.width, canvas.height) * 0.3;

      // Apply rotation
      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);
      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);

      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const x1 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;

      return {
        x: centerX + x1 * scale,
        y: centerY - y1 * scale,
        z: z2,
      };
    };

    const drawBlochSphere = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.3;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw sphere with 3D effect (multiple circles for depth)
      for (let i = -10; i <= 10; i++) {
        const z = i / 10;
        const circleRadius = Math.sqrt(1 - z * z) * radius;
        const y = centerY - z * radius * 0.5;
        const alpha = 0.1 + (1 - Math.abs(z)) * 0.3;

        ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, y, circleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw axes with labels
      const axes = [
        { start: [-1, 0, 0], end: [1, 0, 0], label: "X", color: "rgba(239, 68, 68, 0.6)" },
        { start: [0, -1, 0], end: [0, 1, 0], label: "Y", color: "rgba(34, 197, 94, 0.6)" },
        { start: [0, 0, -1], end: [0, 0, 1], label: "Z", color: "rgba(59, 130, 246, 0.6)" },
      ];

      axes.forEach((axis) => {
        const start = project3D(axis.start[0], axis.start[1], axis.start[2]);
        const end = project3D(axis.end[0], axis.end[1], axis.end[2]);

        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw axis label
        ctx.fillStyle = axis.color;
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(axis.label, end.x + 10, end.y);
      });

      // Draw reference quantum basis states
      const statesToDraw = quantumStates.map((state) => ({
        ...state,
        projected: project3D(state.x, state.y, state.z),
      }));

      // Sort by z-depth for proper rendering
      statesToDraw.sort((a, b) => b.projected.z - a.projected.z);

      statesToDraw.forEach((state) => {
        const { projected } = state;
        const distance = Math.sqrt(
          Math.pow(projected.x - (mousePos?.x || 0), 2) +
          Math.pow(projected.y - (mousePos?.y || 0), 2)
        );

        const isHovered = distance < 20;

        // Draw state point
        ctx.fillStyle = isHovered ? state.color : state.color.replace("1)", "0.7)");
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, isHovered ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw state label
        ctx.fillStyle = isHovered ? state.color : "rgba(255, 255, 255, 0.8)";
        ctx.font = isHovered ? "bold 14px sans-serif" : "12px sans-serif";
        ctx.fillText(state.label, projected.x + 12, projected.y + 4);

        if (isHovered) {
          setHoveredState(state.name);
        }
      });

      // Draw current circuit states (Bloch vectors for each qubit) if available
      if (blochVectorsRef.current && blochVectorsRef.current.length > 0) {
        const colors = [
          "rgba(250, 204, 21, 1)",
          "rgba(52, 211, 153, 1)",
          "rgba(248, 113, 113, 1)",
          "rgba(129, 140, 248, 1)",
          "rgba(251, 191, 36, 1)",
          "rgba(96, 165, 250, 1)",
        ];

        blochVectorsRef.current.forEach(([bx, by, bz], idx) => {
          const projected = project3D(bx, by, bz);
          const color = colors[idx % colors.length];

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = color;
          ctx.font = "bold 11px sans-serif";
          ctx.fillText(`q${idx}`, projected.x + 8, projected.y - 8);
        });
      }

      // Draw grid lines for 3D effect
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;

      // Latitude lines
      for (let i = -3; i <= 3; i++) {
        const z = i / 3;
        const circleRadius = Math.sqrt(1 - z * z) * radius;
        if (circleRadius > 0) {
          const y = centerY - z * radius * 0.5;
          ctx.beginPath();
          ctx.arc(centerX, y, circleRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Auto-rotate if not dragging
      if (!isDragging) {
        rotationRef.current.y += 0.005;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        rotationRef.current.y += deltaX * 0.01;
        rotationRef.current.x += deltaY * 0.01;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleMouseLeave = () => {
      isDragging = false;
      setMousePos(null);
      setHoveredState(null);
    };

    const animate = () => {
      drawBlochSphere();
      animationFrame = requestAnimationFrame(animate);
    };

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrame);
    };
  }, [mousePos]);

  // Keep Bloch vectors ref in sync for the canvas animation loop
  useEffect(() => {
    blochVectorsRef.current = blochVectors;
  }, [blochVectors]);

  const addCell = (type: "code" | "markdown", afterId?: string) => {
    const newCell: Cell = {
      id: Date.now().toString(),
      type,
      content: type === "code" ? "# Your code here" : "# Markdown content",
      language: type === "code" ? "qasm" : undefined,
    };

    if (afterId) {
      const index = cells.findIndex((c) => c.id === afterId);
      const newCells = [...cells];
      newCells.splice(index + 1, 0, newCell);
      setCells(newCells);
    } else {
      setCells([...cells, newCell]);
    }
  };

  const deleteCell = (id: string) => {
    setCells(cells.filter((c) => c.id !== id));
  };

  const toggleSkip = (id: string) => {
    setCells(
      cells.map((c) => (c.id === id ? { ...c, skipped: !c.skipped } : c))
    );
  };

  const updateCellContent = (id: string, content: string) => {
    setCells(cells.map((c) => (c.id === id ? { ...c, content } : c)));
  };

  const updateCellLanguage = (
    id: string,
    language: "qasm" | "python" | "qiskit" | "braket" | "auto"
  ) => {
    setCells((prev) =>
      prev.map((c) => (c.id === id ? { ...c, language } : c))
    );
  };

  const runCell = async (cellId: string) => {
    const cell = cells.find((c) => c.id === cellId);
    if (!cell || cell.type !== "code" || cell.skipped) return;

    const language = cell.language || "qasm";

    setCells(
      cells.map((c) => (c.id === cellId ? { ...c, isRunning: true } : c))
    );

    // QASM cells go through the specialised transpile/simulation pipeline.
    if (language === "qasm") {
      try {
        const response = await fetch(
          `${getApiBaseUrl()}/transpile/simulation/run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              qasm: cell.content,
              mode: transpilerMode === "safe-rl" ? "safe-rl" : "static",
              shots: 512,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || "Cell execution failed");
        }

        const payload = await response.json();
        const result = payload.result;
        const outputLines = [
          `choice: ${result.choice}`,
          `depth: ${result.depth}`,
          `two-qubit: ${result.two_qubit_count}`,
          `wall_time_s: ${
            result.wall_time_s?.toFixed
              ? result.wall_time_s.toFixed(3)
              : result.wall_time_s
          }`,
          `exec_time_s: ${
            result.exec_time_s?.toFixed
              ? result.exec_time_s.toFixed(3)
              : result.exec_time_s
          }`,
          `counts: ${JSON.stringify(result.counts)}`,
        ].join("\n");

        setCells(
          cells.map((c) =>
            c.id === cellId ? { ...c, isRunning: false, output: outputLines } : c
          )
        );
        toast.success("Cell executed successfully");
      } catch (error) {
        setCells(
          cells.map((c) =>
            c.id === cellId ? { ...c, isRunning: false } : c
          )
        );
        const message =
          error instanceof Error ? error.message : "Cell execution failed";
        toast.error(message);
      }
      return;
    }

    // Non-QASM cells use the generic multi-language execution endpoint.
    try {
      const response = await fetch(`${getApiBaseUrl()}/execution/run-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cell.content,
          language,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Cell execution failed");
      }

      const payload = await response.json();
      const result = payload.result || {};
      const stdout: string = result.stdout || "";
      const stderr: string = result.stderr || "";
      const counts = result.counts;
      const exitCode: number | undefined = result.exit_code;

      let output = "";
      if (stdout) output += stdout;
      if (stderr) {
        if (output) output += "\n";
        output += `stderr:\n${stderr}`;
      }
      if (counts && typeof counts === "object") {
        if (output) output += "\n\n";
        output += `counts:\n${JSON.stringify(counts, null, 2)}`;
      }
      if (!output) {
        output =
          exitCode === 0 || exitCode === undefined
            ? "Execution complete (no output)."
            : `Execution finished with exit code ${exitCode} (no text output).`;
      }

      setCells(
        cells.map((c) =>
          c.id === cellId ? { ...c, isRunning: false, output } : c
        )
      );
      toast.success("Cell executed successfully");
    } catch (error) {
      setCells(
        cells.map((c) => (c.id === cellId ? { ...c, isRunning: false } : c))
      );
      const message =
        error instanceof Error ? error.message : "Cell execution failed";
      toast.error(message);
    }
  };

  const runAllSimulation = async () => {
    setIsRunning(true);
    toast.info("Running complete simulation...");

    try {
      const codeToRun = cells
        .filter(
          (c) =>
            !c.skipped &&
            c.type === "code" &&
            (c.language === "qasm" || !c.language)
        )
        .map((c) => c.content)
        .join("\n\n");

      if (!codeToRun.trim()) {
        toast.error("Please provide OPENQASM 2.0 circuit text.");
        return;
      }

      const mode = transpilerMode === "safe-rl" ? "safe-rl" : "static";
      const response = await fetch(`${getApiBaseUrl()}/transpile/simulation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qasm: codeToRun,
          mode,
          shots: 1024,
          noise_enabled: noiseEnabled,
          noise_strength: noiseStrength,
          noise_metrics: noiseMetrics,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Transpile request failed");
      }

      const payload = await response.json();
      const result = payload.result;

      setSimulationResults({
        choice: result.choice,
        depth: result.depth,
        two_qubit_count: result.two_qubit_count,
        wall_time_s: result.wall_time_s,
        strategy: result.strategy,
        notes: result.notes,
        transpiler: mode,
        counts: result.counts,
        exec_time_s: result.exec_time_s,
        shots: result.shots,
        state: result.state,
        noise: result.noise,
      });

      if (result.state?.bloch_vectors && Array.isArray(result.state.bloch_vectors)) {
        const rawVectors: unknown[] = result.state.bloch_vectors as unknown[];
        const vectors: [number, number, number][] = rawVectors.map((v) => {
          const arr = Array.isArray(v) ? v : [0, 0, 1];
          return [
            Number(arr[0]) || 0,
            Number(arr[1]) || 0,
            Number(arr[2]) || 1,
          ];
        });
        setBlochVectors(vectors);
      } else {
        setBlochVectors([]);
      }

      toast.success("Simulation completed successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Simulation failed";
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            onClick={runAllSimulation}
            disabled={isRunning}
            className="gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            {isRunning ? "Running..." : "Run Simulation"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowParams((prev) => !prev)}
          >
            <Settings className="w-4 h-4" />
            Simulation Parameters
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/simulations")}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border border-border rounded-lg px-2 py-1 bg-card/60">
            <span className="text-xs text-muted-foreground">Transpiler</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={transpilerMode === "qiskit" ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setTranspilerMode("qiskit");
                  toast.info("Using standard Qiskit transpiler.");
                }}
              >
                Qiskit (default)
              </Button>
              <Button
                size="sm"
                variant={transpilerMode === "safe-rl" ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setTranspilerMode("safe-rl");
                  toast.info("Safe RL transpiler enabled for this simulation.");
                }}
              >
                Safe RL assist
              </Button>
            </div>
          </div>
          <Badge variant="outline">Simulation ID: {id}</Badge>
          <Badge variant="secondary">Aer Simulator</Badge>
          {transpilerMode === "safe-rl" && (
            <Badge variant="secondary">Safe RL active</Badge>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cells.map((cell, index) => (
              <div key={cell.id} className="relative">
                <Card className={`${cell.skipped ? "opacity-50" : ""}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runCell(cell.id)}
                          disabled={cell.isRunning || cell.skipped || cell.type === "markdown"}
                          className="h-7 w-7 p-0"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSkip(cell.id)}
                          className={`h-7 w-7 p-0 ${cell.skipped ? "bg-yellow-500/20" : ""}`}
                        >
                          <SkipForward className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCell(cell.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {cell.type === "code" ? (
                          <Code className="w-3 h-3 mr-1" />
                        ) : (
                          <FileText className="w-3 h-3 mr-1" />
                        )}
                        {cell.type === "code" ? "Code" : "Markdown"}
                      </Badge>
                      {cell.type === "code" && (
                        <Select
                          value={cell.language || "qasm"}
                          onValueChange={(value) =>
                            updateCellLanguage(
                              cell.id,
                              value as "qasm" | "python" | "qiskit" | "braket" | "auto"
                            )
                          }
                        >
                          <SelectTrigger className="h-7 px-2 text-[10px] ml-2">
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qasm">OpenQASM 2.0</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="qiskit">Qiskit (Python)</SelectItem>
                            <SelectItem value="braket">Braket (Python)</SelectItem>
                            <SelectItem value="auto">Auto detect</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {cell.skipped && (
                        <Badge variant="secondary" className="text-xs">
                          Skipped
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={cell.content}
                      onChange={(e) => updateCellContent(cell.id, e.target.value)}
                      onInput={() => autoResize(cell.id)}
                      ref={(el) => {
                        textareaRefs.current[cell.id] = el;
                        if (el) autoResize(cell.id);
                      }}
                      className="font-mono text-sm min-h-[150px] resize-none"
                      placeholder={
                        cell.type === "code"
                          ? "Enter code in OpenQASM, Python, Qiskit, or Braket..."
                          : "Enter markdown content..."
                      }
                    />
                    {cell.output && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {cell.output}
                        </pre>
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCell("code", cell.id)}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Cell
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCell("markdown", cell.id)}
                        className="text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Add Markdown
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Bottom Panels */}
          <div className="h-80 border-t border-border flex shrink-0">
            {/* Left: Bloch Sphere */}
            <div className="w-1/2 border-r border-border p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">3D Bloch Sphere</h3>
                </div>
                {hoveredState && (
                  <Badge variant="secondary" className="text-xs">
                    {hoveredState}
                  </Badge>
                )}
              </div>
              <div className="h-full bg-muted/30 rounded-lg relative overflow-hidden cursor-move">
                <canvas ref={blochCanvasRef} className="w-full h-full" />
                {hoveredState && (
                  <div className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 text-xs">
                    <div className="font-semibold mb-1">State: {hoveredState}</div>
                    <div className="text-muted-foreground">
                      {hoveredState === "|0⟩" && "Computational basis state |0⟩"}
                      {hoveredState === "|1⟩" && "Computational basis state |1⟩"}
                      {hoveredState === "|+⟩" && "Superposition: (|0⟩ + |1⟩)/√2"}
                      {hoveredState === "|-⟩" && "Superposition: (|0⟩ - |1⟩)/√2"}
                      {hoveredState === "|i+⟩" && "Superposition: (|0⟩ + i|1⟩)/√2"}
                      {hoveredState === "|i-⟩" && "Superposition: (|0⟩ - i|1⟩)/√2"}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 text-xs text-muted-foreground">
                  <div>Drag to rotate • Hover over states for info</div>
                </div>
              </div>
            </div>

            {/* Right: Analysis Panel */}
            <div className="w-1/2 p-4 overflow-y-auto">
              <Tabs value={activeAnalysisTab} onValueChange={setActiveAnalysisTab}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="results" className="text-xs">
                    <BarChart3 className="w-3 h-3 mr-1" />
                    Results
                  </TabsTrigger>
                  <TabsTrigger value="noise" className="text-xs">
                    <Activity className="w-3 h-3 mr-1" />
                    Noise
                  </TabsTrigger>
                  <TabsTrigger value="circuit" className="text-xs">
                    <CircuitBoard className="w-3 h-3 mr-1" />
                    Circuit
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="space-y-3">
                  {simulationResults ? (
                    <div className="space-y-3">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Transpile Result</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">
                              {simulationResults.choice === "safe-rl"
                                ? "Safe RL + Qiskit"
                                : simulationResults.choice === "parallel"
                                ? "Parallel race"
                                : "Static (opt3)"}
                            </Badge>
                            {simulationResults.notes && (
                              <Badge variant="secondary">{simulationResults.notes}</Badge>
                            )}
                          </div>
                          <div className="space-y-1 font-mono">
                            <div className="flex justify-between">
                              <span>Depth</span>
                              <span>{simulationResults.depth ?? "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Two-qubit count</span>
                              <span>{simulationResults.two_qubit_count ?? "N/A"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Wall time (s)</span>
                              <span>
                                {simulationResults.wall_time_s !== undefined
                                  ? simulationResults.wall_time_s.toFixed(3)
                                  : "N/A"}
                              </span>
                            </div>
                            {simulationResults.exec_time_s !== undefined && (
                              <div className="flex justify-between">
                                <span>Execution time (s)</span>
                                <span>{simulationResults.exec_time_s.toFixed(3)}</span>
                              </div>
                            )}
                          </div>
                          {simulationResults.strategy && (
                            <div className="text-xs text-muted-foreground">
                              Strategy: {JSON.stringify(simulationResults.strategy)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      {simulationResults.counts && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Execution Results</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-xs text-muted-foreground">
                              Shots: {simulationResults.shots ?? 1024}
                            </div>
                            {visualizationOptions.includes("bar") && (
                              <div className="space-y-2">
                                {Object.entries(simulationResults.counts).map(([bit, count], idx) => {
                                  const countsArr = Object.entries(simulationResults.counts || {});
                                  const maxCount = Math.max(...countsArr.map(([, v]) => Number(v)));
                                  const widthPct = maxCount > 0 ? (Number(count) / maxCount) * 100 : 0;
                                  const colorPalette = [
                                    "#60a5fa",
                                    "#f97316",
                                    "#22c55e",
                                    "#a855f7",
                                    "#eab308",
                                    "#ef4444",
                                    "#14b8a6",
                                  ];
                                  const barColor = colorPalette[idx % colorPalette.length];
                                  return (
                                    <div key={bit} className="space-y-1">
                                      <div className="flex justify-between text-xs font-mono">
                                        <span>{bit}</span>
                                        <span>{count as number}</span>
                                      </div>
                                      <div className="h-2 w-full rounded bg-muted overflow-hidden">
                                        <div
                                          className="h-2"
                                          style={{ width: `${widthPct}%`, backgroundColor: barColor }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {visualizationOptions.includes("donut") &&
                              (() => {
                                const entries = Object.entries(simulationResults.counts || {});
                                const total = entries.reduce((acc, [, v]) => acc + Number(v), 0);
                                const colors = [
                                  "#60a5fa",
                                  "#f97316",
                                  "#22c55e",
                                  "#a855f7",
                                  "#eab308",
                                  "#ef4444",
                                  "#14b8a6",
                                ];
                                let current = 0;
                                const segments = entries.map(([key, val], idx) => {
                                  const pct = total > 0 ? (Number(val) / total) * 100 : 0;
                                  const start = current;
                                  const end = current + pct;
                                  current = end;
                                  return `${colors[idx % colors.length]} ${start}% ${end}%`;
                                });
                                return (
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-24 h-24 rounded-full border border-border"
                                      style={{
                                        background: `conic-gradient(${segments.join(",")})`,
                                      }}
                                    />
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      {entries.map(([key], idx) => (
                                        <div key={key} className="flex items-center gap-2">
                                          <span
                                            className="inline-block w-3 h-3 rounded-sm"
                                            style={{ backgroundColor: colors[idx % colors.length] }}
                                          />
                                          <span className="font-mono">{key}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      Run simulation to see results
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="noise" className="space-y-3">
                  {simulationResults ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Noise Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {simulationResults.noise?.enabled ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="outline">
                                Model: {simulationResults.noise.model ?? "depolarizing"}
                              </Badge>
                              {simulationResults.noise.strength !== null &&
                                simulationResults.noise.strength !== undefined && (
                                  <Badge variant="secondary">
                                    Strength: {simulationResults.noise.strength.toFixed(3)}
                                  </Badge>
                                )}
                            </div>
                            {simulationResults.noise.metrics &&
                            Object.keys(simulationResults.noise.metrics).length > 0 ? (
                              <div className="space-y-2 text-xs font-mono">
                                {Object.entries(simulationResults.noise.metrics).map(
                                  ([name, value]) => (
                                    <div key={name} className="flex justify-between">
                                      <span>{name}</span>
                                      <span>
                                        {typeof value === "number"
                                          ? value.toFixed(4)
                                          : String(value)}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Noise is enabled, but no metrics were computed.
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Noise model is disabled for this run. Enable it in Simulation
                            Parameters to see noise analysis.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center text-muted-foreground py-8 text-sm">
                      Run simulation to see noise analysis
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="circuit" className="space-y-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Live Circuit Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs">
                        <pre className="whitespace-pre-wrap text-foreground">
                          {liveCircuitPreview}
                        </pre>
                      </div>
                      {!combinedCircuitCode.trim().length && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Start typing in the code cells to see the circuit preview update instantly.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Right Panel: Simulation Parameters (collapsible) */}
        {showParams && (
          <div className="w-96 border-l border-border bg-card/30 overflow-y-auto shrink-0">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold">Simulation Parameters</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowParams(false)}
                >
                  Hide
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Aer Simulator & Noise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Enable noise model</span>
                    <Button
                      variant={noiseEnabled ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setNoiseEnabled((prev) => !prev)}
                    >
                      {noiseEnabled ? "On" : "Off"}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Noise strength</span>
                      <span>{noiseStrength.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={0.1}
                      step={0.005}
                      value={noiseStrength}
                      onChange={(e) => setNoiseStrength(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-2">
                    <div className="text-muted-foreground">Noise metrics</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "total_variation_distance", label: "Total variation distance" },
                        { key: "kl_divergence", label: "KL divergence" },
                        { key: "fidelity", label: "Fidelity" },
                        { key: "dominant_state_error_rate", label: "Dominant state error" },
                      ].map((metric) => {
                        const active = noiseMetrics.includes(metric.key);
                        return (
                          <Button
                            key={metric.key}
                            variant={active ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => {
                              setNoiseMetrics((prev) =>
                                active
                                  ? prev.filter((m) => m !== metric.key)
                                  : [...prev, metric.key]
                              );
                            }}
                          >
                            {metric.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Visualization Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "bar", label: "Bar chart" },
                      { key: "donut", label: "Donut chart" },
                    ].map((opt) => {
                      const active = visualizationOptions.includes(opt.key);
                      return (
                        <Button
                          key={opt.key}
                          variant={active ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => {
                            setVisualizationOptions((prev) =>
                              active
                                ? prev.filter((v) => v !== opt.key)
                                : [...prev, opt.key]
                            );
                          }}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Underlying Python Snippet</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={simulationParams}
                    onChange={(e) => setSimulationParams(e.target.value)}
                    className="font-mono text-xs min-h-[200px] resize-none"
                    placeholder="Configure Aer simulator parameters..."
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
