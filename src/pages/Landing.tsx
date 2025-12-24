import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, ShieldCheck, Sparkles, Mail } from "lucide-react";
import logoLight from "@/assets/logo-light.png";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const { setTheme } = useTheme();
  const logo = logoLight;
  const navigate = useNavigate();

  // Force light theme on landing
  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Nav */}
      <header className="w-full border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="UQuantum Labs" className="w-10 h-10 rounded-xl" />
          <span className="text-lg font-semibold">UQuantum Labs</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/docs")}>Docs</Button>
          <Button variant="ghost" onClick={() => navigate("/login")}>Login</Button>
          <Button variant="default" onClick={() => window.open("mailto:team@uquantumlabs.ai", "_blank")}>
            Connect With Team
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 space-y-12">
        <section className="text-center space-y-6">
          <p className="text-sm font-medium text-primary uppercase tracking-wide">One hub for quantum innovation</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            A unified workspace for researchers, labs, and students in quantum
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            UQuantum Labs brings Quantum Notebook, Quantum Cloud Multi-Connect, and Simulations together with collaborative tooling—so teams can build, test, and ship breakthroughs faster.
          </p>
          <div className="flex justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
              Login to start
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/docs")}>
              Explore Docs
            </Button>
          </div>
        </section>

        {/* Highlights */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, title: "Quantum Notebook", desc: "Prototype circuits, code, and research notes in one place." },
            { icon: ShieldCheck, title: "Quantum Cloud Multi-Connect", desc: "Connect to leading quantum providers securely and consistently." },
            { icon: BookOpen, title: "Simulations + Docs", desc: "Run curated simulations and browse docs freely without logging in." },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-xl border border-border bg-card/50 space-y-3">
              <div className="p-2 rounded-lg bg-primary/10 inline-flex">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-accent/10 to-background p-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Security-first access</p>
            <h2 className="text-2xl font-bold mt-2">Login is required to use core tools</h2>
            <p className="text-muted-foreground mt-2">
              Interact with AI Assistant, run notebooks, cloud connects, and simulations only after you sign in.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/login")}>
              <Mail className="w-4 h-4" />
              Login with Email
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

