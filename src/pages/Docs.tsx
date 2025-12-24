import { useMemo, useState } from "react";
import {
  Search,
  FolderTree,
  FileText,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DocNode =
  | {
      id: string;
      title: string;
      type: "folder";
      description?: string;
      children: DocNode[];
    }
  | {
      id: string;
      title: string;
      type: "doc";
      summary: string;
      badge?: string;
    };

const docsTree: DocNode[] = [
  {
    id: "platform",
    title: "Platform Guide",
    type: "folder",
    description: "Using the Uniq Quantum Hub day to day",
    children: [
      { id: "platform/overview", title: "Overview", type: "doc", summary: "Architecture, roles, and workspace model.", badge: "Start here" },
      { id: "platform/access", title: "Access & SSO", type: "doc", summary: "Identity, SSO, and role mappings." },
      { id: "platform/projects", title: "Projects & Workspaces", type: "doc", summary: "Organizing notebooks, datasets, and runs." },
      { id: "platform/auditing", title: "Auditing & Compliance", type: "doc", summary: "Event trails, exports, retention policies." },
    ],
  },
  {
    id: "multi-cloud",
    title: "Quantum Multi-Cloud",
    type: "folder",
    description: "Connect and schedule across providers",
    children: [
      { id: "multi-cloud/connections", title: "Provider Connections", type: "doc", summary: "IBM, AWS Braket, Azure, custom endpoints." },
      { id: "multi-cloud/routing", title: "Job Routing", type: "doc", summary: "Policies, latency preferences, and fallbacks." },
      { id: "multi-cloud/quotas", title: "Quotas & Billing", type: "doc", summary: "Per-tenant limits and cost controls." },
      { id: "multi-cloud/security", title: "Security Posture", type: "doc", summary: "KMS, credential isolation, and secrets rotation." },
    ],
  },
  {
    id: "notebook",
    title: "Quantum Notebook",
    type: "folder",
    description: "IDE, SDK, and runtimes",
    children: [
      { id: "notebook/getting-started", title: "Getting Started", type: "doc", summary: "Launch, kernels, and environment setup." },
      { id: "notebook/versioning", title: "Versioning & Checkpoints", type: "doc", summary: "Snapshots, diffs, and restore flow." },
      { id: "notebook/extensions", title: "Extensions & AI Assist", type: "doc", summary: "Inline assist, linting, and templates." },
      { id: "notebook/hardware-targets", title: "Hardware Targets", type: "doc", summary: "Send cells to simulators or QPUs safely." },
    ],
  },
  {
    id: "simulation",
    title: "Simulation Suite",
    type: "folder",
    description: "Classical + hybrid simulation",
    children: [
      { id: "simulation/engines", title: "Engines", type: "doc", summary: "Statevector, tensor network, and noise models." },
      { id: "simulation/calibration", title: "Calibration Imports", type: "doc", summary: "Upload calibration data for realistic runs." },
      { id: "simulation/batching", title: "Batching & Sweeps", type: "doc", summary: "Parameter sweeps, batched execution APIs." },
      { id: "simulation/observability", title: "Observability", type: "doc", summary: "Metrics, logs, and reproducibility." },
    ],
  },
  {
    id: "api",
    title: "API & SDK",
    type: "folder",
    description: "Programmatic control surfaces",
    children: [
      { id: "api/rest", title: "REST API", type: "doc", summary: "Authentication, pagination, errors, and examples." },
      { id: "api/sdk", title: "TypeScript & Python SDKs", type: "doc", summary: "Client setup, retries, and typing hints." },
      { id: "api/webhooks", title: "Webhooks", type: "doc", summary: "Events, signing, and replay protection." },
    ],
  },
];

const docContent: Record<
  string,
  { title: string; lead: string; bullets: string[]; actions?: { label: string; href: string }[] }
> = {
  "platform/overview": {
    title: "Platform Overview",
    lead: "Uniq Quantum Hub orchestrates notebooks, execution backends, and compliance in one workspace.",
    bullets: [
      "Workspaces isolate notebooks, secrets, datasets, and runs per team or project.",
      "Execution plane connects to simulators and QPUs with policy-based routing.",
      "Built-in auditing records access, exports, and compute usage for compliance.",
    ],
    actions: [{ label: "View architecture diagram", href: "#" }],
  },
  "platform/access": {
    title: "Access & SSO",
    lead: "Map IdP groups to platform roles, enforce MFA, and scope secrets per workspace.",
    bullets: [
      "Supports SAML/OIDC with just-in-time user provisioning.",
      "Role mappings drive notebook permissions and run approvals.",
      "Rotate machine credentials with KMS-backed secret storage.",
    ],
  },
  "platform/projects": {
    title: "Projects & Workspaces",
    lead: "Use projects to group related notebooks, data, and scheduled runs.",
    bullets: [
      "Create templates for common workflows and enforce baseline kernels.",
      "Attach datasets with version pins for reproducible experiments.",
      "Schedule recurring runs with notifications to Slack/Email.",
    ],
  },
  "platform/auditing": {
    title: "Auditing & Compliance",
    lead: "Every action generates a verifiable audit event with export controls.",
    bullets: [
      "Export trails to SIEM with signed webhooks.",
      "Redaction rules keep secrets out of notebook diffs and logs.",
      "Retention policies per workspace with legal hold support.",
    ],
  },
  "multi-cloud/connections": {
    title: "Provider Connections",
    lead: "Connect IBM Quantum, AWS Braket, Azure Quantum, or on-prem targets.",
    bullets: [
      "Per-provider credentials stored in isolated vault namespaces.",
      "Health probes verify quotas, queue depth, and calibration freshness.",
      "Tag connections for routing policies (cost, latency, fidelity).",
    ],
  },
  "multi-cloud/routing": {
    title: "Job Routing",
    lead: "Route jobs by priority, estimated duration, and backend health signals.",
    bullets: [
      "Policy engine chooses best target and handles automatic failover.",
      "Cooldown windows prevent thrashing between providers.",
      "Supports manual pinning for validation runs.",
    ],
  },
  "multi-cloud/quotas": {
    title: "Quotas & Billing",
    lead: "Manage spend with hard limits, alerts, and tagged cost centers.",
    bullets: [
      "Set per-workspace credit budgets and alert thresholds.",
      "Attribute spend to projects via labels emitted on each run.",
      "Export usage to CSV or push directly to billing systems.",
    ],
  },
  "multi-cloud/security": {
    title: "Security Posture",
    lead: "Principle-of-least-privilege access with strong isolation.",
    bullets: [
      "Rotate provider keys automatically using the platform's KMS integration.",
      "Secrets never leave the control plane; ephemeral tokens used for jobs.",
      "Network policies restrict egress when running on managed clusters.",
    ],
  },
  "notebook/getting-started": {
    title: "Notebook Getting Started",
    lead: "Spin up a notebook kernel, connect to a backend, and run your first circuit.",
    bullets: [
      "Select kernels (Qiskit, Cirq, Braket) with pinned versions.",
      "Use cell-level routing to test locally then send to a QPU.",
      "Leverage starter templates for VQE, QAOA, and Grover.",
    ],
  },
  "notebook/versioning": {
    title: "Versioning & Checkpoints",
    lead: "Create checkpoints before big refactors and diff notebooks safely.",
    bullets: [
      "Automatic checkpoints on publish; restore from any point-in-time.",
      "Human-readable diffs that omit large binary outputs.",
      "Link checkpoints to experiment runs for reproducibility.",
    ],
  },
  "notebook/extensions": {
    title: "Extensions & AI Assist",
    lead: "Inline assistant suggests gates, optimizations, and unit tests.",
    bullets: [
      "Autocomplete is tuned for quantum APIs across providers.",
      "Run-time hints flag non-unitary operations or invalid pulse schedules.",
      "Templates accelerate common workflows (VQE, tomography, calibration).",
    ],
  },
  "notebook/hardware-targets": {
    title: "Hardware Targets",
    lead: "Run cells on local simulators, managed simulators, or real QPUs.",
    bullets: [
      "Preview queue depth and expected completion before dispatch.",
      "Noise-aware transpilation for the selected backend.",
      "Safety checks for shot counts, timeouts, and credit limits.",
    ],
  },
  "simulation/engines": {
    title: "Simulation Engines",
    lead: "Choose the right engine for accuracy vs. speed.",
    bullets: [
      "Statevector for small systems; tensor networks for larger circuits.",
      "Noise models mirror provider calibrations for realistic results.",
      "GPU acceleration available where supported.",
    ],
  },
  "simulation/calibration": {
    title: "Calibration Imports",
    lead: "Import calibration data to align simulations with hardware.",
    bullets: [
      "Upload T1/T2, gate fidelities, and crosstalk matrices.",
      "Schedule periodic refreshes from connected providers.",
      "Versioned calibration profiles keep experiments reproducible.",
    ],
  },
  "simulation/batching": {
    title: "Batching & Sweeps",
    lead: "Batch parameter sweeps and run them efficiently.",
    bullets: [
      "Vectorize parameters to minimize submission overhead.",
      "Chunk execution to honor provider rate limits.",
      "Collect results with consistent naming for downstream analysis.",
    ],
  },
  "simulation/observability": {
    title: "Simulation Observability",
    lead: "Understand performance and correctness of simulations.",
    bullets: [
      "Per-run metrics include memory, wall time, and fidelity estimates.",
      "Structured logs with circuit identifiers for correlation.",
      "Emit traces to your observability stack via OpenTelemetry.",
    ],
  },
  "api/rest": {
    title: "REST API",
    lead: "Stable, versioned REST endpoints for orchestration.",
    bullets: [
      "JWT or PAT auth with least-privilege scopes.",
      "Consistent pagination, idempotent retries, and typed errors.",
      "Download OpenAPI spec and generate clients.",
    ],
    actions: [{ label: "OpenAPI spec", href: "#" }],
  },
  "api/sdk": {
    title: "TypeScript & Python SDKs",
    lead: "Typed clients with retries, tracing, and streaming support.",
    bullets: [
      "Install via npm or pip with semver guarantees.",
      "Built-in middlewares for auth, logging, and metrics.",
      "Examples for submitting jobs, tracking status, and fetching results.",
    ],
  },
  "api/webhooks": {
    title: "Webhooks",
    lead: "Receive signed events for job lifecycle and audits.",
    bullets: [
      "Signatures use HMAC with rotation; validate before processing.",
      "Replay protection with idempotency keys and expirations.",
      "Includes job state, cost, target backend, and correlation ids.",
    ],
  },
};

function firstDocId(nodes: DocNode[]): string {
  for (const node of nodes) {
    if (node.type === "doc") return node.id;
    const nested = firstDocId(node.children);
    if (nested) return nested;
  }
  return "";
}

function filterTree(nodes: DocNode[], query: string): DocNode[] {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();
  return nodes
    .map((node) => {
      if (node.type === "doc") {
        return node.title.toLowerCase().includes(q) ? node : null;
      }
      const matchesSelf = node.title.toLowerCase().includes(q);
      const filteredChildren = filterTree(node.children, query);
      if (matchesSelf || filteredChildren.length) {
        return { ...node, children: filteredChildren };
      }
      return null;
    })
    .filter(Boolean) as DocNode[];
}

export default function Docs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(docsTree.map((folder) => folder.id))
  );
  const [selectedDoc, setSelectedDoc] = useState<string>(() => firstDocId(docsTree));

  const visibleTree = useMemo(() => filterTree(docsTree, searchQuery), [searchQuery]);
  const selected = docContent[selectedDoc];

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderNode = (node: DocNode, depth = 0) => {
    if (node.type === "folder") {
      const isOpen = expandedFolders.has(node.id);
      return (
        <div key={node.id} className="space-y-1">
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/70"
            onClick={() => toggleFolder(node.id)}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FolderTree className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{node.title}</span>
            {node.description && (
              <span className="ml-auto text-[11px] text-muted-foreground">{node.description}</span>
            )}
          </button>
          {isOpen && (
            <div className="space-y-1 border-l border-border pl-4">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedDoc === node.id;
    return (
      <button
        key={node.id}
        onClick={() => setSelectedDoc(node.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/70"
        }`}
      >
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-foreground">{node.title}</span>
        {node.badge && (
          <Badge variant="outline" className="ml-auto h-5 text-[10px]">
            {node.badge}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-start justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Updated documentation surface
            </div>
            <h1 className="text-3xl font-semibold text-foreground">Documentation</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse platform, multi-cloud, notebook, and simulation guides in a structured tree.
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <ExternalLink className="h-4 w-4" />
            Export, print, or open in new tab soon
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-[300px,1fr]">
        <Card className="border border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Library</CardTitle>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics..."
                className="pl-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto pr-2">
            {visibleTree.length ? (
              visibleTree.map((node) => renderNode(node))
            ) : (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                No matches found. Try another keyword.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-border/70">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary">
                  <BookOpen className="h-3.5 w-3.5" />
                  {selected ? selected.title : "Select a document"}
                </div>
                <CardTitle className="text-xl text-foreground">
                  {selected ? selected.title : "Documentation"}
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[11px]">
                Platform standard
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <p className="text-sm text-muted-foreground">{selected.lead}</p>
                  <div className="space-y-2">
                    {selected.bullets.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                      >
                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-sm text-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                  {selected.actions?.length ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selected.actions.map((action) => (
                        <a
                          key={action.label}
                          href={action.href}
                          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary"
                        >
                          {action.label}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Select a document from the left to view its details.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-foreground">Need more?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Provider status", href: "#" },
                { label: "CLI reference", href: "#" },
                { label: "Release notes", href: "#" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs text-foreground hover:border-primary hover:text-primary"
                >
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
