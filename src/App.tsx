import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  UserCheck, 
  X, 
  FileText, 
  FileSpreadsheet, 
  Brain, 
  Search, 
  HelpCircle, 
  Info,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";
import DragDropUploader from "./components/DragDropUploader";
import { Candidate, RedactionRAMStore, JobRequirements } from "./types";

// Pre-made templates for common roles as requested
const TEMPLATES = [
  {
    name: "SEO Specialist",
    text: "Dibutuhkan SEO Specialist berpengalaman minimal 3 tahun yang ahli dalam optimasi On-Page & Off-Page, riset kata kunci menggunakan Semrush/Ahrefs, memahami pembaruan algoritma Google Core, menguasai elemen-elemen teknis SEO, audit situs, optimalisasi kecepatan halaman, penulisan konten yang ramah SEO, dan berpengalaman mengoptimalkan peringkat organik situs di mesin pencari."
  },
  {
    name: "Content Writer",
    text: "Mencari Content Writer kreatif berpengalaman 1-3 tahun yang mahir menulis artikel bermutu tinggi, naskah blog ramah pembaca Indonesia, memahami dasar-dasar SEO copywriting, mampu melakukan riset topik mandiri, serta menyelaraskan tone-of-voice tulisan dengan kebutuhan merek/promosi fungsional."
  },
  {
    name: "Software Engineer",
    text: "Dibutuhkan Software Engineer dengan minimal 2 tahun pengalaman di React/Node.js, menguasai TypeScript, terbiasa dengan REST APIs, dan dapat berkolaborasi dengan baik dalam tim perkantoran."
  }
];

// Keywords list for highlight extraction
const CORE_TECH_KEYWORDS = [
  "react", "node", "typescript", "javascript", "vue", "angular", "html", "css", "laravel", 
  "scrum", "php", "sql", "nosql", "postgres", "mysql", "mongodb", "aws", "docker", "git", 
  "python", "java", "golang", "flutter", "kotlin", "swift", "express", "tailwind", "ui/ux",
  "seo", "semrush", "ahrefs", "copywriting", "content", "marketing", "editor", "on-page", 
  "off-page", "link building", "google analytics", "search console", "wordpress", "figma", 
  "cook", "chef", "culinary", "kitchen", "f&b"
];

// Helper to highlight found/missing keywords dynamically in side-drawer
const getKeywordsHighlight = (candText: string | undefined, reqText: string | undefined) => {
  if (!candText || !reqText) return { found: [], missing: [] };
  const cleanCand = candText.toLowerCase();
  const cleanReq = reqText.toLowerCase();
  
  const reqKeywords = CORE_TECH_KEYWORDS.filter(word => cleanReq.includes(word));
  const found = reqKeywords.filter(word => cleanCand.includes(word));
  // Filter out duplicates
  const uniqueFound = Array.from(new Set(found));
  const missing = reqKeywords.filter(word => !cleanCand.includes(word));
  const uniqueMissing = Array.from(new Set(missing));

  return { found: uniqueFound, missing: uniqueMissing };
};

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ramStore, setRamStore] = useState<RedactionRAMStore>({});
  const [blindMode, setBlindMode] = useState<boolean>(true);
  const [requirements, setRequirements] = useState<string>("");
  const [isSavingReqs, setIsSavingReqs] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [evaluatingAll, setEvaluatingAll] = useState<boolean>(false);
  const [evaluationMode, setEvaluationMode] = useState<"AI" | "Heuristics">("AI");
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showReevaluateConfirm, setShowReevaluateConfirm] = useState<boolean>(false);

  // New States: Editing status for textarea, selected candidates for bulk operations, toasts list, compact guide flag
  const [reqStatus, setReqStatus] = useState<"Synced" | "Editing">("Synced");
  const [localReqs, setLocalReqs] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "info" | "error" }[]>([]);
  const [showUserGuide, setShowUserGuide] = useState<boolean>(false);

  // Toast Notification manager
  const addToast = (message: string, type: "success" | "info" | "error" = "success") => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Load candidates and requirements from full-stack backend
  useEffect(() => {
    fetchRequirements();
    fetchCandidates();
  }, []);

  const fetchRequirements = async () => {
    try {
      const res = await fetch("/api/requirements");
      if (res.ok) {
        const data: JobRequirements = await res.json();
        setRequirements(data.requirementsText);
        setLocalReqs(data.requirementsText);
      }
    } catch (err) {
      console.error("Error fetching requirements:", err);
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await fetch("/api/candidates");
      if (res.ok) {
        const data: Candidate[] = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error("Error fetching candidates:", err);
    }
  };

  // Debounced auto-save of job requirements text
  useEffect(() => {
    if (reqStatus !== "Editing") return;

    const delayDebounceFn = setTimeout(async () => {
      setIsSavingReqs(true);
      try {
        const res = await fetch("/api/requirements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirementsText: localReqs })
        });
        if (res.ok) {
          setRequirements(localReqs);
          setReqStatus("Synced");
        }
      } catch (err) {
        console.error("Error autosaving requirements:", err);
      } finally {
        setIsSavingReqs(false);
      }
    }, 1000); // 1-second debounce delay

    return () => clearTimeout(delayDebounceFn);
  }, [localReqs, reqStatus]);

  // Save requirements directly/manually to backend
  const handleSaveRequirements = async (text: string) => {
    setRequirements(text);
    setLocalReqs(text);
    setIsSavingReqs(true);
    try {
      await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementsText: text })
      });
      setReqStatus("Synced");
    } catch (err) {
      console.error("Error saving requirements:", err);
    } finally {
      setIsSavingReqs(false);
    }
  };

  // Upload candidates to server
  const handleUploadSuccess = async (newCands: Candidate[], newRamStore: RedactionRAMStore) => {
    // 1. Update client RAM store
    setRamStore(prev => ({ ...prev, ...newRamStore }));

    // 2. Post candidates to server's candidates.json database
    const savedCands: Candidate[] = [];
    for (const cand of newCands) {
      try {
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cand)
        });
        if (res.ok) {
          const saved: Candidate = await res.json();
          savedCands.push(saved);
        }
      } catch (err) {
        console.error("Gagal menyimpan kandidat ke server:", err);
      }
    }

    addToast("CVs successfully masked locally", "success");

    // Refresh candidate list from server to get accurate sync status
    await fetchCandidates();
  };

  // Evaluate candidate
  const evaluateCandidate = async (id: string, forceHeuristicOverride?: boolean) => {
    // Set state to Evaluating first in frontend
    setCandidates(prev => 
      prev.map(c => c.id === id ? { ...c, status: "Evaluating" } : c)
    );

    try {
      console.log(`[FRONTEND EVALUATE] Starting request for candidate ID: ${id}`);
      const res = await fetch(`/api/candidates/${id}/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          forceHeuristic: forceHeuristicOverride !== undefined ? forceHeuristicOverride : (evaluationMode === "Heuristics")
        })
      });
      
      if (res.ok) {
        const updatedDesc: Candidate = await res.json();
        console.log(`[FRONTEND EVALUATE] Success for ID: ${id}. Evaluation result:`, updatedDesc);
        
        setCandidates(prev => 
          prev.map(c => c.id === id ? updatedDesc : c)
        );
        // Sync selected candidate modal too if it is open
        if (selectedCandidate && selectedCandidate.id === id) {
          setSelectedCandidate(updatedDesc);
        }
      } else {
        const responseText = await res.text();
        console.error(`[FRONTEND EVALUATE] Server assessment failed with status ${res.status}. Response text:`, responseText);
        
        let errorMsg = "Gagal melakukan evaluasi.";
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.error || errorMsg;
        } catch {
          if (responseText && responseText.trim().length > 0) {
            errorMsg = responseText;
          }
        }
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error(`[FRONTEND EVALUATE] Caught exception for candidate ID ${id}:`, err);
      setCandidates(prev => 
        prev.map(c => c.id === id ? { ...c, status: "Error", analysis: err.message } : c)
      );
      if (selectedCandidate && selectedCandidate.id === id) {
        setSelectedCandidate(prev => prev ? { ...prev, status: "Error", analysis: err.message } : null);
      }
    }
  };

  const runBatchEvaluation = async (toEvaluate: Candidate[]) => {
    setEvaluatingAll(true);
    console.log(`[FRONTEND EVALUATE ALL] Attempting simultaneous parallel batch evaluation for ${toEvaluate.length} candidate(s)...`);

    // Immediately show status as evaluating in frontend
    setCandidates((prev) =>
      prev.map((c) =>
        toEvaluate.some((t) => t.id === c.id) ? { ...c, status: "Evaluating" } : c
      )
    );

    try {
      // Attempt all simultaneously
      const results = await Promise.all(
        toEvaluate.map(async (cand) => {
          const res = await fetch(`/api/candidates/${cand.id}/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              forceHeuristic: evaluationMode === "Heuristics"
            })
          });
          if (!res.ok) {
            throw new Error(`Limit or error on ID: ${cand.tempNameId}`);
          }
          return await res.json();
        })
      );

      console.log("[FRONTEND EVALUATE ALL] Simultaneous parallel evaluation succeeded completely!");
      
      // Update state for all successfully
      setCandidates((prev) => {
        let updated = [...prev];
        results.forEach((updatedCand: Candidate) => {
          updated = updated.map((c) => (c.id === updatedCand.id ? updatedCand : c));
        });
        return updated;
      });

      addToast("Evaluation complete", "success");
    } catch (parallelErr) {
      console.warn(
        "[FRONTEND EVALUATE ALL] Simultaneous parallel evaluation encountered errors. Falling back to smooth sequential processing with rate-limit buffers...",
        parallelErr
      );
      addToast("API limit or issue detected. Processing sequentially...", "info");

      // Sequential fallback
      for (let idx = 0; idx < toEvaluate.length; idx++) {
        const cand = toEvaluate[idx];
        if (idx > 0) {
          // Pause 2.5 seconds to bypass API quotas
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        await evaluateCandidate(cand.id);
      }

      addToast("Evaluation complete", "success");
    } finally {
      setEvaluatingAll(false);
    }
  };

  // Mulai Penilaian Buta: Evaluate all candidates that are not scored yet or need evaluation
  const handleEvaluateAll = async () => {
    const unevaluated = candidates.filter(
      (c) => c.status === "Parsing/Loading" || c.status === "Error"
    );
    if (unevaluated.length === 0 && candidates.length > 0) {
      // Prompt user to re-evaluate all via state dialog instead of window.confirm
      setShowReevaluateConfirm(true);
    } else {
      await runBatchEvaluation(unevaluated);
    }
  };

  // Individual Candidate Deletion
  const handleDeleteCandidate = async (id: string) => {
    const check = window.confirm("Apakah Anda yakin ingin menghapus berkas lamaran kandidat ini?");
    if (!check) return;
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== id));
        if (selectedCandidate && selectedCandidate.id === id) {
          setSelectedCandidate(null);
        }
        setSelectedIds((prev) => prev.filter((item) => item !== id));
        addToast("Candidate successfully deleted", "success");
      }
    } catch (err) {
      console.error("Failed to delete candidate:", err);
      addToast("Failed to delete candidate", "error");
    }
  };

  // Bulk Candidate Deletion
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const check = window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} berkas lamaran terpilih sekaligus?`);
    if (!check) return;
    try {
      const res = await fetch("/api/candidates/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
        if (selectedCandidate && selectedIds.includes(selectedCandidate.id)) {
          setSelectedCandidate(null);
        }
        addToast(`${selectedIds.length} candidates successfully deleted`, "success");
        setSelectedIds([]);
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);
      addToast("Bulk deletion failed", "error");
    }
  };

  // Bulk Candidate Evaluation
  const handleBulkEvaluate = async () => {
    const toEval = candidates.filter((c) => selectedIds.includes(c.id));
    if (toEval.length === 0) return;
    await runBatchEvaluation(toEval);
    setSelectedIds([]);
  };

  // Triggers the state-based layout reset confirmation modal
  const handleResetInitiate = () => {
    setShowResetConfirm(true);
  };

  // Reset database candidates.json and clear RAM memory stores completely
  const handleResetDirectly = async () => {
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (res.ok) {
        setCandidates([]);
        setRamStore({});
        setSelectedCandidate(null);
        setBlindMode(true);
        setSearchQuery("");
        setEvaluatingAll(false);
      }
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  // Stats calculation
  const totalCVs = candidates.length;
  const pendingCount = candidates.filter(c => c.status === "Parsing/Loading" || c.status === "Evaluating").length;
  const evaluatedCandidates = candidates.filter(c => typeof c.score === "number");
  const averageScore = evaluatedCandidates.length > 0
    ? (evaluatedCandidates.reduce((sum, c) => sum + (c.score || 0), 0) / evaluatedCandidates.length).toFixed(1)
    : "0.0";

  // Filter & Rank Candidates
  const filteredCandidates = candidates.filter(c => {
    const term = searchQuery.toLowerCase();
    const tempIdMatch = c.tempNameId.toLowerCase().includes(term);
    const filenameMatch = c.originalFilename.toLowerCase().includes(term);
    const ramInfo = ramStore[c.tempNameId];
    const realNameMatch = (!blindMode && ramInfo && ramInfo.realName.toLowerCase().includes(term));
    const skillMatch = c.analysis?.toLowerCase().includes(term);
    return tempIdMatch || filenameMatch || realNameMatch || skillMatch;
  });

  // Sort candidates by score descending, then by uploadedAt descending
  const rankedCandidates = [...filteredCandidates].sort((a, b) => {
    const scoreA = typeof a.score === "number" ? a.score : -1;
    const scoreB = typeof b.score === "number" ? b.score : -1;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  });

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden" id="app-wrapper">
      
      {/* Left Sidebar */}
      <aside className="w-80 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800" id="left-sidebar">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2" id="privacy-badge">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy Guard Active
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-tight" id="sidebar-title">
            The Blind Recruiter
          </h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1 font-mono">
            Unbiased Smart Recruitment
          </p>
        </div>

        {/* Sidebar Contents */}
        <div className="p-6 flex-1 flex flex-col justify-between overflow-y-auto" id="sidebar-body">
          <div className="flex-1 flex flex-col mb-6">
            {/* Saved Templates Dropdown wrapper */}
            <div className="mb-4" id="templates-selector-container">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5 font-mono">
                Templat Lowongan (Templates)
              </label>
              <select
                onChange={(e) => {
                  const selectedName = e.target.value;
                  const foundTemplate = TEMPLATES.find(t => t.name === selectedName);
                  if (foundTemplate) {
                    setLocalReqs(foundTemplate.text);
                    handleSaveRequirements(foundTemplate.text);
                    addToast(`Loaded template: ${selectedName}`, "success");
                  }
                }}
                className="w-full bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans transition-all cursor-pointer font-medium"
                id="template-select-dropdown"
                defaultValue=""
              >
                <option value="" disabled>-- Pilih Templat Jabatan --</option>
                {TEMPLATES.map((tmpl, idx) => (
                  <option key={idx} value={tmpl.name} className="bg-slate-900 text-slate-250">
                    {tmpl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Syarat Kriteria Lowongan
              </label>
              {isSavingReqs ? (
                <span className="text-[10px] text-amber-500 italic animate-pulse">Saving...</span>
              ) : reqStatus === "Editing" ? (
                <span className="text-[9px] text-amber-500 font-mono animate-pulse bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">Editing...</span>
              ) : (
                <span className="text-[9px] text-emerald-500 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">Synced</span>
              )}
            </div>

            <textarea
              className="flex-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-3.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-sans min-h-[160px] leading-relaxed transition-all"
              placeholder="Ketik kriteria seleksi kandidat di sini. Contoh: S1 Informatika, 2 tahun pengalaman React, menguasai TypeScript, dll..."
              value={localReqs}
              onChange={(e) => {
                setLocalReqs(e.target.value);
                setReqStatus("Editing");
              }}
              id="job-requirements-input"
            />
            
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed bg-slate-800/40 p-2.5 rounded-md border border-slate-800/80">
              <Info className="w-3.5 h-3.5 text-emerald-400 inline mr-1 mb-0.5" />
              AI akan mencocokkan kualifikasi ini secara buta tanpa bias identitas.
            </p>
          </div>

          <div className="space-y-3 bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60 mb-4 text-xs">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">
              Model Penilaian (Evaluation Engine)
            </label>
            <div className="flex gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setEvaluationMode("AI")}
                className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] uppercase transition-all ${
                  evaluationMode === "AI"
                    ? "bg-emerald-600 text-white shadow-sm font-sans"
                    : "text-slate-400 hover:text-white font-sans"
                }`}
                id="engine-ai-btn"
              >
                Gemini 3.5 AI
              </button>
              <button
                type="button"
                onClick={() => setEvaluationMode("Heuristics")}
                className={`flex-1 py-1.5 px-2 rounded font-bold text-[10px] uppercase transition-all ${
                  evaluationMode === "Heuristics"
                    ? "bg-amber-600 text-white shadow-sm font-sans"
                    : "text-slate-400 hover:text-white font-sans"
                }`}
                id="engine-heuristic-btn"
              >
                Local Heuristic
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-sans font-medium">
              {evaluationMode === "AI" 
                ? "Mengevaluasi cerdas lewat Gemini AI. Bila limit, otomatis beralih ke Lokal." 
                : "Menggunakan kriteria pencocokan kata kunci server lokal yang kencang & bebas kuota."}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleEvaluateAll}
              disabled={candidates.length === 0 || evaluatingAll}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                candidates.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850"
                  : evaluatingAll
                  ? "bg-amber-600 text-white cursor-wait"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 cursor-pointer hover:scale-[1.01]"
              }`}
              id="action-btn-evaluate-all"
            >
              {evaluatingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mengevaluasi...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Mulai Penilaian Buta
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 text-[10px] border-t border-slate-800 text-slate-500 font-mono leading-relaxed" id="sidebar-footer">
          LOCAL PII MASKING: Real names, emails, and telps are redacted in browser RAM. No sensitive data leaked to server.
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden" id="main-content-panel">
        
        {/* Top Stats Bar */}
        <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0" id="top-stats-header">
          <div className="flex gap-8" id="stats-container">
            <div className="flex flex-col" id="stat-total-cv">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total CVs</span>
              <span className="text-2xl font-bold text-slate-800 font-mono mt-1">
                {String(totalCVs).padStart(2, "0")}
              </span>
            </div>
            
            <div className="flex flex-col border-l border-slate-200 pl-8" id="stat-pending">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-sans">Pending / Loading</span>
              <span className="text-2xl font-bold text-slate-800 font-mono mt-1">
                {String(pendingCount).padStart(2, "0")}
              </span>
            </div>

            <div className="flex flex-col border-l border-slate-200 pl-8" id="stat-avg-score">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Average Score</span>
              <span className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                {averageScore}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3" id="top-bar-actions">
            {/* Blind Mode Toggle Switches */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200" id="blind-toggle-container">
              <button
                type="button"
                onClick={() => setBlindMode(true)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                  blindMode
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="btn-blind-mode"
              >
                <EyeOff className="w-3.5 h-3.5" />
                Blind Mode
              </button>
              
              <button
                type="button"
                onClick={() => setBlindMode(false)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                  !blindMode
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="btn-reveal-names"
              >
                <Eye className="w-3.5 h-3.5" />
                Reveal Names
              </button>
            </div>

            {/* Global Reset Database */}
            <button
              onClick={handleResetInitiate}
              className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors hover:bg-rose-50 cursor-pointer relative z-10"
              title="Reset Database"
              id="btn-reset-db"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Scrollable Layout Content */}
        <div className="p-8 flex-1 overflow-y-auto flex flex-col gap-6" id="scrollable-content">
          
          {/* Warn about Tab refresh RAM memory limitation if Reveal is active */}
          {!blindMode && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in" id="ram-notice">
              <Info className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
              <span>
                <strong>Perhatian Privasi:</strong> Data asli tersimpan eksklusif di dalam memori <strong>RAM</strong> browser Anda. Menyegarkan tab ini (Page Refresh) akan mengosongkan RAM pemetaan nama asli guna melindungi kerahasiaan kandidat.
              </span>
            </div>
          )}

          {/* Secure Client Drag & Drop Uploader */}
          <DragDropUploader 
            onUploadSuccess={handleUploadSuccess} 
            existingCount={candidates.length} 
          />

          {/* Table Area Component */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm min-h-[300px]" id="ranking-container">
            
            {/* Table Search & Controls Bar with Bulk Actions support */}
            <div className="px-6 py-4.5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              {selectedIds.length > 0 ? (
                <div className="flex-1 flex flex-col sm:flex-row justify-between items-center bg-emerald-50 border border-emerald-100 rounded-xl px-4.5 py-2.5 gap-3 animate-in slide-in-from-top duration-150" id="bulk-action-bar">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold font-mono">
                      {selectedIds.length}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">kandidat dipilih untuk aksi massal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBulkEvaluate}
                      disabled={evaluatingAll}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:bg-slate-400"
                      id="bulk-evaluate-btn"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      Bulk AI Evaluate
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      id="bulk-delete-btn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Bulk Delete
                    </button>
                    <button
                      onClick={() => setSelectedIds([])}
                      className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-[11px] font-bold rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                      id="bulk-cancel-btn"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800" id="table-header-title">Daftar Peringkat Kandidat</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">CV otomatis diurutkan secara obyektif berdasarkan skor kecocokan tertinggi</p>
                  </div>

                  {/* Search Candidate */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-405" />
                    <input
                      type="text"
                      placeholder="Cari kandidat ID, filet, atau isi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                      id="cv-search-input"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Table Header containing Select All */}
            <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono" id="table-column-headers">
              <div className="col-span-1 flex items-center">
                <input
                  type="checkbox"
                  checked={rankedCandidates.length > 0 && selectedIds.length === rankedCandidates.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(rankedCandidates.map((c) => c.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-550 cursor-pointer"
                  id="select-all-candidates-checkbox"
                />
              </div>
              <span className="col-span-2">Kandidat ID / Berkas</span>
              <span className="col-span-3">Identitas Asli (RAM)</span>
              <span className="col-span-2">Skor Kecocokan</span>
              <span className="col-span-2">Status Penilaian</span>
              <span className="col-span-2 text-right text-slate-500">Aksi</span>
            </div>

            {/* Candidate List rows container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100" id="candidate-rows">
              {rankedCandidates.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <FileText className="w-10 h-10 text-slate-350 stroke-1" />
                  <p className="text-sm font-medium">Belum ada CV kandidat yang diunggah</p>
                  <p className="text-xs text-slate-400 max-w-sm font-sans leading-relaxed">
                    Silakan seret file .pdf atau .txt ke zona unggah di atas untuk mulai menilai kualifikasi tim secara adil.
                  </p>
                </div>
              ) : (
                rankedCandidates.map((cand) => {
                  const ramInfo = ramStore[cand.tempNameId];
                  const hasRamRecord = !!ramInfo;
                  const isChecked = selectedIds.includes(cand.id);

                  return (
                    <div 
                      key={cand.id} 
                      className={`grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/70 transition-colors ${
                        cand.status === "Evaluating" ? "bg-amber-50/25 border-y border-amber-100/50" : isChecked ? "bg-slate-50/50" : ""
                      }`}
                      id={`row-${cand.id}`}
                    >
                      {/* Individual Checkbox */}
                      <div className="col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, cand.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== cand.id));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                          id={`select-candidate-${cand.id}`}
                        />
                      </div>

                      {/* Temporary Public ID & Filename */}
                      <div className="col-span-2 flex flex-col pr-3">
                        <span className="text-sm font-bold font-mono text-slate-800">
                          {cand.tempNameId}
                        </span>
                        <span className="text-xs text-slate-400 truncate mt-0.5 font-sans" title={cand.originalFilename}>
                          {cand.originalFilename}
                        </span>
                      </div>

                      {/* Decoded Personal Information (Visible only if Blind Mode disabled) */}
                      <div className="col-span-3 flex flex-col pr-3">
                        {blindMode ? (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className="text-[9px] font-mono tracking-widest uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-205">
                              [SENSITIVE]
                            </span>
                          </div>
                        ) : hasRamRecord ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">
                              {ramInfo.realName}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                              {ramInfo.email} • {ramInfo.phone}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-500 italic flex items-center gap-1 bg-rose-50 px-2 py-1 rounded w-max border border-rose-100 font-sans scale-95 origin-left">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Session Expired / Re-upload
                          </span>
                        )}
                      </div>

                      {/* Match Score progression bar with dynamic processing indicator */}
                      <div className="col-span-2 pr-3">
                        {cand.status === "Evaluating" ? (
                          <div className="flex flex-col gap-1 w-full max-w-[110px]" id={`eval-prog-${cand.id}`}>
                            <div className="flex items-center justify-between text-[9px] text-amber-600 font-mono animate-pulse">
                              <span>Assessing...</span>
                            </div>
                            <div className="w-full h-1.5 bg-amber-50 rounded-full overflow-hidden border border-amber-100">
                              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "65%" }}></div>
                            </div>
                          </div>
                        ) : typeof cand.score === "number" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                              <div 
                                className={`h-full rounded-full ${
                                  cand.score >= 80 
                                    ? "bg-emerald-500" 
                                    : cand.score >= 60 
                                    ? "bg-amber-500" 
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${cand.score}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-700 font-mono">
                              {cand.score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic font-sans">Belum dinilai</span>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="col-span-2">
                        {cand.status === "Parsing/Loading" ? (
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100 uppercase tracking-wide font-sans">
                            Ditambahkan
                          </span>
                        ) : cand.status === "Evaluating" ? (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full border border-amber-100 uppercase tracking-wide inline-flex items-center gap-1 animate-pulse font-sans">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Evaluating
                          </span>
                        ) : cand.status === "Approved" ? (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-150 uppercase tracking-wide inline-flex items-center gap-1 font-sans">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            Disetujui
                          </span>
                        ) : cand.status === "Rejected" ? (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wide inline-flex items-center gap-1 font-sans">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Ditolak
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5 items-start">
                            <span 
                              className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2.5 py-0.5 rounded-full border border-rose-100 uppercase tracking-wide cursor-help inline-block truncate max-w-[100px]" 
                              title={cand.analysis}
                            >
                              Gagal AI
                            </span>
                            <button
                              onClick={() => evaluateCandidate(cand.id, true)}
                              className="text-[9px] text-amber-600 hover:text-amber-700 hover:underline font-mono font-bold leading-none cursor-pointer"
                              title="Tekan untuk mengevaluasi instan menggunakan Aturan Heuristik Lokal bebas kuota"
                              id={`fallback-heuristic-btn-${cand.id}`}
                            >
                              ⚙️ Gunakan Lokal
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Individual and Modal detailed actions column */}
                      <div className="col-span-2 text-right">
                        <div className="inline-flex items-center gap-2.5 justify-end w-full">
                          {cand.status === "Parsing/Loading" || cand.status === "Error" ? (
                            <button
                              onClick={() => evaluateCandidate(cand.id)}
                              className="text-emerald-600 text-xs font-bold hover:underline cursor-pointer"
                            >
                              Nilai CV
                            </button>
                          ) : null}
                          <button
                            onClick={() => setSelectedCandidate(cand)}
                            className="text-blue-600 text-xs font-bold hover:underline cursor-pointer bg-blue-50/50 hover:bg-blue-50 px-2 py-1 rounded border border-blue-100/50"
                          >
                            Rincian
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(cand.id)}
                            className="p-1 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                            title="Hapus candidate"
                            id={`delete-cand-${cand.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Collapsible How to Use Guide Section (Layout Optimization for vertical expansion room) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="user-guide-section">
            <button
              onClick={() => setShowUserGuide(!showUserGuide)}
              className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-50/50 hover:bg-slate-50 select-none cursor-pointer transition-all"
              id="guide-toggle-button"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-emerald-650" />
                <h3 className="text-xs font-bold text-slate-800 font-sans" id="guide-header-title">
                  How to Use The Blind Recruiter (Sistem Petunjuk Penggunaan)
                </h3>
              </div>
              <div className="text-slate-405">
                {showUserGuide ? (
                  <span className="text-[10px] font-bold text-slate-505 uppercase flex items-center gap-1">Collapse ✕</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-505 uppercase flex items-center gap-1">Expand ⚙️</span>
                )}
              </div>
            </button>
            
            {showUserGuide && (
              <div className="px-6 pb-6 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                <ul className="space-y-4 text-xs text-slate-600 font-sans animate-fade-in" id="guide-bullets-list">
                  <li className="flex items-start gap-2.5" id="guide-li-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 font-mono">1</span>
                    <span className="leading-relaxed font-sans font-medium">
                      <strong>Step 1: Input Job Requirements</strong> — Type or paste the ideal candidate criteria in the left sidebar panel or select from pre-made templates instantly.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5" id="guide-li-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 font-mono">2</span>
                    <span className="leading-relaxed font-sans font-medium">
                      <strong>Step 2: Upload CVs</strong> — Drag and drop up to 10 CV files (PDF/TXT) into the upload zone. The local shield will instantly anonymize sensitive data.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5" id="guide-li-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 font-mono">3</span>
                    <span className="leading-relaxed font-sans font-medium">
                      <strong>Step 3: Run AI Evaluation</strong> — Click the green "MULAI PENILAIAN BUTA" button to securely analyze candidate compatibility in a fast parallel batch.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5" id="guide-li-4">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 font-mono">4</span>
                    <span className="leading-relaxed font-sans font-medium">
                      <strong>Step 4: Review and Toggle</strong> — Check the ranking table scores. Toggle "Reveal Names" to see original names, or click "Reset" to start over.
                    </span>
                  </li>
                </ul>
              </div>
            )}        </div>

        </div>
      </main>

      {/* Sliding Right-side Drawer for Candidate Details */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex justify-end" id="candidate-detail-drawer">
          {/* Backdrop with elegant fade transition */}
          <div 
            onClick={() => setSelectedCandidate(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 pointer-events-auto"
            id="drawer-backdrop"
          ></div>

          {/* Drawer content sliding in from the right */}
          <div 
            className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 ease-out z-10"
            id="drawer-panel"
          >
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between" id="drawer-header">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-950 font-sans tracking-tight">
                    {selectedCandidate.tempNameId}
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedCandidate.originalFilename}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-sans">
                  Sistem Analisis Penilaian Buta Aliansi AI & Lokal
                </p>
              </div>
              <button 
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-405 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                id="drawer-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin" id="drawer-scroll-body">
              
              {/* RAM Real Identity Mask section */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-2.5 font-mono">
                  Identitas Asli (Akses RAM Lokal Browser)
                </h4>
                {blindMode ? (
                  <div className="p-3 bg-slate-200/50 rounded-lg text-xs text-slate-550 flex items-center gap-2 border border-slate-200 font-mono">
                    <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    DATA REKRUTMEN BUTA AKTIF: Nonaktifkan "Blind Mode" di bar atas untuk memulihkan info kontak RAM.
                  </div>
                ) : ramStore[selectedCandidate.tempNameId] ? (
                  <div className="grid grid-cols-1 gap-2.5 font-sans">
                    <div className="bg-white p-2.5 rounded border border-slate-150 animate-fade-in">
                      <span className="text-[9px] font-semibold text-slate-400 block font-mono">NAMA KANDIDAT:</span>
                      <span className="text-xs font-bold text-slate-800">{ramStore[selectedCandidate.tempNameId].realName}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-150 animate-fade-in">
                      <span className="text-[9px] font-semibold text-slate-400 block font-mono">SUREL / EMAIL:</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{ramStore[selectedCandidate.tempNameId].email}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-150 animate-fade-in">
                      <span className="text-[9px] font-semibold text-slate-400 block font-mono">NOMOR TELEPON:</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{ramStore[selectedCandidate.tempNameId].phone}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-xs flex items-center gap-2 font-sans">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Kunci identitas RAM terhapus karena penyegaran tab mendadak. Informasi asli pada sesi ini tidak lagi tersedia.
                  </div>
                )}
              </div>

              {/* Match Score Indicator */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-1 font-sans">Skor Kecocokan</span>
                  {typeof selectedCandidate.score === "number" ? (
                    <>
                      <span className="text-2xl font-black text-emerald-600 font-mono my-1.5">
                        {selectedCandidate.score}%
                      </span>
                      <span className="text-[9px] text-slate-400 font-sans">Kalkulasi Kriteria Buta</span>
                    </>
                  ) : (
                    <span className="text-slate-405 text-xs italic font-sans my-2">Belum dievaluasi</span>
                  )}
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-1 font-sans">Rekomendasi</span>
                  {selectedCandidate.status === "Approved" ? (
                    <div className="text-emerald-700 font-bold text-[10px] uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 mt-2 font-sans inline-flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      Disetujui
                    </div>
                  ) : selectedCandidate.status === "Rejected" ? (
                    <div className="text-slate-650 font-bold text-[10px] uppercase bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 mt-2 font-sans inline-flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-slate-450" />
                      Ditolak
                    </div>
                  ) : selectedCandidate.status === "Evaluating" ? (
                    <div className="text-amber-500 font-bold text-[10px] uppercase bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 mt-2 animate-pulse font-sans">
                      Sedang Dinilai
                    </div>
                  ) : (
                    <div className="text-slate-404 text-xs italic mt-2 font-sans">Kriteria kosong</div>
                  )}
                </div>
              </div>

              {/* Score Breakdown Section */}
              {typeof selectedCandidate.score === "number" && (
                (() => {
                  const breakdown = selectedCandidate.scoreBreakdown || {
                    technicalSkills: Math.round(selectedCandidate.score * 0.4),
                    workExperience: Math.round(selectedCandidate.score * 0.3),
                    projectImpact: Math.round(selectedCandidate.score * 0.3)
                  };
                  return (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3.5" id="score-breakdown-panel">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-1.5 font-mono">
                        Rincian Breakdown Nilai (Maks 100)
                      </h4>
                      <div className="space-y-3">
                        {/* Technical Skills: Max 40 */}
                        <div>
                          <div className="flex justify-between items-center text-[11px] mb-1">
                            <span className="font-semibold text-slate-700 font-sans">1. Korelasi Skill Teknis</span>
                            <span className="font-mono font-bold text-slate-900">{breakdown.technicalSkills} <span className="text-slate-400 font-normal">/ 40</span></span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(breakdown.technicalSkills / 40) * 100}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Work Experience: Max 30 */}
                        <div>
                          <div className="flex justify-between items-center text-[11px] mb-1">
                            <span className="font-semibold text-slate-700 font-sans flex items-center gap-1">
                              2. Kedalaman Pengalaman Kerja
                            </span>
                            <span className="font-mono font-bold text-slate-900">{breakdown.workExperience} <span className="text-slate-400 font-normal">/ 30</span></span>
                          </div>
                          <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(breakdown.workExperience / 30) * 105}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] text-slate-500 block mt-1 leading-tight font-sans">
                            *Nilai &gt;24 diberikan hanya jika masa kerja melampaui kriteria minimal.
                          </span>
                        </div>

                        {/* Project Impact: Max 30 */}
                        <div>
                          <div className="flex justify-between items-center text-[11px] mb-1">
                            <span className="font-semibold text-slate-700 font-sans flex items-center gap-1">
                              3. Dampak Proyek / Metrik
                            </span>
                            <span className="font-mono font-bold text-slate-900">{breakdown.projectImpact} <span className="text-slate-400 font-normal">/ 30</span></span>
                          </div>
                          <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${(breakdown.projectImpact / 30) * 105}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] text-slate-500 block mt-1 leading-tight font-sans">
                            *Nilai tinggi hanya jika data kuantitatif (%) dideteksi di CV.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Dynamic Keyword Highlights Extraction */}
              {(() => {
                const highlights = getKeywordsHighlight(selectedCandidate.redactedText, requirements);
                const hasHighlights = highlights.found.length > 0 || highlights.missing.length > 0;
                
                return (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200" id="keyword-highlights-section">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-2.5 font-mono">
                      Sorotan Kata Kunci (Keyword Analysis)
                    </h4>
                    {hasHighlights ? (
                      <div className="space-y-3 text-xs leading-normal font-sans">
                        <div>
                          <span className="text-[9px] font-bold text-emerald-600 tracking-wide block mb-1.5 font-mono">✓ COCOK DENGAN LOWONGAN ({highlights.found.length}):</span>
                          {highlights.found.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {highlights.found.map((word, idx) => (
                                <span key={idx} className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase">
                                  {word}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic font-sans">Tidak ada kecocokan kata kunci umum.</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-500 tracking-wide block mb-1.5 font-mono">✗ HARAPAN KUALIFIKASI DILEWATI ({highlights.missing.length}):</span>
                          {highlights.missing.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {highlights.missing.map((word, idx) => (
                                <span key={idx} className="bg-slate-100 text-slate-505 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-mono uppercase">
                                  {word}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Semua keahlian terpenuhi / Nihil.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic font-sans font-medium">
                        Input kriteria lowongan spesifik di panel kiri untuk mendeteksi kata kunci dari CV secara otomatis.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Detailed AI Analysis Block */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-2 font-mono border-b border-slate-100 pb-1">Hasil Evaluasi & Kesimpulan AI Justification</h4>
                <div className="bg-emerald-50/10 rounded-xl p-4 border border-emerald-100/50">
                  {selectedCandidate.status === "Evaluating" ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-555 mb-2" />
                      <p className="text-xs text-slate-500 font-medium font-sans">Sedang melalukan penilaian buta...</p>
                    </div>
                  ) : selectedCandidate.analysis ? (
                    <div className="text-slate-705 text-xs font-sans leading-relaxed whitespace-pre-line" id="evaluation-text-area">
                      {selectedCandidate.analysis}
                    </div>
                  ) : (
                    <div className="text-center py-4 font-sans">
                      <p className="text-xs text-slate-405">Belum ada evaluasi AI.</p>
                      <button
                        onClick={() => evaluateCandidate(selectedCandidate.id)}
                        className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-bold rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Panggil Evaluasi Ke Gemini AI
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Redacted Sanitized Text Preview */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-405 mb-2 font-mono">Pratinjau CV yang Disensor (Redacted Content)</h4>
                <div className="bg-slate-900 text-slate-300 font-mono text-[10px] p-3.5 rounded-xl max-h-52 overflow-y-auto leading-relaxed border border-slate-800 whitespace-pre-line scrollbar-thin">
                  {selectedCandidate.redactedText}
                </div>
                <span className="text-[9px] text-slate-405 mt-2 block leading-relaxed font-sans">
                  Informasi di atas merupakan pratinjau mentah yang dikirimkan ke cloud AI, membuktikan nama asli dan informasi sensitif telah disensor seutuhnya secara aman di sisi klien.
                </span>
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3.5 shrink-0">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 text-slate-505 hover:text-slate-750 font-bold text-xs rounded-lg border border-slate-200 transition-all hover:bg-slate-100 cursor-pointer"
              >
                Tutup Jendela Rincian
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modern, non-blocking State reset database confirmation modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" id="reset-confirm-modal">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl" id="reset-modal-icon">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 font-sans" id="reset-modal-title">Hapus Semua Data Kandidat?</h3>
                <p className="text-[11px] text-slate-505 mt-2 leading-relaxed font-sans font-medium" id="reset-modal-desc">
                  Apakah Anda yakin ingin menghapus semua berkas lamaran dari antrean database server? Seluruh nama asli dan riwayat sensor yang tersimpan aman di RAM browser juga akan dikosongkan. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3" id="reset-modal-actions">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-[11px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all font-sans cursor-pointer"
                id="reset-cancel-btn"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowResetConfirm(false);
                  await handleResetDirectly();
                }}
                className="px-4 py-2 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-900/10 hover:scale-[1.01] active:scale-95 transition-all font-sans cursor-pointer"
                id="reset-confirm-btn"
              >
                Ya, Reset Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern, non-blocking State evaluation confirmation modal */}
      {showReevaluateConfirm && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" id="reevaluate-confirm-modal">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl" id="reevaluate-modal-icon">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 font-sans" id="reevaluate-modal-title">Evaluasi Ulang Kandidat?</h3>
                <p className="text-[11px] text-slate-505 mt-2 leading-relaxed font-sans font-medium" id="reevaluate-modal-desc">
                  Semua CV dalam daftar sudah selesai dievaluasi sebelumnya. Apakah Anda ingin menjalankan kembali proses pemanggilan model AI untuk seluruh kandidat?
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3" id="reevaluate-modal-actions">
              <button
                type="button"
                onClick={() => setShowReevaluateConfirm(false)}
                className="px-4 py-2 text-[11px] font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all font-sans cursor-pointer"
                id="reevaluate-cancel-btn"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowReevaluateConfirm(false);
                  await runBatchEvaluation(candidates);
                }}
                className="px-4 py-2 text-[11px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-950/10 hover:scale-[1.01] active:scale-95 transition-all font-sans cursor-pointer"
                id="reevaluate-confirm-btn"
              >
                Ya, Evaluasi Ulang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
