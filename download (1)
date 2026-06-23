import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Candidate, RedactionRAMStore } from "../types";

interface DragDropUploaderProps {
  onUploadSuccess: (newCandidates: Candidate[], ramStore: RedactionRAMStore) => void;
  existingCount: number;
}

export default function DragDropUploader({ onUploadSuccess, existingCount }: DragDropUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files) as File[];
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      processFiles(files);
    }
  };

  // Extract plain text from uploaded PDF client-side securely via PDF.js loaded by script tag
  const extractTextFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        const pdfjsLib = (window as any).pdfjsLib;

        if (!pdfjsLib) {
          reject(new Error("Pustaka pembaca PDF (PDF.js) belum termuat. Silakan muat ulang atau tunggu sejenak."));
          return;
        }

        try {
          // Point worker to same CDN
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
          const loadingTask = pdfjsLib.getDocument({ data: typedarray });
          const pdf = await loadingTask.promise;
          let fullText = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
          }
          resolve(fullText);
        } catch (err: any) {
          reject(new Error(`Gagal membaca PDF: ${err.message}`));
        }
      };
      fileReader.onerror = () => reject(new Error("Gagal membaca file sebagai ArrayBuffer."));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // Parse plain TXT resume
  const extractTextFromTxt = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || "");
      reader.onerror = () => reject(new Error("Gagal membaca file text."));
      reader.readAsText(file);
    });
  };

  // Core redaction function: Runs 100% locally in browser RAM to prevent data leaking
  const redactCandidateData = (
    text: string, 
    candidateNumber: number
  ): { redactedText: string; realName: string; email: string; phone: string } => {
    let email = "Tidak ditemukan";
    let phone = "Tidak ditemukan";
    let realName = `Kandidat Indah #${candidateNumber}`; // fallback default name

    // 1. Extract Email
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    const emailMatches = text.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
      email = emailMatches[0];
    }

    // 2. Extract Phone Number
    // Matches common ID and international phone patterns, e.g., 0812..., +628..., (021)...
    const phoneRegex = /(\+?\d{1,4}[-.\s]?)?\(?\d{2,6}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,6}/g;
    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      // Find the first match that looks like a valid phone length
      const validPhone = phoneMatches.find(p => p.replace(/[-.\s()]/g, "").length >= 8);
      if (validPhone) {
        phone = validPhone.trim();
      }
    }

    // 3. Extract Real Name
    // Strategy: Look for specific formats, like "Nama: John Doe" or standard first non-empty lines
    const nameLabelRegex = /(nama\s*lengkap|nama|name|full\s*name)\s*:\s*([a-zA-Z\s'.]{3,40})/i;
    const labelMatch = text.match(nameLabelRegex);

    if (labelMatch && labelMatch[2]) {
      realName = labelMatch[2].trim();
    } else {
      // Fallback: Take the first line of the document that matches name criteria
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      // Filter out CV decoration terms
      const skipKeywords = ["curriculum", "vitae", "resume", "cv", "profil", "biodata", "personal", "contact", "about me", "tentang"];
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        const hasKeyword = skipKeywords.some(kw => lowerLine.includes(kw));
        const isValidLength = line.length >= 3 && line.length <= 40;
        const matchesNamePattern = /^[a-zA-Z\s'.]+$/.test(line);

        if (!hasKeyword && isValidLength && matchesNamePattern) {
          realName = line;
          break;
        }
      }
    }

    // Create Redaction replacements
    const tempNameId = `Candidate_${String(candidateNumber).padStart(3, "0")}`;
    let redactedText = text;

    // Redact email
    if (email !== "Tidak ditemukan") {
      redactedText = redactedText.replace(new RegExp(escapeRegExp(email), "gi"), "[REDACTED_EMAIL]");
    }
    // Redact phone
    if (phone !== "Tidak ditemukan") {
      redactedText = redactedText.replace(new RegExp(escapeRegExp(phone), "gi"), "[REDACTED_PHONE]");
    }
    // Redact real name (all occurrences)
    if (realName && realName.length > 2 && !realName.startsWith("Kandidat Indah")) {
      // Match full name or first/last names to be thorough
      const nameParts = realName.split(/\s+/).filter(p => p.length > 2);
      
      // Replace exact full name
      redactedText = redactedText.replace(new RegExp(escapeRegExp(realName), "gi"), tempNameId);
      
      // Replace parts to prevent partial leaks
      for (const part of nameParts) {
        redactedText = redactedText.replace(new RegExp(escapeRegExp(part), "gi"), tempNameId);
      }
    }

    // Extra double-check with regex for any remaining email/phone leaks
    redactedText = redactedText.replace(emailRegex, "[REDACTED_EMAIL]");
    // We don't blindly replace all numbers in text because of experience years/scores, but replacing email is perfect

    return {
      redactedText,
      realName,
      email,
      phone
    };
  };

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setErrorText(null);

    // Limit files to 10 at once as requested: "allow selecting up to 10 PDF or TXT files at once"
    if (files.length > 10) {
      setErrorText("Anda hanya diperbolehkan mengunggah maksimal 10 file CV sekaligus.");
      setIsProcessing(false);
      return;
    }

    const validFiles = files.filter(f => f.name.endsWith(".pdf") || f.name.endsWith(".txt"));
    if (validFiles.length === 0) {
      setErrorText("Format file tidak didukung. Unggah hanya berkas berekstensi .pdf atau .txt.");
      setIsProcessing(false);
      return;
    }

    const listNewCandidates: Candidate[] = [];
    const newRamStore: RedactionRAMStore = {};

    let currentCandidateIndex = existingCount + 1;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgress(`Memproses (${i + 1}/${validFiles.length}): ${file.name}`);

      try {
        let text = "";
        if (file.name.endsWith(".pdf")) {
          text = await extractTextFromPdf(file);
        } else {
          text = await extractTextFromTxt(file);
        }

        if (!text || text.trim().length === 0) {
          throw new Error("Konten teks CV kosong.");
        }

        // Apply Redaction 100% locally in browser
        const { redactedText, realName, email, phone } = redactCandidateData(text, currentCandidateIndex);
        const tempNameId = `Candidate_${String(currentCandidateIndex).padStart(3, "0")}`;
        
        // "Bug Prevention: Make sure every uploaded CV gets a strictly unique ID so that data doesn't get mixed up"
        const uniqueId = `cand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const candidate: Candidate = {
          id: uniqueId,
          tempNameId: tempNameId,
          originalFilename: file.name,
          redactedText: redactedText,
          status: "Parsing/Loading",
          uploadedAt: new Date().toISOString()
        };

        listNewCandidates.push(candidate);
        
        // This RAM record stays ONLY in the frontend mapping
        newRamStore[tempNameId] = {
          realName,
          email,
          phone
        };

        currentCandidateIndex++;
      } catch (err: any) {
        console.error("Error processing file", file.name, err);
        setErrorText(`Gagal memproses file "${file.name}": ${err.message}`);
      }
    }

    if (listNewCandidates.length > 0) {
      onUploadSuccess(listNewCandidates, newRamStore);
    }
    
    setIsProcessing(false);
    setUploadProgress("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="drag-drop-container" className="mb-6">
      <div
        id="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerSelect}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-slate-300 dark:border-slate-700 bg-white hover:border-slate-400 dark:bg-slate-900"
        } relative group`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt"
          onChange={handleFileSelect}
          className="hidden"
          id="cv-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-full group-hover:scale-105 transition-transform duration-200">
            <Upload className="w-8 h-8" id="upload-icon" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100 text-lg">
              Seret & Drop berkas CV di sini, atau <span className="text-emerald-600 underline">Klik untuk Telusuri</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Menerima PDF atau TXT (Maksimal 10 file sekaligus)
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 rounded-xl flex flex-col items-center justify-center p-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{uploadProgress}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Menganalisis & menyensor data pribadi secara lokal...</p>
          </div>
        )}
      </div>

      {errorText && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-start gap-2 animate-fade-in" id="upload-error">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}
    </div>
  );
}
