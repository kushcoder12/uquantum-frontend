import { useRef, useState, useEffect } from "react";
import { 
  Play, 
  Plus, 
  Trash2, 
  Code, 
  FileText, 
  Save, 
  Download,
  ChevronDown,
  CheckCircle2,
  Loader2,
  FolderPlus,
  Github,
  Info,
  File,
  Zap,
  ZapOff,
  SkipForward,
  Folder,
  FileCode,
  Search,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/utils";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Cell {
  id: string;
  type: "code" | "markdown";
  content: string;
  /**
   * Logical language for this cell's code.
   * - 'python'  – generic Python
   * - 'cpp'     – C++ (g++)
   * - 'qasm'    – OpenQASM 2.0
   * - 'qiskit'  – Python with Qiskit imports
   * - 'braket'  – Python with Braket imports
   * - 'auto'    – let backend auto-detect
   */
  language?: "python" | "cpp" | "qasm" | "qiskit" | "braket" | "auto" | "bash";
  output?: string;
  isRunning?: boolean;
  hasRun?: boolean;
  isSkipped?: boolean;
}

const initialCells: Cell[] = [
  {
    id: "1",
    type: "markdown",
    content: "# Quantum Circuit Example\n\nThis notebook demonstrates a simple quantum circuit using Qiskit.",
  },
  {
    id: "2",
    type: "code",
    content: `from qiskit import QuantumCircuit
from qiskit_aer import Aer

# Create a quantum circuit with 2 qubits
qc = QuantumCircuit(2, 2)

# Apply Hadamard gate to first qubit
qc.h(0)

# Apply CNOT gate
qc.cx(0, 1)

# Measure both qubits
qc.measure([0, 1], [0, 1])

print(qc)`,
    output: `     ┌───┐     ┌─┐   
q_0: ┤ H ├──■──┤M├───
     └───┘┌─┴─┐└╥┘┌─┐
q_1: ─────┤ X ├─╫─┤M├
          └───┘ ║ └╥┘
c: 2/═══════════╩══╩═
                0  1 `,
    hasRun: true,
    language: "qiskit",
  },
  {
    id: "3",
    type: "code",
    content: `# Execute the circuit on a simulator
backend = Aer.get_backend('qasm_simulator')
job = backend.run(qc, shots=1000)
result = job.result()
counts = result.get_counts()

print("Results:", counts)`,
    language: "qiskit",
  },
];

const defaultNotebook = () => ({
  id: `${Date.now()}_${Math.random()}`,
  name: 'Untitled Notebook',
  cells: JSON.parse(JSON.stringify(initialCells)),
});

export default function QuantumNotebook() {
  const [notebooks, setNotebooks] = useState([defaultNotebook()]);
  const [activeId, setActiveId] = useState(notebooks[0].id);
  const [isSaved, setIsSaved] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState(new Date());

  // Simple "terminal" attached to the notebook – uses the same backend
  // multi-language execution endpoint but with its own UI.
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLanguage, setTerminalLanguage] = useState<
    "python" | "qasm" | "qiskit" | "braket" | "auto" | "bash"
  >("python");
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [terminalRunning, setTerminalRunning] = useState(false);

  // File System state for the sidebar
  const [fileSystem, setFileSystem] = useState<any[]>([
    { id: "root", name: "content", type: "folder", parentId: null },
    { id: "sample_data", name: "sample_data", type: "folder", parentId: "root" },
  ]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const addFolder = (parentId: string | null = "root") => {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const newFolder = {
      id: Date.now().toString(),
      name,
      type: "folder",
      parentId,
    };
    setFileSystem(prev => [...prev, newFolder]);
    if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId));
  };

  const addFileToSystem = (parentId: string | null = "root") => {
    const name = prompt("Enter file name:");
    if (!name) return;
    const newFile = {
      id: Date.now().toString(),
      name,
      type: "file",
      parentId,
    };
    setFileSystem(prev => [...prev, newFile]);
    if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId));
  };

  const deleteFileSystemItem = (id: string) => {
    if (id === "root") return;
    setFileSystem(prev => prev.filter(item => item.id !== id && item.parentId !== id));
  };

  // Dynamic Env Builder state
  const [dynamicEnvEnabled, setDynamicEnvEnabled] = useState(true);
  const [isPreparingEnv, setIsPreparingEnv] = useState(false);
  const envPrepTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const triggerEnvPrep = async (cellId: string, content: string) => {
    if (!dynamicEnvEnabled || !content.trim() || content.length < 10) return;
    
    setIsPreparingEnv(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/execution/prepare-env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: content,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.installed?.length) {
          toast.success(`Agentic Env: Installed ${data.installed.join(", ")}`, {
            icon: <Zap className="w-4 h-4 text-yellow-500" />
          });
        } else if (data.status === "ready") {
          // Environment is ready, no action needed
        }
      }
    } catch (err) {
      console.error("Env prep failed", err);
    } finally {
      setIsPreparingEnv(false);
    }
  };

  const handleCellUpdate = (id: string, content: string) => {
    updateCell(id, content);
    
    if (dynamicEnvEnabled && content.trim().length >= 10) {
      // Clear existing timeout for this cell
      if (envPrepTimeoutRef.current[id]) {
        clearTimeout(envPrepTimeoutRef.current[id]);
      }
      // Set new timeout - trigger after 3 seconds of no typing
      envPrepTimeoutRef.current[id] = setTimeout(() => {
        const notebook = notebooks.find((nb) => nb.id === activeId);
        const cell = notebook?.cells.find((c) => c.id === id);
        if (cell?.type === "code") {
          triggerEnvPrep(id, content);
        }
      }, 3000);
    }
  };

  const handleTerminalRun = async () => {
    if (!terminalInput.trim()) {
      toast.error("Please enter some code to run.");
      return;
    }
    setTerminalRunning(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/execution/run-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: terminalInput,
            language: terminalLanguage,
          }),
        }
      );
      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({}));
        throw new Error(
          err.detail || "Terminal execution failed"
        );
      }
      const payload = await response.json();
      const result = payload.result || {};
      const stdout: string = result.stdout || "";
      const stderr: string = result.stderr || "";
      const counts = result.counts;
      const exitCode: number | undefined = result.exit_code;

      let out = "";
      if (stdout) out += stdout;
      if (stderr) {
        if (out) out += "\n";
        out += `stderr:\n${stderr}`;
      }
      if (counts && typeof counts === "object") {
        if (out) out += "\n\n";
        out += `counts:\n${JSON.stringify(
          counts,
          null,
          2
        )}`;
      }
      if (!out) {
        out =
          exitCode === 0 || exitCode === undefined
            ? "Execution complete (no output)."
            : `Execution finished with exit code ${exitCode} (no text output).`;
      }
      
      const timestamp = new Date().toLocaleTimeString();
      setTerminalOutput(prev => 
        (prev ? prev + "\n\n" : "") + 
        `[${timestamp}] > ${terminalLanguage}\n${out}`
      );
      setTerminalInput("");
      toast.success("Terminal code executed");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terminal execution failed";
      toast.error(message);
      setTerminalOutput(prev => 
        (prev ? prev + "\n\n" : "") + 
        `[ERROR] ${message}`
      );
    } finally {
      setTerminalRunning(false);
    }
  };

  // Helper: track refs for auto-growing textareas
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // This effect is not needed, but place an autoGrow function
  const autoGrow = (id: string) => {
    const ref = textareaRefs.current[id];
    if (ref) {
      ref.style.height = "auto";
      ref.style.height = ref.scrollHeight + "px";
    }
  };

  // All cell-related actions now scoped to active notebook
  const activeIdx = notebooks.findIndex(nb => nb.id === activeId);
  const cells = notebooks[activeIdx].cells;
  const notebookName = notebooks[activeIdx].name;

  const addCell = (type: "code" | "markdown") => {
    const newCell: Cell = {
      id: Date.now().toString(),
      type,
      content: "",
      language: type === "code" ? "python" : undefined,
    };
    setNotebooks(prev => prev.map(nb => 
      nb.id === activeId ? { ...nb, cells: [...nb.cells, newCell] } : nb
    ));
  };

  const deleteCell = (id: string) => {
    setNotebooks(prev => prev.map(nb => 
      nb.id === activeId ? { ...nb, cells: nb.cells.filter((cell) => cell.id !== id) } : nb
    ));
  };

  const updateCell = (id: string, content: string) => {
    setNotebooks(prev => prev.map(nb => 
      nb.id === activeId ? { ...nb, cells: nb.cells.map((cell) => 
        cell.id === id ? { ...cell, content } : cell
      ) } : nb
    ));
  };
  const updateCellLanguage = (
    id: string,
    language: "python" | "cpp" | "qasm" | "qiskit" | "braket" | "auto" | "bash"
  ) => {
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeId
          ? {
              ...nb,
              cells: nb.cells.map((cell) =>
                cell.id === id ? { ...cell, language } : cell
              ),
            }
          : nb
      )
    );
  };

  const toggleSkipCell = (id: string) => {
    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeId
          ? {
              ...nb,
              cells: nb.cells.map((cell) =>
                cell.id === id ? { ...cell, isSkipped: !cell.isSkipped } : cell
              ),
            }
          : nb
      )
    );
  };

  const runCell = async (id: string) => {
    const notebook = notebooks.find((nb) => nb.id === activeId);
    if (!notebook) return;
    const cell = notebook.cells.find((c) => c.id === id);
    if (!cell || cell.type !== "code") return;

    const language = cell.language || "auto";

    setNotebooks((prev) =>
      prev.map((nb) =>
        nb.id === activeId
          ? {
              ...nb,
              cells: nb.cells.map((c) =>
                c.id === id ? { ...c, isRunning: true } : c
              ),
            }
          : nb
      )
    );

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

      setNotebooks((prev) =>
        prev.map((nb) =>
          nb.id === activeId
            ? {
                ...nb,
                cells: nb.cells.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        isRunning: false,
                        hasRun: true,
                        output,
                      }
                    : c
                ),
              }
            : nb
        )
      );
      toast.success("Cell executed successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cell execution failed";
      setNotebooks((prev) =>
        prev.map((nb) =>
          nb.id === activeId
            ? {
                ...nb,
                cells: nb.cells.map((c) =>
                  c.id === id ? { ...c, isRunning: false } : c
                ),
              }
            : nb
        )
      );
      toast.error(message);
    }
  };

  const runAllCells = async () => {
    toast.info("Running all code cells...");
    for (const cell of cells) {
      if (cell.type === "code" && !cell.isSkipped) {
        // eslint-disable-next-line no-await-in-loop
        await runCell(cell.id);
      }
    }
  };

  // Track cell or name changes for unsaved state
  useEffect(() => { setIsSaved(false); }, [cells, notebookName]);

  // Cleanup env prep timeouts on unmount or when feature is disabled
  useEffect(() => {
    return () => {
      Object.values(envPrepTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    if (!dynamicEnvEnabled) {
      // Clear all pending timeouts when feature is disabled
      Object.values(envPrepTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      envPrepTimeoutRef.current = {};
    }
  }, [dynamicEnvEnabled]);

  const saveNotebook = () => {
    setIsSaved(true);
    setLastSavedTime(new Date());
    toast.success("Notebook saved successfully");
  };

  const renderFileSystem = (parentId: string | null, level: number = 0) => {
    const items = fileSystem.filter(item => item.parentId === parentId);
    return items.map(item => (
      <div key={item.id} className="w-full">
        <SidebarMenuItem>
          <div 
            className="flex items-center w-full group/file-item"
            style={{ paddingLeft: `${level * 12}px` }}
          >
            <SidebarMenuButton 
              className={`flex-1 flex items-center gap-2 h-8 hover:bg-accent/50 transition-colors rounded-none ${item.type === "folder" ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => item.type === "folder" && toggleFolder(item.id)}
            >
              {item.type === "folder" ? (
                <>
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-muted-foreground ${expandedFolders.has(item.id) ? "" : "-rotate-90"}`} />
                  <Folder className={`w-4 h-4 shrink-0 ${expandedFolders.has(item.id) ? "text-blue-500 fill-blue-500/20" : "text-blue-400"}`} />
                  <span className="text-[13px] font-medium truncate text-foreground/90">{item.name}</span>
                </>
              ) : (
                <>
                  <div className="w-3.5 shrink-0" /> {/* Chevron alignment spacer */}
                  <FileCode className="w-4 h-4 shrink-0 text-muted-foreground/70" />
                  <span className="text-[13px] truncate text-foreground/80">{item.name}</span>
                </>
              )}
            </SidebarMenuButton>
            
            <div className="opacity-0 group-hover/file-item:opacity-100 flex items-center gap-0.5 pr-2 transition-opacity">
              {item.type === "folder" && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 hover:bg-accent rounded-sm" 
                  onClick={(e) => { e.stopPropagation(); addFileToSystem(item.id); }}
                  title="New File"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-sm" 
                onClick={(e) => { e.stopPropagation(); deleteFileSystemItem(item.id); }}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </SidebarMenuItem>
        {item.type === "folder" && expandedFolders.has(item.id) && (
          <div className="w-full">
            {renderFileSystem(item.id, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background selection:bg-primary/20">
        <Sidebar className="border-r border-border w-[280px] shrink-0 bg-muted/5">
          <SidebarHeader className="border-b border-border/60 px-4 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-md">
                  <Folder className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-bold text-sm tracking-tight">Files</h2>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-md" onClick={() => addFileToSystem("root")} title="New File at Root">
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent rounded-md" onClick={() => addFolder("root")} title="New Folder at Root">
                  <FolderPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                placeholder="Search files..." 
                className="w-full bg-muted/50 border border-transparent hover:border-border focus:border-primary focus:bg-background rounded-lg py-2 pl-9 pr-4 text-xs outline-none transition-all placeholder:text-muted-foreground/70"
              />
            </div>
          </SidebarHeader>
          <SidebarContent className="scrollbar-thin">
            <SidebarGroup>
              <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 mb-2">
                Project Explorer
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="px-1">
                  {renderFileSystem(null)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="mt-auto p-4 border-t border-border/40 bg-muted/10">
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs font-medium border-dashed hover:border-solid transition-all">
              <Github className="w-3.5 h-3.5" />
              Connect Repository
            </Button>
          </div>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-background/30">
          {/* Header */}
          <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
            <div className="flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <SidebarTrigger className="h-9 w-9 hover:bg-accent" />
                <Separator orientation="vertical" className="h-6 opacity-30" />
                <div className="flex items-center gap-2 group flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <input
                    type="text"
                    value={notebookName}
                    onChange={(e) => setNotebooks(prev => prev.map(nb =>
                      nb.id === activeId ? { ...nb, name: e.target.value } : nb
                    ))}
                    className="text-lg font-bold bg-transparent border-none outline-none text-foreground w-full truncate focus:text-primary transition-colors"
                  />
                </div>
                {/* Save status icon button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className={`h-8 w-8 rounded-full ${isSaved ? "text-green-500 hover:bg-green-500/10" : "text-red-500 hover:bg-red-500/10"}`}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3 text-xs font-medium shadow-xl" align="start">
                    Last saved: {lastSavedTime.toLocaleString()}
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/40">
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-3 text-xs font-semibold hover:bg-background shadow-sm transition-all" onClick={runAllCells}>
                    <Play className="w-3.5 h-3.5 fill-primary text-primary" />
                    Run All
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1 opacity-50" />
                  <Button variant="ghost" size="sm" className="h-8 gap-2 px-3 text-xs font-semibold hover:bg-background" onClick={saveNotebook}>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 gap-2 px-4 text-xs font-bold border-border/60">
                        <Download className="w-3.5 h-3.5" />
                        Export
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem className="gap-2">
                        <FileCode className="w-4 h-4" /> Export as .ipynb
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <FileText className="w-4 h-4" /> Export as .py
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2">
                        <Code className="w-4 h-4" /> Export as .qasm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant={terminalOpen ? "secondary" : "outline"}
                    size="sm"
                    className={`h-9 gap-2 px-4 text-xs font-bold transition-all ${terminalOpen ? "bg-primary/10 text-primary border-primary/20" : "border-border/60"}`}
                    onClick={() => setTerminalOpen((prev) => !prev)}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Terminal
                  </Button>
                </div>

                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-border/50">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full transition-colors ${dynamicEnvEnabled ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground"}`}>
                      {dynamicEnvEnabled ? (
                        <Zap className="w-3.5 h-3.5 animate-pulse" />
                      ) : (
                        <ZapOff className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <Label htmlFor="env-builder" className="text-[11px] font-bold uppercase tracking-wider cursor-pointer text-muted-foreground">
                      Agentic Env
                    </Label>
                  </div>
                  <Switch
                    id="env-builder"
                    checked={dynamicEnvEnabled}
                    onCheckedChange={setDynamicEnvEnabled}
                    disabled={isPreparingEnv}
                    className="scale-90"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notebook Content */}
          <div className="flex-1 overflow-auto bg-muted/5 custom-scrollbar">
            <div className="max-w-6xl mx-auto p-8 space-y-6">
              {/* Tabs UI for switching notebooks (above header) */}
              <div className="flex items-center gap-4 mb-2">
                <Tabs value={activeId} onValueChange={setActiveId} className="flex-1">
                  <TabsList className="bg-muted/40 p-1 rounded-xl border border-border/50">
                    {notebooks.map(nb => (
                      <TabsTrigger 
                        key={nb.id} 
                        value={nb.id} 
                        className="px-6 py-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-md transition-all text-xs font-bold"
                      >
                        {nb.name || 'Notebook'}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-xl border border-dashed border-border/60 hover:border-solid hover:bg-background transition-all"
                  onClick={() => {
                    const nb = defaultNotebook();
                    setNotebooks([...notebooks, nb]);
                    setActiveId(nb.id);
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-8 pb-32">
                {cells.map((cell) => (
                  <div key={cell.id} className="group relative">
                    <div className="flex gap-6">
                      {/* Cell Controls */}
                      <div className="flex flex-col gap-2 pt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 sticky top-28 h-fit translate-x-[-10px] group-hover:translate-x-0">
                        {cell.type === "code" && (
                          <>
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 bg-background border border-border/50"
                              onClick={() => runCell(cell.id)}
                              disabled={cell.isRunning || cell.isSkipped}
                            >
                              {cell.isRunning ? (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              ) : cell.hasRun ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <Play className="w-5 h-5 text-primary fill-primary/10" />
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-9 w-9 rounded-xl border border-transparent transition-all ${cell.isSkipped ? "text-orange-500 bg-orange-500/10 border-orange-500/20" : "text-muted-foreground hover:bg-accent"}`}
                              onClick={() => toggleSkipCell(cell.id)}
                              title={cell.isSkipped ? "Unskip Cell" : "Skip Cell"}
                            >
                              <SkipForward className="w-5 h-5" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => deleteCell(cell.id)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>

                      {/* Cell Content */}
                      <div className={`flex-1 transition-all duration-500 ${cell.isSkipped ? "opacity-40 grayscale-[0.5]" : ""}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${
                            cell.type === "code" 
                              ? "bg-primary/5 border-primary/20 text-primary" 
                              : "bg-muted/50 border-border text-muted-foreground"
                          }`}>
                            {cell.type === "code" ? (
                              <>
                                <Code className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Code Cell</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Markdown Cell</span>
                              </>
                            )}
                          </div>
                          
                          {cell.type === "code" && (
                            <Select
                              value={cell.language || "auto"}
                              onValueChange={(value) =>
                                updateCellLanguage(
                                  cell.id,
                                  value as "python" | "qasm" | "qiskit" | "braket" | "auto" | "cpp" | "bash"
                                )
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px] px-3 text-[11px] font-bold bg-muted/40 border-border/50 hover:bg-muted/60 transition-all rounded-lg shadow-none focus:ring-1 focus:ring-primary/30">
                                <SelectValue placeholder="Language" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-xl border-border/60">
                                <SelectItem value="auto" className="text-xs">Auto detect</SelectItem>
                                <SelectItem value="python" className="text-xs">Python</SelectItem>
                                <SelectItem value="cpp" className="text-xs">C++</SelectItem>
                                <SelectItem value="qiskit" className="text-xs">Qiskit (Python)</SelectItem>
                                <SelectItem value="braket" className="text-xs">Braket (Python)</SelectItem>
                                <SelectItem value="qasm" className="text-xs">OpenQASM 2.0</SelectItem>
                                <SelectItem value="bash" className="text-xs">Bash/Shell</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          
                          {cell.isSkipped && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 text-orange-600 rounded-lg border border-orange-500/20 ml-auto">
                              <SkipForward className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Cell Skipped</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative group/textarea">
                          <Textarea
                            value={cell.content}
                            onChange={(e) => {
                              handleCellUpdate(cell.id, e.target.value);
                              setTimeout(() => autoGrow(cell.id), 0);
                            }}
                            className={`min-h-[140px] resize-none font-mono text-sm p-5 rounded-2xl transition-all duration-300 border-2 ${
                              cell.type === "code" 
                                ? "bg-muted/20 border-border/40 focus:border-primary/40 focus:bg-background" 
                                : "bg-card border-transparent focus:border-border/60"
                            } shadow-sm group-hover/textarea:shadow-md`}
                            placeholder={
                              cell.type === "code"
                                ? "Enter code in Python, Qiskit, Braket, or OpenQASM..."
                                : "Enter markdown..."
                            }
                            ref={el => {
                              textareaRefs.current[cell.id] = el;
                              if (el) setTimeout(() => autoGrow(cell.id), 0);
                            }}
                          />
                          <div className="absolute right-4 bottom-4 opacity-0 group-hover/textarea:opacity-100 transition-opacity pointer-events-none">
                            <span className="text-[10px] text-muted-foreground/50 font-mono">
                              {cell.content.length} chars
                            </span>
                          </div>
                        </div>

                        {/* Output */}
                        {cell.output && !cell.isSkipped && (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-border/40 shadow-sm bg-background/50 backdrop-blur-sm">
                            <div className="px-4 py-2 border-b border-border/30 bg-muted/30 flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Execution Output</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md hover:bg-background" onClick={() => {
                                setNotebooks(prev => prev.map(nb => nb.id === activeId ? {
                                  ...nb, cells: nb.cells.map(c => c.id === cell.id ? { ...c, output: "" } : c)
                                } : nb));
                              }}>
                                <Trash2 className="w-3 h-3 text-muted-foreground/50" />
                              </Button>
                            </div>
                            <div className="p-6">
                              <pre className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed selection:bg-primary/20">
                                {cell.output}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Cell Button */}
              <div className="flex justify-center gap-6 py-16">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent self-center" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-3 px-8 h-12 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group">
                      <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                      <span className="font-bold tracking-wide">Add Content</span>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56 p-2 rounded-2xl shadow-2xl border-border/60">
                    <DropdownMenuItem onClick={() => addCell("code")} className="gap-3 py-3 rounded-xl cursor-pointer">
                      <div className="p-2 bg-primary/10 rounded-lg"><Code className="w-4 h-4 text-primary" /></div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Code Cell</span>
                        <span className="text-[10px] text-muted-foreground">Python, Qiskit, C++, QASM</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addCell("markdown")} className="gap-3 py-3 rounded-xl cursor-pointer">
                      <div className="p-2 bg-muted rounded-lg"><FileText className="w-4 h-4" /></div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Markdown Cell</span>
                        <span className="text-[10px] text-muted-foreground">Documentation and Notes</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent self-center" />
              </div>
            </div>
          </div>
          
          {terminalOpen && (
            <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl px-8 py-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
              <div className="max-w-[1600px] mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-xl">
                      <Code className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Interactive Terminal</h3>
                      <p className="text-[10px] text-muted-foreground font-medium">Multi-language execution environment</p>
                    </div>
                    <Separator orientation="vertical" className="h-8 mx-2 opacity-30" />
                    <Select
                      value={terminalLanguage}
                      onValueChange={(val) =>
                        setTerminalLanguage(
                          val as "python" | "qasm" | "qiskit" | "braket" | "auto" | "bash"
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] px-4 text-xs font-bold bg-muted/40 border-border/50 hover:bg-muted/60 transition-all rounded-xl shadow-none focus:ring-1 focus:ring-primary/30">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl">
                        <SelectItem value="python" className="text-xs">Python</SelectItem>
                        <SelectItem value="qiskit" className="text-xs">Qiskit (Python)</SelectItem>
                        <SelectItem value="braket" className="text-xs">Braket (Python)</SelectItem>
                        <SelectItem value="qasm" className="text-xs">OpenQASM 2.0</SelectItem>
                        <SelectItem value="bash" className="text-xs">Bash/Shell</SelectItem>
                        <SelectItem value="auto" className="text-xs">Auto detect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-4 rounded-xl text-xs font-bold hover:bg-muted transition-all"
                    onClick={() => setTerminalOpen(false)}
                  >
                    Close Terminal
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div className="relative group">
                      <Textarea
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleTerminalRun();
                          }
                        }}
                        className="font-mono text-xs min-h-[180px] resize-none bg-muted/30 border-2 border-transparent focus:border-primary/20 focus:bg-background p-5 rounded-2xl shadow-inner transition-all"
                        placeholder="Type code here (Ctrl+Enter to run)..."
                      />
                      <Button
                        size="sm"
                        className="absolute right-4 bottom-4 h-10 px-6 rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        disabled={terminalRunning}
                        onClick={handleTerminalRun}
                      >
                        {terminalRunning ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2 fill-current" />
                        )}
                        Execute Code
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Live Output</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        onClick={() => setTerminalOutput("")}
                      >
                        Clear Console
                      </Button>
                    </div>
                    <div className="flex-1 bg-black/5 rounded-2xl border border-border/40 p-6 overflow-auto min-h-[180px] max-h-[180px] shadow-inner custom-scrollbar">
                      <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90 selection:bg-primary/20">
                        {terminalOutput || "Console ready. Execute code to see output..."}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
