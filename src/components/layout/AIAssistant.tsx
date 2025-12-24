import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, ChevronDown, Copy, Check, MessageSquare, History, Plus, Code, HelpCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const defaultLlmModels = [
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
  { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
];

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Chat {
  id: string;
  title: string;
  mode: "ask" | "code";
  messages: Message[];
  modelId: string;
  createdAt: number;
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [customModels, setCustomModels] = useState<{ id: string, name: string }[]>([]);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const [newModel, setNewModel] = useState({ name: "", id: "" });

  const llmModels = [...defaultLlmModels, ...customModels];

  useEffect(() => {
    const savedModels = localStorage.getItem("user-custom-models");
    if (savedModels) {
      try {
        setCustomModels(JSON.parse(savedModels));
      } catch (e) {
        console.error("Error parsing custom models", e);
      }
    }
  }, []);

  const handleAddModel = () => {
    if (!newModel.name || !newModel.id) {
      toast.error("Please provide both name and model ID");
      return;
    }
    const updatedModels = [...customModels, newModel];
    setCustomModels(updatedModels);
    localStorage.setItem("user-custom-models", JSON.stringify(updatedModels));
    setNewModel({ name: "", id: "" });
    setIsAddModelOpen(false);
    toast.success("Model added successfully");
  };

  const removeCustomModel = (id: string) => {
    const updatedModels = customModels.filter(m => m.id !== id);
    setCustomModels(updatedModels);
    localStorage.setItem("user-custom-models", JSON.stringify(updatedModels));
    toast.success("Model removed");
  };

  const [chats, setChats] = useState<Chat[]>([
    {
      id: "1",
      title: "New Chat",
      mode: "ask",
      messages: [
        {
          id: "1",
          role: "assistant",
          content: "Hello! I'm your AI assistant. How can I help you with your quantum computing tasks today?",
        },
      ],
      modelId: llmModels[0]?.id || defaultLlmModels[0].id,
      createdAt: Date.now(),
    },
  ]);
  const [activeChatId, setActiveChatId] = useState<string>("1");
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = activeChat.messages;
  const selectedModel = llmModels.find((m) => m.id === activeChat.modelId) || llmModels[0];

  const createNewChat = (mode: "ask" | "code") => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: mode === "ask" ? "New Analysis" : "New Code Task",
      mode,
      messages: [
        {
          id: Date.now().toString(),
          role: "assistant",
          content: mode === "ask" 
            ? "I'm ready for a detailed analysis. What quantum concept or project shall we explore?" 
            : "I'm in coding mode. Send me your quantum algorithm requirements or code snippets!",
        },
      ],
      modelId: llmModels[0].id,
      createdAt: Date.now(),
    };
    setChats([newChat, ...chats]);
    setActiveChatId(newChat.id);
    setShowHistory(false);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newChats = chats.filter((c) => c.id !== id);
    if (newChats.length === 0) {
      const defaultChat: Chat = {
        id: Date.now().toString(),
        title: "New Chat",
        mode: "ask",
        messages: [{ id: "1", role: "assistant", content: "Hello!" }],
        modelId: llmModels[0].id,
        createdAt: Date.now(),
      };
      setChats([defaultChat]);
      setActiveChatId(defaultChat.id);
    } else {
      setChats(newChats);
      if (activeChatId === id) {
        setActiveChatId(newChats[0].id);
      }
    }
  };

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < 800) {
        setWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderContent = (content: string) => {
    const parts: { type: "text" | "code"; value: string }[] = [];
    const regex = /```([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: "code", value: match[1].trim() });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", value: content.slice(lastIndex) });
    }

    return (
      <div className="space-y-2">
        {parts.map((part, idx) =>
          part.type === "code" ? (
            <div key={`${part.type}-${idx}`} className="relative group">
              <pre
                className="w-full overflow-x-auto rounded-md bg-black/80 px-3 py-2 font-mono text-xs text-primary-foreground"
              >
                {part.value}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/20 hover:bg-background/40"
                onClick={() => copyToClipboard(part.value, `${part.type}-${idx}`)}
              >
                {copiedId === `${part.type}-${idx}` ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
          ) : (
            <p key={`${part.type}-${idx}`} className="whitespace-pre-wrap leading-relaxed">
              {part.value.trim()}
            </p>
          )
        )}
      </div>
    );
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const updatedMessages = [...activeChat.messages, userMessage];
    
    // Update chat locally immediately
    setChats(prev => prev.map(c => 
      c.id === activeChatId ? { ...c, messages: updatedMessages, title: c.messages.length === 1 ? input.slice(0, 30) + (input.length > 30 ? "..." : "") : c.title } : c
    ));
    
    setInput("");
    setLoading(true);

    try {
      const savedKeys = localStorage.getItem("user-api-keys");
      const apiKeys = savedKeys ? JSON.parse(savedKeys) : {};

      const res = await fetch(`${getApiBaseUrl()}/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          model: activeChat.modelId,
          mode: activeChat.mode, // Send mode to backend
          api_keys: apiKeys // Send all keys so backend can choose
        }),
      });
      const data = await res.json();
      let reply = "";
      if (data.choices && data.choices[0]?.message?.content) {
        reply = data.choices[0].message.content;
      } else if (data.result) {
        reply = data.result;
      } else if (data.error) {
        reply = `Error: ${data.error}`;
      } else {
        reply = "No valid response from the LLM model.";
      }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
      };
      
      setChats(prev => prev.map(c => 
        c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage] } : c
      ));
    } catch (err) {
      setChats(prev => prev.map(c => 
        c.id === activeChatId ? { ...c, messages: [...c.messages, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Error connecting to backend or LLM API.",
        }] } : c
      ));
    } finally {
      setLoading(false);
    }
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages, loading, activeChatId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-0 z-50 h-screen border-l border-border bg-card flex flex-col animate-slide-in shadow-2xl transition-[width] duration-75"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div 
        className={cn(
          "absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-primary/40 transition-colors z-50",
          isResizing && "bg-primary/60"
        )}
        onMouseDown={() => setIsResizing(true)}
      />

      {/* Header */}
      <div className="flex flex-col border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground text-sm">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-8 w-8", showHistory && "bg-accent")} 
              onClick={() => setShowHistory(!showHistory)}
              title="Chat History"
            >
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-primary/5 border-primary/20 hover:bg-primary/10">
                  <Plus className="w-3.5 h-3.5" />
                  New Chat
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => createNewChat("ask")} className="gap-2 py-2">
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">Ask Mode</span>
                    <span className="text-[10px] text-muted-foreground text-wrap">Detailed analysis & agentic reasoning</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createNewChat("code")} className="gap-2 py-2">
                  <Code className="w-4 h-4 text-green-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">Code Mode</span>
                    <span className="text-[10px] text-muted-foreground text-wrap">Pure coding focus & agentic assistance</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium gap-1 px-2">
                  {selectedModel?.name || "Select Model"}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Default Models
                </div>
                {defaultLlmModels.map((model) => (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => {
                      setChats(prev => prev.map(c => 
                        c.id === activeChatId ? { ...c, modelId: model.id } : c
                      ));
                    }}
                    className="text-xs"
                  >
                    {model.name}
                  </DropdownMenuItem>
                ))}
                
                {customModels.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Custom Models
                    </div>
                    {customModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        onClick={() => {
                          setChats(prev => prev.map(c => 
                            c.id === activeChatId ? { ...c, modelId: model.id } : c
                          ));
                        }}
                        className="text-xs flex items-center justify-between group"
                      >
                        {model.name}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-4 w-4 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomModel(model.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                
                <DropdownMenuSeparator />
                <Dialog open={isAddModelOpen} onOpenChange={setIsAddModelOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-xs text-primary focus:text-primary gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom Model
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Custom Model</DialogTitle>
                      <DialogDescription>
                        Enter the details of your custom LLM model.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Display Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g. My Custom GPT"
                          value={newModel.name}
                          onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="modelId">Model ID</Label>
                        <Input
                          id="modelId"
                          placeholder="e.g. gpt-4o-mini"
                          value={newModel.id}
                          onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddModelOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddModel}>Add Model</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
            activeChat.mode === "code" ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
          )}>
            {activeChat.mode === "code" ? <Code className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
            {activeChat.mode}
          </div>
        </div>
      </div>

      {/* History View Overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 w-full max-w-[280px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Recent Chats</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setShowHistory(false);
                    }}
                    className={cn(
                      "group flex flex-col p-3 rounded-lg cursor-pointer transition-colors relative",
                      activeChatId === chat.id ? "bg-primary/10" : "hover:bg-accent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 mb-1">
                        {chat.mode === "code" ? (
                          <Code className="w-3 h-3 text-green-500" />
                        ) : (
                          <HelpCircle className="w-3 h-3 text-blue-500" />
                        )}
                        <span className="text-xs font-semibold truncate max-w-[140px]">
                          {chat.title}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                        onClick={(e) => deleteChat(e, chat.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(chat.createdAt).toLocaleDateString()} • {chat.messages.length} messages
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {renderContent(message.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-muted text-foreground opacity-60">
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything... (Shift+Enter for new line, Enter to send)"
            className="flex-1 resize-none text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <Button onClick={handleSend} size="icon" disabled={loading}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
