import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Copy,
  Download,
  RefreshCw,
  Check,
  ChevronDown,
  Cpu,
  Plus,
  Layers,
  Code2,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const languageTemplates: Record<string, string> = {
  qasm: `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0], q[1];
measure q -> c;`,
  qiskit: `from qiskit import QuantumCircuit, transpile

qc = QuantumCircuit(2, 2)
qc.h(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])

# transpile for backend before submit`,
  python: `# Python pseudocode for circuit building
from my_platform import Circuit

circ = Circuit(2, 2)
circ.h(0)
circ.cx(0, 1)
circ.measure([0, 1], [0, 1])
`,
  braket: `from braket.circuits import Circuit

circ = Circuit()
circ.h(0).cnot(0, 1)
circ.probability()
`,
};

const circuitPreview = `
┌───┐     ┌─┐   
q₀: ┤ H ├──■──┤M├───
    └───┘┌─┴─┐└╥┘┌─┐
q₁: ─────┤ X ├─╫─┤M├
         └───┘ ║ └╥┘
 c: 2/═════════╩══╩═
               0  1
`;

function extractQubitCount(code: string): number {
  const qasmMatch = code.match(/qreg\s+q\[(\d+)\]/i);
  const qcMatch = code.match(/quantumcircuit\s*\(\s*(\d+)/i);
  const circuitMatch = code.match(/circuit\s*\(\s*(\d+)/i);
  const count = qasmMatch?.[1] || qcMatch?.[1] || circuitMatch?.[1];
  const parsed = count ? parseInt(count, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8) : 3;
}

function buildPreviewFromCode(code: string): string {
  const clean = code.trim();
  if (!clean) return circuitPreview;

  const qubits = extractQubitCount(code);
  const steps: { label: string; targets: number[] }[] = [];
  const lines = clean.split("\n");

  lines.forEach((raw) => {
    const line = raw.toLowerCase();
    const nums = (raw.match(/\d+/g) || []).map((n) => parseInt(n, 10));

    if (line.includes("cx") || line.includes("cnot")) {
      if (nums.length >= 2) steps.push({ label: "CX", targets: [nums[0], nums[1]] });
      return;
    }
    if (line.includes("h ") || line.includes(".h(")) {
      if (nums.length >= 1) steps.push({ label: "H", targets: [nums[0]] });
      return;
    }
    if (line.includes("x ") || line.includes(".x(")) {
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
  steps.slice(0, 24).forEach((step) => {
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

interface RunResult {
  id: string;
  provider: string;
  status: string;
  result?: string;
  timestamp: string;
}

interface BackendOption {
  name: string;
  num_qubits?: number;
  simulator?: boolean;
  operational?: boolean;
  status?: string;
  pending_jobs?: number | null;
}

export default function CloudConnect() {
  const [language, setLanguage] = useState<keyof typeof languageTemplates>("qasm");
  const [code, setCode] = useState(languageTemplates.qasm);
  const [shots, setShots] = useState<number>(1024);
  const [jobs, setJobs] = useState<number>(1);
  const [selectedBackend, setSelectedBackend] = useState<string>("");
  const [backendOptions, setBackendOptions] = useState<BackendOption[]>([]);
  const [loadingBackends, setLoadingBackends] = useState<boolean>(false);
  const [hardwareDropdownOpen, setHardwareDropdownOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([
    {
      id: "1",
      provider: "IBM Quantum",
      status: "completed",
      result: '{"00": 512, "11": 512}',
      timestamp: "2 hours ago",
    },
    {
      id: "2",
      provider: "Local Simulator",
      status: "completed",
      result: '{"00": 498, "11": 502}',
      timestamp: "2 hours ago",
    },
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [code]);

  useEffect(() => {
    const fetchBackends = async () => {
      setLoadingBackends(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/hardware/list`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const list = (data.backends || []) as BackendOption[];
        setBackendOptions(
          list.length
            ? list
            : [
                { name: "ibm_fez", operational: true, status: "online" },
                { name: "ibm_torino", operational: true, status: "online" },
              ]
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load IBM hardware list");
        setBackendOptions([
          { name: "ibm_fez", operational: true, status: "online" },
          { name: "ibm_torino", operational: true, status: "online" },
        ]);
      } finally {
        setLoadingBackends(false);
      }
    };

    fetchBackends();

    return () => {
      Object.values(pollersRef.current).forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  useEffect(() => {
    if (!selectedBackend && backendOptions.length) {
      const operational = backendOptions.find((b) => b.operational !== false) || backendOptions[0];
      setSelectedBackend(operational?.name || "");
    }
  }, [backendOptions, selectedBackend]);

  const handleLanguageChange = (value: keyof typeof languageTemplates) => {
    setLanguage(value);
    setCode(languageTemplates[value]);
  };

  const runCircuit = async () => {
    if (!selectedBackend) {
      toast.error("Select an IBM hardware backend");
      return;
    }
    if (!Number.isFinite(shots) || shots <= 0) {
      toast.error("Shots must be greater than zero");
      return;
    }
    if (!Number.isFinite(jobs) || jobs <= 0) {
      toast.error("Jobs must be greater than zero");
      return;
    }

    setIsRunning(true);
    toast.info("Submitting circuit to IBM Quantum...");

    try {
      const response = await fetch(`${getApiBaseUrl()}/execution/ibm/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          backend: selectedBackend,
          shots,
          jobs,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to submit job");
      }

      const data = await response.json();
      const jobIds: string[] = data.job_ids || [];
      if (!jobIds.length) {
        throw new Error("No job IDs returned from backend");
      }

      const timestamp = "Just now";
      setResults((prev) => [
        ...jobIds.map((id) => ({
          id,
          provider: selectedBackend,
          status: "running",
          timestamp,
        })),
        ...prev,
      ]);

      jobIds.forEach((jobId) => {
        const poll = async () => {
          try {
            const statusRes = await fetch(`${getApiBaseUrl()}/execution/status/${jobId}`);
            if (!statusRes.ok) throw new Error(await statusRes.text());
            const payload = await statusRes.json();
            const statusName = (payload.status || "unknown").toString();
            const doneStates = ["DONE", "COMPLETED", "CANCELLED", "ERROR", "FAILED"];
            setResults((prev) =>
              prev.map((r) =>
                r.id === jobId
                  ? {
                      ...r,
                      status: statusName.toLowerCase(),
                      result: payload.result ? JSON.stringify(payload.result) : r.result,
                      timestamp: new Date().toLocaleString(),
                    }
                  : r
              )
            );
            if (doneStates.includes(statusName.toUpperCase())) {
              clearInterval(pollersRef.current[jobId]);
              delete pollersRef.current[jobId];
            }
          } catch (err) {
            console.error(err);
          }
        };

        poll();
        pollersRef.current[jobId] = window.setInterval(poll, 2500);
      });

      toast.success("Job submitted to IBM Quantum");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const handleNewWorkspace = () => {
    window.open("/cloud-connect?workspace=new", "_blank", "noopener");
  };

  const previewText = useMemo(() => buildPreviewFromCode(code), [code]);

  const chartData = useMemo(() => {
    const completed = results.find(
      (r) =>
        (r.status.toLowerCase() === "completed" || r.status.toLowerCase() === "done") &&
        r.result
    );
    if (!completed || !completed.result) return [];

    try {
      const counts = JSON.parse(completed.result);
      // IBM sometimes returns results in a nested 'counts' or directly
      const actualCounts = counts.counts || counts;
      return Object.entries(actualCounts).map(([state, count]) => ({
        state,
        count: Number(count),
      }));
    } catch (e) {
      console.error("Failed to parse result for chart:", e);
      return [];
    }
  }, [results]);

  const chartConfig = {
    count: {
      label: "Shots",
      color: "hsl(var(--primary))",
    },
  };

  const livePreview =
    code.trim().length > 0
      ? previewText
      : circuitPreview;

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Quantum Cloud Multi-Connect</h1>
            <p className="text-sm text-muted-foreground">
              Write circuits in Python, QASM, Qiskit, or Braket and route to multiple backends.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handleNewWorkspace}>
              <Plus className="h-4 w-4" />
              New workspace
            </Button>
            <Button onClick={runCircuit} disabled={isRunning} className="gap-2">
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Circuit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column - Code Editor */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Code Editor
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value as keyof typeof languageTemplates)}
                      className="bg-transparent text-sm outline-none"
                    >
                      <option value="qasm">OpenQASM</option>
                      <option value="qiskit">Qiskit</option>
                      <option value="python">Python</option>
                      <option value="braket">Braket</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={copyCode}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-3 text-sm">
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Shots</Label>
                  <Input
                    type="number"
                    min={1}
                    value={shots}
                    onChange={(e) => setShots(Number(e.target.value))}
                    className="h-8 w-24"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-muted-foreground">Jobs</Label>
                  <Input
                    type="number"
                    min={1}
                    value={jobs}
                    onChange={(e) => setJobs(Number(e.target.value))}
                    className="h-8 w-24"
                  />
                </div>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setHardwareDropdownOpen((v) => !v)}
                  >
                    <Layers className="h-4 w-4" />
                    {loadingBackends
                      ? "Loading hardware..."
                      : selectedBackend
                        ? selectedBackend
                        : "Select hardware"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  {hardwareDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-64 rounded-md border border-border bg-background p-2 shadow">
                      <div className="text-xs text-muted-foreground px-2 pb-2">
                        Choose an IBM backend (QPU)
                      </div>
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {backendOptions.map((option) => {
                          const isSelected = selectedBackend === option.name;
                          const flavor = option.simulator ? "Simulator" : "QPU";
                          const status = option.status || "unknown";
                          return (
                            <button
                              key={option.name}
                              onClick={() => setSelectedBackend(option.name)}
                              className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-muted/60 ${
                                isSelected ? "bg-primary/10 text-primary" : ""
                              }`}
                            >
                              <div className="flex flex-col">
                                <span>{option.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {flavor} • {option.num_qubits ?? "?"} qubits • {status}
                                </span>
                              </div>
                              {isSelected && <Check className="h-4 w-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[320px] font-mono text-sm bg-input resize-none"
                placeholder="Enter QASM, Qiskit, Braket, or Python code..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview & Results */}
        <div className="space-y-6">
          {/* Circuit Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Circuit Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                <pre className="text-foreground whitespace-pre-wrap">{livePreview}</pre>
              </div>
              {!code.trim().length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Start typing to see your circuit preview update instantly.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Execution Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="history">
                <TabsList className="mb-4">
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="space-y-3">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={(() => {
                              const s = result.status.toLowerCase();
                              if (s === "completed" || s === "done") return "default";
                              if (s === "running") return "secondary";
                              return "destructive";
                            })()}
                            className="text-xs"
                          >
                            {result.status}
                          </Badge>
                          <span className="font-medium text-sm">{result.provider}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {result.timestamp}
                        </span>
                      </div>
                      {result.result && (
                        <pre className="text-sm font-mono text-muted-foreground">
                          {result.result}
                        </pre>
                      )}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="analysis">
                  {chartData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Probability Distribution</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {results.find(r => r.result)?.provider}
                        </Badge>
                      </div>
                      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                        <BarChart data={chartData}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="state"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="count"
                            fill="var(--color-count)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ChartContainer>
                      <div className="text-[10px] text-muted-foreground text-center">
                        Horizontal Axis: Basis States | Vertical Axis: Measurement Counts
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Run a circuit to see analysis results</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
