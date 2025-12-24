use std::collections::{HashMap, HashSet};

// ============================================================================
// CORE DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone)]
pub struct QuantumCircuit {
    pub num_qubits: usize,
    pub num_clbits: usize,
    pub gates: Vec<Gate>,
}

#[derive(Debug, Clone)]
pub struct Gate {
    pub name: String,
    pub qubits: Vec<usize>,
    pub params: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct BackendSpec {
    pub name: String,
    pub num_qubits: usize,
    pub coupling_map: Vec<(usize, usize)>,
    pub native_gates: HashSet<String>,
}

// ============================================================================
// SIMPLE QASM PARSER (MINIMAL BUT ROBUST ENOUGH FOR DEMO)
// ============================================================================

pub struct QASMParser;

impl QASMParser {
    pub fn parse(&self, input: &str) -> Result<QuantumCircuit, String> {
        let mut gates = Vec::new();
        let mut num_qubits = 0usize;
        let mut num_clbits = 0usize;

        for line in input.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with("//") {
                continue;
            }

            if line.starts_with("qreg") {
                // e.g. qreg q[3];
                let parts: Vec<&str> = line.split(&['[', ']'][..]).collect();
                if parts.len() >= 2 {
                    num_qubits = parts[1].parse().unwrap_or(0);
                }
            } else if line.starts_with("creg") {
                let parts: Vec<&str> = line.split(&['[', ']'][..]).collect();
                if parts.len() >= 2 {
                    num_clbits = parts[1].parse().unwrap_or(0);
                }
            } else if line.starts_with("cx")
                || line.starts_with("h")
                || line.starts_with("x")
                || line.starts_with("rz")
            {
                gates.push(self.parse_gate(line)?);
            }
        }

        Ok(QuantumCircuit {
            num_qubits,
            num_clbits,
            gates,
        })
    }

    fn parse_gate(&self, line: &str) -> Result<Gate, String> {
        // Examples:
        //   h q[0];
        //   cx q[0], q[1];
        //   rz(1.5708) q[0];
        let mut tokens = line.split_whitespace();
        let first = tokens
            .next()
            .ok_or_else(|| "empty gate line".to_string())?
            .trim_end_matches(';');

        // Extract name and optional parameter, e.g. "rz(1.57)"
        let (name, params) = if let Some(idx) = first.find('(') {
            let gate_name = &first[..idx];
            let rest = &first[idx + 1..];
            let angle_str = rest.trim_end_matches(')');
            let angle = angle_str.parse::<f64>().unwrap_or(0.0);
            (gate_name.to_string(), vec![angle])
        } else {
            (first.to_string(), Vec::new())
        };

        let line_qubits_part = line.split_whitespace().skip(1).collect::<Vec<_>>().join(" ");
        let mut qubits = Vec::new();
        for part in line_qubits_part.split(|c| c == '[' || c == ']' || c == ' ' || c == ';' || c == ',') {
            if let Ok(idx) = part.parse::<usize>() {
                qubits.push(idx);
            }
        }

        if qubits.is_empty() {
            return Err(format!("Failed to parse qubits from line: {line}"));
        }

        Ok(Gate { name, qubits, params })
    }
}

// ============================================================================
// SIMPLE ROUTER (CHECKS COUPLING MAP, INSERTS NAIVE SWAPS)
// ============================================================================

pub struct SimpleRouter;

impl SimpleRouter {
    pub fn route(&self, circuit: &QuantumCircuit, backend: &BackendSpec) -> QuantumCircuit {
        let mut out_gates = Vec::new();

        for g in &circuit.gates {
            if g.qubits.len() == 2 {
                let q1 = g.qubits[0];
                let q2 = g.qubits[1];
                let edge_ok = backend.coupling_map.contains(&(q1, q2))
                    || backend.coupling_map.contains(&(q2, q1));
                if !edge_ok {
                    // Insert a dummy SWAP before the gate (extremely naive)
                    out_gates.push(Gate {
                        name: "swap".to_string(),
                        qubits: vec![q1, q2],
                        params: vec![],
                    });
                }
            }
            out_gates.push(g.clone());
        }

        QuantumCircuit {
            num_qubits: circuit.num_qubits,
            num_clbits: circuit.num_clbits,
            gates: out_gates,
        }
    }
}

// ============================================================================
// SIMPLE OPTIMIZATION PASSES
// ============================================================================

pub trait OptimizationPass {
    fn optimize(&self, circuit: &QuantumCircuit) -> QuantumCircuit;
}

/// Cancels back‑to‑back self‑inverse gates on same qubits (x/x, h/h, cx/cx).
pub struct GateCancellationPass;

impl OptimizationPass for GateCancellationPass {
    fn optimize(&self, circuit: &QuantumCircuit) -> QuantumCircuit {
        let mut out = Vec::new();
        let mut i = 0;
        while i < circuit.gates.len() {
            if i + 1 < circuit.gates.len() {
                let g1 = &circuit.gates[i];
                let g2 = &circuit.gates[i + 1];
                if g1.name == g2.name && g1.qubits == g2.qubits {
                    // cancel pair
                    i += 2;
                    continue;
                }
            }
            out.push(circuit.gates[i].clone());
            i += 1;
        }
        QuantumCircuit {
            num_qubits: circuit.num_qubits,
            num_clbits: circuit.num_clbits,
            gates: out,
        }
    }
}

/// Merges consecutive RZ rotations on same qubit.
pub struct RotationMergingPass;

impl OptimizationPass for RotationMergingPass {
    fn optimize(&self, circuit: &QuantumCircuit) -> QuantumCircuit {
        let mut out = Vec::new();
        let mut i = 0;
        while i < circuit.gates.len() {
            let g = &circuit.gates[i];
            if g.name == "rz" && g.qubits.len() == 1 && !g.params.is_empty() {
                let q = g.qubits[0];
                let mut angle = g.params[0];
                let mut j = i + 1;
                while j < circuit.gates.len() {
                    let ng = &circuit.gates[j];
                    if ng.name == "rz" && ng.qubits == vec![q] && !ng.params.is_empty() {
                        angle += ng.params[0];
                        j += 1;
                    } else {
                        break;
                    }
                }
                if angle.abs() > 1e-10 {
                    out.push(Gate {
                        name: "rz".to_string(),
                        qubits: vec![q],
                        params: vec![angle],
                    });
                }
                i = j;
            } else {
                out.push(g.clone());
                i += 1;
            }
        }
        QuantumCircuit {
            num_qubits: circuit.num_qubits,
            num_clbits: circuit.num_clbits,
            gates: out,
        }
    }
}

// ============================================================================
// TRANSPILER ENGINE
// ============================================================================

pub struct TranspilationStats {
    pub original_depth: usize,
    pub final_depth: usize,
    pub original_gate_count: usize,
    pub final_gate_count: usize,
    pub depth_reduction: f64,
    pub gate_reduction: f64,
}

pub struct TranspilationResult {
    pub circuit: QuantumCircuit,
    pub stats: TranspilationStats,
}

pub struct UniversalTranspiler {
    parser: QASMParser,
    router: SimpleRouter,
    passes: Vec<Box<dyn OptimizationPass>>,
}

impl UniversalTranspiler {
    pub fn new() -> Self {
        Self {
            parser: QASMParser,
            router: SimpleRouter,
            passes: vec![Box::new(GateCancellationPass), Box::new(RotationMergingPass)],
        }
    }

    pub fn transpile(&self, input: &str, backend: &BackendSpec) -> Result<TranspilationResult, String> {
        // Parse
        let mut circ = self.parser.parse(input)?;
        let original_depth = Self::calculate_depth(&circ);
        let original_gate_count = circ.gates.len();

        // Route
        circ = self.router.route(&circ, backend);

        // Optimize
        for p in &self.passes {
            circ = p.optimize(&circ);
        }

        let final_depth = Self::calculate_depth(&circ);
        let final_gate_count = circ.gates.len();

        let depth_reduction = if original_depth == 0 {
            0.0
        } else {
            (original_depth.saturating_sub(final_depth)) as f64 / original_depth as f64 * 100.0
        };

        let gate_reduction = if original_gate_count == 0 {
            0.0
        } else {
            (original_gate_count.saturating_sub(final_gate_count)) as f64 / original_gate_count as f64 * 100.0
        };

        Ok(TranspilationResult {
            circuit: circ,
            stats: TranspilationStats {
                original_depth,
                final_depth,
                original_gate_count,
                final_gate_count,
                depth_reduction,
                gate_reduction,
            },
        })
    }

    fn calculate_depth(circuit: &QuantumCircuit) -> usize {
        if circuit.num_qubits == 0 {
            return 0;
        }
        let mut qubit_time = vec![0usize; circuit.num_qubits];
        for g in &circuit.gates {
            let start = g
                .qubits
                .iter()
                .map(|&q| qubit_time.get(q).cloned().unwrap_or(0))
                .max()
                .unwrap_or(0);
            let end = start + 1;
            for &q in &g.qubits {
                if q < qubit_time.len() {
                    qubit_time[q] = end;
                }
            }
        }
        qubit_time.into_iter().max().unwrap_or(0)
    }
}

// ============================================================================
// MAIN / DEMO
// ============================================================================

fn main() {
    // Backend with 5‑line chain coupling.
    let backend = BackendSpec {
        name: "ibm_demo".to_string(),
        num_qubits: 5,
        coupling_map: vec![(0, 1), (1, 2), (2, 3), (3, 4)],
        native_gates: ["x", "h", "cx", "rz"]
            .iter()
            .map(|s| s.to_string())
            .collect::<HashSet<String>>(),
    };

    let qasm = r#"
        OPENQASM 2.0;
        qreg q[3];
        creg c[3];
        h q[0];
        cx q[0], q[1];
        cx q[1], q[2];
        rz(1.5708) q[2];
        rz(1.5708) q[2];
    "#;

    let transpiler = UniversalTranspiler::new();

    match transpiler.transpile(qasm, &backend) {
        Ok(result) => {
            println!("Transpilation successful on backend {}!", backend.name);
            println!(
                "Depth: {} -> {} (reduction {:.2}%)",
                result.stats.original_depth, result.stats.final_depth, result.stats.depth_reduction
            );
            println!(
                "Gate count: {} -> {} (reduction {:.2}%)",
                result.stats.original_gate_count,
                result.stats.final_gate_count,
                result.stats.gate_reduction
            );
            println!("Final circuit gates:");
            for (i, g) in result.circuit.gates.iter().enumerate() {
                println!("{:3}: {:4} qubits={:?} params={:?}", i, g.name, g.qubits, g.params);
            }
        }
        Err(e) => {
            eprintln!("Transpilation failed: {e}");
        }
    }
}


