import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, Key, Palette, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [apiKeys, setApiKeys] = useState({
    ibm: "",
    groq: "",
    openai: "",
    google: "",
    braket: ""
  });

  useEffect(() => {
    const savedKeys = localStorage.getItem("user-api-keys");
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error("Error parsing saved API keys", e);
      }
    }
  }, []);

  const handleSaveKeys = () => {
    localStorage.setItem("user-api-keys", JSON.stringify(apiKeys));
    toast.success("API keys saved successfully");
  };

  const handleKeyChange = (provider: keyof typeof apiKeys, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  return (
    <div className="min-h-screen p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground">
                Manage your preferences and configurations
              </p>
            </div>
          </div>
          <Button onClick={handleSaveKeys} className="gap-2">
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>

        <div className="space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="w-5 h-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      {isDark ? "Currently using dark theme" : "Currently using light theme"}
                    </p>
                  </div>
                </div>
                <Switch checked={isDark} onCheckedChange={toggleTheme} />
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="w-5 h-5" />
                Model & Provider API Keys
              </CardTitle>
              <CardDescription>
                Configure your API keys for quantum providers and AI models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ibm-key">IBM Quantum API Key</Label>
                  <Input 
                    id="ibm-key"
                    type="password"
                    placeholder="Enter your IBM Quantum API key"
                    value={apiKeys.ibm}
                    onChange={(e) => handleKeyChange("ibm", e.target.value)}
                  />
                </div>
                
                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="groq-key">Groq API Key</Label>
                  <Input 
                    id="groq-key"
                    type="password"
                    placeholder="Enter your Groq API key"
                    value={apiKeys.groq}
                    onChange={(e) => handleKeyChange("groq", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input 
                    id="openai-key"
                    type="password"
                    placeholder="Enter your OpenAI API key"
                    value={apiKeys.openai}
                    onChange={(e) => handleKeyChange("openai", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-key">Google Gemini API Key</Label>
                  <Input 
                    id="google-key"
                    type="password"
                    placeholder="Enter your Google API key"
                    value={apiKeys.google}
                    onChange={(e) => handleKeyChange("google", e.target.value)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="braket-key">Amazon Braket API Key</Label>
                  <Input 
                    id="braket-key"
                    type="password"
                    placeholder="Enter your Amazon Braket API key"
                    value={apiKeys.braket}
                    onChange={(e) => handleKeyChange("braket", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your quantum jobs
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Job Completion Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when hardware jobs complete
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
