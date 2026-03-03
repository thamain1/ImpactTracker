import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useOrganizations } from "@/hooks/use-organizations";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Send, Sparkles, AlertTriangle } from "lucide-react";
import { api } from "@shared/routes";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatPhase = "chat" | "review" | "submitting";

interface BuilderMessage {
  role: "user" | "assistant";
  content: string;
}

interface MetricConfig {
  name: string;
  unit: string;
  countsAsParticipant: boolean;
  itemType: string;
  unitCost: number | null;
  inventoryTotal: number | null;
  allocationType: string;
  allocationBaseQty: number;
  allocationThreshold: number | null;
  allocationBonusQty: number | null;
  customQuestionPrompt: string | null;
}

interface FinalProgram {
  orgId: number;
  name: string;
  description: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  targetPopulation: string;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  goals: string;
  locations: string;
  zipCode: string;
  budget: number | null;
  deliveryType: string;
  metrics: MetricConfig[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgramBuilderChat() {
  const [phase, setPhase]               = useState<ChatPhase>("chat");
  const [messages, setMessages]         = useState<BuilderMessage[]>([]);
  const [currentHint, setCurrentHint]   = useState("");
  const [inputValue, setInputValue]     = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [finalProgram, setFinalProgram] = useState<FinalProgram | null>(null);
  const [finalSummary, setFinalSummary] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [, navigate]  = useLocation();
  const { data: orgs } = useOrganizations();
  const { toast }      = useToast();

  const currentOrgId = orgs?.[0]?.id;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendToBuilder = useCallback(async (history: BuilderMessage[]) => {
    if (!currentOrgId) return;
    setIsLoading(true);
    try {
      const res  = await apiRequest("POST", "/api/program-builder/chat", {
        messages: history,
        orgId: currentOrgId,
      });
      const data = await res.json();

      if (data.done) {
        setFinalProgram(data.program);
        setFinalSummary(data.summary ?? "");
        setPhase("review");
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.question }]);
        setCurrentHint(data.hint ?? "");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "AI Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentOrgId, toast]);

  // Boot: fire first question when org is available
  useEffect(() => {
    if (!currentOrgId) return;
    sendToBuilder([]);
  }, [currentOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSend() {
    if (!inputValue.trim() || isLoading) return;
    const userMsg: BuilderMessage = { role: "user", content: inputValue.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputValue("");
    sendToBuilder(updated);
  }

  async function handleCreate() {
    if (!finalProgram) return;
    setPhase("submitting");
    try {
      const res     = await apiRequest("POST", api.programs.create.path, finalProgram);
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      navigate(`/programs/${created.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create program";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setPhase("review");
    }
  }

  function handleRestart() {
    setPhase("chat");
    setMessages([]);
    setCurrentHint("");
    setInputValue("");
    setFinalProgram(null);
    setFinalSummary("");
    // Re-boot
    if (currentOrgId) sendToBuilder([]);
  }

  // ── Loading org ──────────────────────────────────────────────────────────────
  if (!orgs) return null;

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <p className="text-muted-foreground">Please create an organization first.</p>
        <Link href="/programs">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Programs
          </Button>
        </Link>
      </div>
    );
  }

  // ── Review / Submitting phase ─────────────────────────────────────────────────
  if (phase === "review" || phase === "submitting") {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-heading font-bold text-slate-900">Review Program</h1>
          </div>
        </div>

        {/* AI Summary */}
        {finalSummary && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-teal-800 text-sm">
            {finalSummary}
          </div>
        )}

        {/* Program preview */}
        {finalProgram && (
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* Name + badges */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <h2 className="text-xl font-heading font-bold text-slate-900">{finalProgram.name}</h2>
                <div className="flex gap-2 flex-wrap">
                  {finalProgram.type && <Badge variant="outline">{finalProgram.type}</Badge>}
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800">
                    {finalProgram.status || "active"}
                  </Badge>
                </div>
              </div>

              {finalProgram.description && (
                <p className="text-sm text-muted-foreground">{finalProgram.description}</p>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {(finalProgram.startDate || finalProgram.endDate) && (
                  <div>
                    <span className="font-medium text-slate-700">Dates: </span>
                    <span className="text-muted-foreground">
                      {finalProgram.startDate || "—"} → {finalProgram.endDate || "Ongoing"}
                    </span>
                  </div>
                )}
                {finalProgram.targetPopulation && (
                  <div>
                    <span className="font-medium text-slate-700">Target Population: </span>
                    <span className="text-muted-foreground">{finalProgram.targetPopulation}</span>
                  </div>
                )}
                {(finalProgram.targetAgeMin != null || finalProgram.targetAgeMax != null) && (
                  <div>
                    <span className="font-medium text-slate-700">Age Range: </span>
                    <span className="text-muted-foreground">
                      {finalProgram.targetAgeMin ?? "?"} – {finalProgram.targetAgeMax ?? "?"}
                    </span>
                  </div>
                )}
                {finalProgram.locations && (
                  <div>
                    <span className="font-medium text-slate-700">Location: </span>
                    <span className="text-muted-foreground">{finalProgram.locations}</span>
                  </div>
                )}
                {finalProgram.budget != null && (
                  <div>
                    <span className="font-medium text-slate-700">Budget: </span>
                    <span className="text-muted-foreground">${finalProgram.budget.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {finalProgram.goals && (
                <div className="text-sm">
                  <span className="font-medium text-slate-700">Goals: </span>
                  <span className="text-muted-foreground">{finalProgram.goals}</span>
                </div>
              )}

              {/* Metrics */}
              {finalProgram.metrics.length === 0 ? (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>No metrics configured — you can add them manually after creating the program.</span>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Metrics</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Allocation</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Inventory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalProgram.metrics.map((m, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-3">
                              <div className="font-medium text-slate-800">{m.name}</div>
                              <div className="text-xs text-muted-foreground">{m.unit}</div>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${m.itemType === "physical_item" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}
                              >
                                {m.itemType === "physical_item" ? "Physical Item" : "Service"}
                              </Badge>
                              {m.countsAsParticipant && (
                                <div className="text-xs text-emerald-600 mt-1">Counts as participant</div>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {m.allocationType === "fixed"              && `Fixed (${m.allocationBaseQty ?? 1}/visit)`}
                              {m.allocationType === "family_size_scaled" && "Scaled by family size"}
                              {m.allocationType === "custom_question"    && "Custom question"}
                            </td>
                            <td className="p-3 text-muted-foreground text-xs">
                              {m.inventoryTotal != null ? m.inventoryTotal.toLocaleString() : "—"}
                              {m.unitCost != null && <div>${m.unitCost}/unit</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-between">
          <Button variant="outline" onClick={handleRestart} disabled={phase === "submitting"}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Start Over
          </Button>
          <Button onClick={handleCreate} disabled={phase === "submitting"}>
            {phase === "submitting" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
            ) : (
              "Create Program"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Chat phase ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center gap-4 bg-white shrink-0 sticky top-0 z-10">
        <Link href="/programs">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Programs
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="font-heading font-bold text-slate-900">Build with AI</h1>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) =>
          msg.role === "assistant" ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 px-4 py-3 text-sm leading-relaxed">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
                {msg.content}
              </div>
            </div>
          )
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 bg-white shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={currentHint || "Type your answer…"}
              className="resize-none min-h-[80px]"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="self-end"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Ctrl+Enter to send</span>
            <Link href="/programs/new" className="hover:text-primary transition-colors">
              Set up manually instead →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
