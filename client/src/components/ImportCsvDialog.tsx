import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Download, FileText, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";

interface ImportCsvDialogProps {
  program: ProgramResponse;
  orgZip?: string;
}

type Step = "upload" | "preview" | "result";

interface ParsedRow {
  raw: Record<string, string>;
  valid: boolean;
  reason?: string;
}

// Simple but robust CSV parser — handles quoted fields, CRLF/LF
function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const headers = parseLine(lines[0]);
  const rows = lines
    .slice(1)
    .filter(l => l.trim() && !l.trim().startsWith("#"))
    .map(line => {
      const cells = parseLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
      return obj;
    });

  return { headers, rows };
}

export function ImportCsvDialog({ program, orgZip }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const metricNames = program.metrics.map(m => m.name);

  // --- Template download ---
  const downloadTemplate = () => {
    const fixedHeaders = [
      "date", "zip_code", "geography_level", "geography_value",
      ...metricNames,
      "demographics", "outcomes",
      "pct_completing_program", "pct_employment_gained",
      "pct_housing_secured", "pct_grade_improvement", "pct_recidivism_reduction",
    ];
    const exampleRow = [
      "01/15/26", orgZip || "90003", "", "",
      ...metricNames.map(() => "0"),
      "", "", "", "", "", "", "",
    ];
    const csv = [fixedHeaders.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impact_template_${program.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Parse + validate file ---
  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast({ title: "Invalid file", description: "Please upload a .csv file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { rows } = parseCSVText(text);

      if (rows.length === 0) {
        toast({ title: "Empty file", description: "No data rows found in the CSV.", variant: "destructive" });
        return;
      }

      const parsed: ParsedRow[] = rows.map(row => {
        // Accept MM/DD/YYYY and convert to YYYY-MM-DD for the API
        const rawDate = (row.date || "").trim();
        const mmddyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(rawDate);
        if (mmddyy) {
          const [, mm, dd, yy] = mmddyy;
          const yyyy = yy.length === 2 ? `20${yy}` : yy;
          row = { ...row, date: `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` };
        }
        if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date.trim()))
          return { raw: row, valid: false, reason: "Invalid/missing date (use MM/DD/YYYY)" };

        const hasZip = /^\d{5}$/.test((row.zip_code || "").replace(/\D/g, ""));
        const hasManualGeo = row.geography_level?.trim() && row.geography_value?.trim();
        // Fall back to org default zip when the row has no zip and no manual geography
        if (!hasZip && !hasManualGeo && orgZip) {
          row = { ...row, zip_code: orgZip };
        } else if (!hasZip && !hasManualGeo) {
          return { raw: row, valid: false, reason: "Missing geography (zip or level+value)" };
        }

        const hasMetric = metricNames.some(n => row[n] !== undefined && row[n] !== "");
        if (!hasMetric)
          return { raw: row, valid: false, reason: "No metric values found" };

        return { raw: row, valid: true };
      });

      setParsedRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // --- Import ---
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.valid).map(r => r.raw);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await apiRequest("POST", `/api/programs/${program.id}/import-csv`, { rows: validRows });
      const data = await res.json();
      setResult(data);
      setStep("result");
      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/impact"] });
        queryClient.invalidateQueries({ queryKey: ["/api/impact/stats"] });
      }
    } catch {
      toast({ title: "Import failed", description: "An error occurred during import.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("upload");
      setParsedRows([]);
      setResult(null);
      if (fileRef.current) fileRef.current.value = "";
    }, 200);
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-import-csv">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Import Impact Data
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to bulk-import impact entries for <span className="font-medium text-slate-700">{program.name}</span>.
          </p>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 my-2">
          {(["upload", "preview", "result"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex-1 text-center text-xs py-1.5 rounded-md font-medium transition-colors ${
                step === s ? "bg-primary text-primary-foreground" :
                (step === "preview" && s === "upload") || step === "result" ? "bg-primary/10 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < 2 && <div className="w-3 h-px bg-border shrink-0" />}
            </div>
          ))}
        </div>

        {/* ─── Step 1: Upload ─── */}
        {step === "upload" && (
          <div className="space-y-5 mt-2">
            {/* Download template */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Step 1 — Download the template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The template is pre-formatted with the correct columns for <span className="font-medium">{program.name}</span>.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-2" />
                Template CSV
              </Button>
            </div>

            {/* File drop zone */}
            <div>
              <p className="text-sm font-medium mb-2">Step 2 — Upload completed file</p>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                data-testid="csv-drop-zone"
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-slate-700">Drop your CSV here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileInput}
                data-testid="input-csv-file"
              />
            </div>

            {/* Format guide */}
            <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
              <p className="font-medium text-slate-600">Column guide:</p>
              <ul className="space-y-0.5 ml-3 list-disc">
                <li><span className="font-mono">date</span> — required, MM/DD/YY format</li>
                <li><span className="font-mono">zip_code</span> — 5-digit zip (auto-resolves SPA/city/county)</li>
                <li><span className="font-mono">geography_level + geography_value</span> — used if no zip provided</li>
                <li><span className="font-mono">{metricNames.join(", ")}</span> — numeric metric values</li>
                <li>Outcome % columns and demographics/outcomes are optional</li>
              </ul>
            </div>
          </div>
        )}

        {/* ─── Step 2: Preview ─── */}
        {step === "preview" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                  <XCircle className="w-3 h-3 mr-1" />
                  {invalidCount} will be skipped
                </Badge>
              )}
              <p className="text-xs text-muted-foreground ml-auto">{parsedRows.length} rows parsed</p>
            </div>

            {/* Preview table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">#</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Location</th>
                      {metricNames.map(n => (
                        <th key={n} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{n}</th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedRows.slice(0, 100).map((row, i) => {
                      const loc = row.raw.zip_code || `${row.raw.geography_value} (${row.raw.geography_level})`;
                      return (
                        <tr key={i} className={row.valid ? "" : "bg-red-50/50"}>
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 2}</td>
                          <td className="px-3 py-1.5 font-mono">{row.raw.date}</td>
                          <td className="px-3 py-1.5 max-w-[140px] truncate" title={loc}>{loc}</td>
                          {metricNames.map(n => (
                            <td key={n} className="px-3 py-1.5 text-right tabular-nums">{row.raw[n] || "—"}</td>
                          ))}
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {row.valid ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            ) : (
                              <span className="text-red-600 flex items-center gap-1" title={row.reason}>
                                <XCircle className="w-3 h-3" /> {row.reason}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2 border-t">
                  Showing first 100 of {parsedRows.length} rows — all {validCount} valid rows will be imported.
                </p>
              )}
            </div>

            {validCount === 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                No valid rows to import. Fix the issues above and re-upload.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); if (fileRef.current) fileRef.current.value = ""; }}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing} data-testid="button-confirm-import">
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                ) : (
                  <>Import {validCount} {validCount === 1 ? "entry" : "entries"}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Result ─── */}
        {step === "result" && result && (
          <div className="space-y-4 mt-2">
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              result.created > 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}>
              {result.created > 0 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-slate-800">
                  {result.created > 0
                    ? `${result.created} ${result.created === 1 ? "entry" : "entries"} imported successfully`
                    : "No entries were imported"}
                </p>
                {result.errors.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {result.errors.length} row{result.errors.length > 1 ? "s" : ""} skipped
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skipped rows</p>
                <div className="max-h-[180px] overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded px-2 py-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleClose} data-testid="button-close-import">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
