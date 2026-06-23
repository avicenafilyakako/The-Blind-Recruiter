import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Candidate, JobRequirements } from "./src/types";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: "50mb" }));

// Define exact data files as requested:
// "saves these hidden candidates into a file at /data/candidates.json and the job description into /data/requirements.json"
const DATA_DIR = path.join(process.cwd(), "data");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates.json");
const REQUIREMENTS_FILE = path.join(DATA_DIR, "requirements.json");

// Ensure data directory exists
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Helpers to read/write candidates
function readCandidates(): Candidate[] {
  ensureDataDirectory();
  if (!fs.existsSync(CANDIDATES_FILE)) {
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify([], null, 2), "utf-8");
    return [];
  }
  try {
    const data = fs.readFileSync(CANDIDATES_FILE, "utf-8");
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading candidates file, resetting to empty:", err);
    return [];
  }
}

function writeCandidates(candidates: Candidate[]) {
  ensureDataDirectory();
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2), "utf-8");
}

// Helpers to read/write requirements
function readRequirements(): JobRequirements {
  ensureDataDirectory();
  const defaultRequirements: JobRequirements = {
    requirementsText: "Dibutuhkan Software Engineer dengan minimal 2 tahun pengalaman di React/Node.js, menguasai TypeScript, terbiasa dengan REST APIs, dan dapat berkolaborasi dengan baik dalam tim perkantoran.",
    updatedAt: new Date().toISOString()
  };

  if (!fs.existsSync(REQUIREMENTS_FILE)) {
    fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify(defaultRequirements, null, 2), "utf-8");
    return defaultRequirements;
  }
  try {
    const data = fs.readFileSync(REQUIREMENTS_FILE, "utf-8");
    if (!data.trim()) return defaultRequirements;
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading requirements file:", err);
    return defaultRequirements;
  }
}

function writeRequirements(reqs: JobRequirements) {
  ensureDataDirectory();
  fs.writeFileSync(REQUIREMENTS_FILE, JSON.stringify(reqs, null, 2), "utf-8");
}

// Lazy initialization of Google GenAI SDK as outlined in SDK usage to prevent crashes on startup if missing
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in AI Studio Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// API Endpoints:

// 1. Get job requirements
app.get("/api/requirements", (req, res) => {
  try {
    const reqs = readRequirements();
    res.json(reqs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save job requirements
app.post("/api/requirements", (req, res) => {
  try {
    const { requirementsText } = req.body;
    if (typeof requirementsText !== "string") {
      return res.status(400).json({ error: "requirementsText must be a string." });
    }
    const reqs: JobRequirements = {
      requirementsText,
      updatedAt: new Date().toISOString()
    };
    writeRequirements(reqs);
    res.json(reqs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get all candidates
app.get("/api/candidates", (req, res) => {
  try {
    const candidates = readCandidates();
    res.json(candidates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Save or update a candidate
app.post("/api/candidates", (req, res) => {
  try {
    const candidate: Candidate = req.body;
    if (!candidate.id || !candidate.tempNameId) {
      return res.status(400).json({ error: "Candidate must contain a valid id and tempNameId." });
    }
    
    const candidates = readCandidates();
    const existingIndex = candidates.findIndex((c) => c.id === candidate.id);
    
    if (existingIndex !== -1) {
      candidates[existingIndex] = { ...candidates[existingIndex], ...candidate };
    } else {
      candidates.push(candidate);
    }
    
    writeCandidates(candidates);
    res.json(candidate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Evaluate candidate using Gemini
app.post("/api/candidates/:id/evaluate", async (req, res) => {
  const { id } = req.params;
  console.log(`[BACKEND EVALUATE] Received evaluate request for candidate ID: ${id}`);
  try {
    const candidates = readCandidates();
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate) {
      console.warn(`[BACKEND EVALUATE] Candidate ID ${id} not found in database.`);
      return res.status(404).json({ error: "Candidate not found." });
    }

    const requirements = readRequirements();
    console.log(`[BACKEND EVALUATE] Candidate pseudonym: ${candidate.tempNameId}`);
    console.log(`[BACKEND EVALUATE] Job requirements text length: ${requirements.requirementsText.length}`);
    console.log(`[BACKEND EVALUATE] Redacted CV text length: ${candidate.redactedText ? candidate.redactedText.length : 0}`);

    if (!candidate.redactedText || candidate.redactedText.trim().length === 0) {
      console.error(`[BACKEND EVALUATE] Rejecting evaluation. The redacted CV text is completely blank for Candidate: ${candidate.tempNameId}`);
      return res.status(400).json({ error: "CV yang disensor kosong. Silakan unggah kembali berkas CV tersebut." });
    }

    // Mark candidate as Evaluating before making SDK call
    candidate.status = "Evaluating";
    writeCandidates(candidates);

    try {
      const ai = getAiClient();
      
      const systemInstruction = `
        Anda adalah seorang penilai lowongan kerja (Recruiter) ahli yang bekerja dengan kriteria buta (blind assessment) yang sangat ketat, jujur, dan adil.
        Tugas Anda adalah membandingkan teks CV kandidat yang sudah disensor (redacted) secara detail dengan Syarat Kriteria Lowongan yang diberikan secara objektif tanpa bias sama sekali.
        Hilangkan bias gender, suku, ras, atau identitas pribadi apa pun, karena seluruh data pribadi sensitif sudah disensor dalam bentuk placeholder seperti Candidate_050, [REDACTED_EMAIL] atau [REDACTED_PHONE].
        Silakan nilai kesesuaian berdasarkan pengalaman kerja nyata, keterampilan teknis, keahlian utama, dan kualifikasi yang relevan.

        PERATURAN PENILAIAN & SKORING KETAT (MANDATORY EVALUATION RULES):
        1. Anda harus menganalisis apakah bidang keahlian utama kandidat di CV sesuai dengan pekerjaan yang dibutuhkan. Jika bidang pekerjaan di CV sama sekali tidak relevan dengan Syarat Kriteria Lowongan (misalnya lowongan meminta seorang "Chef Masakan/F&B" tetapi CV kandidat membahas "Software engineer / Web developer", atau lowongan meminta "Dokter Gigi" tetapi CV kandidat membahas tentang "Desainer Grafis / Copywriter"), Anda WAJIB memberikan Skor Kecocokan total yang sangat kecil yaitu di bawah 15% atau 0% tepat.
        2. Jangan memberikan skor sedang atau tinggi (misal >50%) hanya karena kandidat memiliki "pengalaman kerja umum" atau struktur CV yang rapi. Kecocokan wajib didasarkan secara fungsional antara bekal di CV dengan kompetensi inti yang disyaratkan.
        3. Jika ada beberapa kriteria fungsional yang overlap tapi tidak sepenuhnya memenuhi syarat, berikan skor proporsional secara jujur. Jangan terlalu murah hati memberikan nilai tinggi.
        4. Rekomendasi status (recommendation) wajib bernilai "Rejected" jika skor total di bawah 65%.

        ATURAN BREAKDOWN NILAI & TIE-BREAKER UTAMA (MANDATORY BREAKDOWN & TIE-BREAKER RULES):
        Anda wajib memberikan breakdown penilaian dengan tiga kriteria berikut (total maks 100):
        a) Korelasi Skill Teknis (technicalSkills): Maksimal 40 poin. Nilai kecocokan keterampilan teknis kandidat dengan keterampilan esensial yang diminta.
        b) Kedalaman Pengalaman Kerja (workExperience): Maksimal 30 poin. Berikan nilai maksimal 25-30 HANYA jika total tahun atau kedalaman pengalaman kerja di CV secara eksplisit LEBIH BESAR ( > ) dibanding kriteria minimal lowongan. Jika kurang dari atau sekadar sama dengan kriteria minimal, batasi nilai workExperience maksimal di angka 24 poin.
        c) Dampak Proyek/Metrik Keberhasilan (projectImpact): Maksimal 30 poin. Berikan nilai tinggi (25-30 poin) jika terdapat data kuantitatif berupa persen (%) seperti persentase peningkatan performa, efisiensi, konversi, kepuasan, atau pertumbuhan di CV. Jika tidak terdapat indikator kuantitatif %, berikan nilai sedang atau rendah (di bawah 20 poin).

        PENTING - NILAI TOTAL DAN TIE-BREAKER:
        - Nilai total (score) WAJIB sama dengan jumlahan tiga kriteria breakdown tersebut (score = technicalSkills + workExperience + projectImpact).
        - Jika terdapat dua kandidat yang memiliki keterampilan teknis (skill) yang sama, gunakan parameter 'Kedalaman Pengalaman Kerja' (workExperience) dan 'Dampak Proyek' (projectImpact) sebagai pembeda/tie-breaker utama sehingga nilai akhir mereka TIDAK persis sama, kecuali profil dan seluruh kualitas mereka benar-benar 100% identik. Berikan variabilitas mikro yang adil di kedua nilai tersebut untuk memecahkan kesamaan skor.

        Anda WAJIB memberikan penilaian dalam format JSON yang valid.
      `;

      const userPrompt = `
        SYARAT KRITERIA LOWONGAN (JOB REQUIREMENTS TEMPLATE):
        """
        ${requirements.requirementsText}
        """

        DATA CV KANDIDAT YANG DISENSOR (CANDIDATE BLACK-BOX RESUME - ${candidate.tempNameId}):
        """
        ${candidate.redactedText}
        """

        Evaluasilah kecocokan kandidat ini dengan persyaratan lowongan di atas berdasarkan aturan breakdown nilai (technicalSkills + workExperience + projectImpact = score) serta aturan tie-breaker ketat.
        Silakan hasilkan objek JSON dengan properti persis berikut:
        1. score: Nilai integer kecocokan total (0 - 100). Harus tepat merupakan jumlahan dari technicalSkills + workExperience + projectImpact.
        2. scoreBreakdown: Objek berisi detail breakdown:
           - technicalSkills: Integer (0 - 40)
           - workExperience: Integer (0 - 30) - Maksimal hanya jika pengalaman > kriteria minimal.
           - projectImpact: Integer (0 - 30) - Tinggi jika ada data kuantitatif % di resume.
        3. analysis: Analisis ringkas objektif (3-4 kalimat dalam Bahasa Indonesia) yang menjelaskan kelebihan, kekurangan teknis, detail korelasi skill, kedalaman pengalaman, serta data metrik keberhasilan berdasarkan kriteria di atas.
        4. recommendation: Rekomendasi status rekrutmen: pilih 'Approved' (jika score >= 65) atau 'Rejected' (jika score < 65).
      `;

      console.log(`[BACKEND EVALUATE] Starting Gemini content generation for Candidate: ${candidate.tempNameId}`);
      
      let response;
      let retries = 3;
      let delayMs = 3000;
      let useHeuristicFallback = false;
      let lastErrorMessage = "";
      
      // If the frontend explicitly requested heuristic or we want to try AI
      const forceHeuristic = req.body && req.body.forceHeuristic === true;

      if (forceHeuristic) {
        useHeuristicFallback = true;
        lastErrorMessage = "Explicitly requested Local Heuristic Rules Processor.";
      } else {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: userPrompt,
              config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    score: {
                      type: Type.INTEGER,
                      description: "Skor kecocokan kandidat total (0 - 100).",
                    },
                    scoreBreakdown: {
                      type: Type.OBJECT,
                      description: "Breakdown nilai evaluasi kandidat.",
                      properties: {
                        technicalSkills: {
                          type: Type.INTEGER,
                          description: "Nilai Korelasi Skill Teknis (0 - 40)."
                        },
                        workExperience: {
                          type: Type.INTEGER,
                          description: "Nilai Kedalaman Pengalaman Kerja (0 - 30)."
                        },
                        projectImpact: {
                          type: Type.INTEGER,
                          description: "Nilai Dampak Proyek/Metrik Keberhasilan (0 - 30)."
                        }
                      },
                      required: ["technicalSkills", "workExperience", "projectImpact"],
                    },
                    analysis: {
                      type: Type.STRING,
                      description: "Analisis kelebihan & kekurangan ringkas objektif (Bahasa Indonesia).",
                    },
                    recommendation: {
                      type: Type.STRING,
                      description: "Tentukan status akhir rekrutmen: 'Approved' (Disetujui) atau 'Rejected' (Ditolak).",
                    },
                  },
                  required: ["score", "scoreBreakdown", "analysis", "recommendation"],
                },
              },
            });
            break; // success, exit the retry loop
          } catch (apiErr: any) {
            const errMsg = apiErr.stack || apiErr.message || JSON.stringify(apiErr);
            const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("billing");
            lastErrorMessage = apiErr.message || String(apiErr);
            
            console.error(`[BACKEND EVALUATE] Attempt ${attempt}/${retries} failed with error details:`, errMsg);
            
            if (isRateLimit) {
              console.warn(`[BACKEND EVALUATE] Quota/Rate limit triggered. Attempt ${attempt}.`);
              if (attempt === retries) {
                console.warn("[BACKEND EVALUATE] All API retries exhausted. Switching to Local Heuristic Matching Engine fallback.");
                useHeuristicFallback = true;
              } else {
                // Wait for a shorter duration during retries to avoid timeouts
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                delayMs *= 1.5;
              }
            } else {
              // Non-429 error or other block
              useHeuristicFallback = true;
              break;
            }
          }
        }
      }

      let evaluation;

      if (useHeuristicFallback) {
        // --- SECURE LOCAL HEURISTIC ANALYSIS ENGINE ---
        // We parse requirements and CV text, then do regex word-matching to calculate objective points
        console.log(`[BACKEND EVALUATE] Running Local Heuristic Heuristics for ${candidate.tempNameId}`);
        const cvWords = (candidate.redactedText || "").toLowerCase();
        const reqText = (requirements.requirementsText || "").toLowerCase();

        // 1. Extract potential skill keywords dynamically from requirements text
        const commonSkills = [
          "react", "node", "typescript", "javascript", "vue", "angular", "html", "css", "laravel", 
          "scrum", "php", "sql", "nosql", "postgres", "mysql", "mongodb", "aws", "docker", "git", 
          "python", "java", "golang", "flutter", "kotlin", "swift", "express", "tailwind", "ui/ux", "scrum"
        ];
        
        const matchedSkills: string[] = [];
        const requiredSkillsInJob: string[] = [];

        commonSkills.forEach(skill => {
          if (reqText.includes(skill)) {
            requiredSkillsInJob.push(skill);
            if (cvWords.includes(skill)) {
              matchedSkills.push(skill);
            }
          }
        });

        // 2. Count years of experience from CV via regex
        let experienceValue = 0;
        const experienceMatches = cvWords.match(/(\d+)\s*(thn|tahun|year|yr)/i);
        if (experienceMatches && experienceMatches[1]) {
          experienceValue = parseInt(experienceMatches[1], 10);
        }

        // Count required experience limit
        let minRequiredExp = 0;
        const reqExpMatches = reqText.match(/(\d+)\s*(thn|tahun|year|yr)/i);
        if (reqExpMatches && reqExpMatches[1]) {
          minRequiredExp = parseInt(reqExpMatches[1], 10);
        } else {
          minRequiredExp = 2; // Default baseline requirement
        }

        // 3. Compute detailed score breakdown based on matching criteria:
        
        // Kriteria 1: Korelasi Skill Teknis (Maks 40)
        let techSkillsScore = 0;
        if (requiredSkillsInJob.length > 0) {
          const matchPercent = matchedSkills.length / requiredSkillsInJob.length;
          techSkillsScore = Math.round(40 * matchPercent);
        } else {
          const generalOverlaps = commonSkills.filter(s => cvWords.includes(s));
          techSkillsScore = Math.min(40, 10 + generalOverlaps.length * 5);
        }

        // Kriteria 2: Kedalaman Pengalaman Kerja (Maks 30) - Maksimal hanya jika > minimal
        let xpScore = 0;
        if (experienceValue > 0) {
          if (experienceValue > minRequiredExp) {
            // Reached > kriteria minimal. Can get higher/maximum score
            xpScore = Math.min(30, 22 + (experienceValue - minRequiredExp) * 2);
          } else {
            // Reached up to minimal, capped strictly below maximum (maks 24)
            xpScore = Math.max(5, Math.round(24 * (experienceValue / minRequiredExp)));
          }
        } else {
          xpScore = 5;
        }

        // Kriteria 3: Dampak Proyek/Metrik Keberhasilan (Maks 30) - Tinggi jika ada data kuantitatif (%)
        const hasPercentages = cvWords.includes("%") || /percent/i.test(cvWords);
        let impactScore = 10; // Baseline
        if (hasPercentages) {
          // Found % quantitative metrics
          impactScore = 24; 
          const percentMatches = cvWords.match(/%/g);
          if (percentMatches && percentMatches.length > 1) {
            impactScore = Math.min(30, 24 + percentMatches.length * 2);
          }
        } else {
          const otherMetrics = cvWords.match(/\b\d+(\+\s*|\s*million|\s*m|\s*k|\s*miliar|000)/i);
          if (otherMetrics) {
            impactScore = 18;
          }
        }

        // Tie-breaker implementation for fallback matching engine logic:
        // Use candidate unique factors to adjust points slightly so they aren't duplicates
        const deterministicOffset = (candidate.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 3) - 1; // Produces -1, 0, or 1
        if (deterministicOffset !== 0) {
          if (xpScore > 5 && xpScore < 29) {
            xpScore += deterministicOffset;
          } else if (impactScore > 10 && impactScore < 29) {
            impactScore += deterministicOffset;
          }
        }

        // Total calculated is sum
        const calculatedScore = Math.max(0, Math.min(100, techSkillsScore + xpScore + impactScore));

        // Draft professional analysis reports in Bahasa Indonesia showing breakdown
        const matchedListStr = matchedSkills.length > 0 ? matchedSkills.map(s => s.toUpperCase()).join(", ") : "Tidak spesifik";
        const isApproved = calculatedScore >= 65;
        const recommendationStr = isApproved ? "Approved" : "Rejected";

        evaluation = {
          score: calculatedScore,
          scoreBreakdown: {
            technicalSkills: techSkillsScore,
            workExperience: xpScore,
            projectImpact: impactScore
          },
          analysis: `[SISTEM ANALISIS LOKAL (FALLBACK)]\nKandidat ${candidate.tempNameId} berhasil dinilai secara objektif menggunakan aturan pencocokan kosa kata lokal di server.\n\nDetail Poin Kriteria:\n- Korelasi Skill Teknis: ${techSkillsScore}/40\n- Kedalaman Pengalaman Kerja: ${xpScore}/30 (pengalaman terdeteksi: ${experienceValue} tahun terhadap minimal lowongan: ${minRequiredExp} tahun)\n- Dampak Proyek/Metrik Keberhasilan: ${impactScore}/30 (${hasPercentages ? "ditemukan indikator metrik kuantitatif %" : "tidak ditemukan indikator % kuantitatif"})\n\nKeterampilan teknis terdeteksi: ${matchedListStr}.\nPernyataan kualifikasi kandidat menunjukkan bekal teknis yang ${isApproved ? "selaras dengan syarat posisi." : "belum sepenuhnya memenuhi ekspektasi minimum lowongan saat ini."}\n\n(Catatan: Hasil bersumber dari mesin heuristik server lokal. Masukkan Gemini API Key valid di opsi Secrets untuk mengaktifkan audit AI penuh).`,
          recommendation: recommendationStr
        };
      } else {
        const responseText = response?.text;
        if (!responseText) {
          console.error(`[BACKEND EVALUATE] Gemini returned an empty or invalid text response.`);
          throw new Error("Empty response from AI evaluation.");
        }

        console.log(`[BACKEND EVALUATE] Raw Gemini Response received: ${responseText}`);

        let cleanJson = responseText.trim();
        if (cleanJson.startsWith("```")) {
          cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        evaluation = JSON.parse(cleanJson);
      }

      // Update candidate fields with assessment results
      const updatedCandidates = readCandidates();
      const candToUpdate = updatedCandidates.find((c) => c.id === id);
      if (candToUpdate) {
        candToUpdate.score = typeof evaluation.score === "number" ? evaluation.score : 0;
        candToUpdate.scoreBreakdown = evaluation.scoreBreakdown || {
          technicalSkills: Math.round(candToUpdate.score * 0.4),
          workExperience: Math.round(candToUpdate.score * 0.3),
          projectImpact: Math.round(candToUpdate.score * 0.3)
        };
        candToUpdate.analysis = evaluation.analysis || "Analisis gagal dihasilkan.";
        
        // Match user's requested status labels
        const finalRec = String(evaluation.recommendation).toLowerCase();
        if (finalRec.includes("approve") || finalRec.includes("setuju")) {
          candToUpdate.status = "Approved";
          candToUpdate.recommendation = "Approved / Disetujui";
        } else {
          candToUpdate.status = "Rejected";
          candToUpdate.recommendation = "Rejected / Belum Memenuhi";
        }
        
        writeCandidates(updatedCandidates);
        console.log(`[BACKEND EVALUATE] Assessment completed successfully for ${candToUpdate.tempNameId}. Score: ${candToUpdate.score}%, Status: ${candToUpdate.status}`);
        res.json(candToUpdate);
      } else {
        console.error(`[BACKEND EVALUATE] Candidate ID ${id} was removed from database during the active evaluation process.`);
        res.status(404).json({ error: "Candidate disappeared in active context." });
      }

    } catch (aiErr: any) {
      console.error(`[BACKEND EVALUATE] Complete SDK Catch Block for Candidate ID ${id}. Error:`, aiErr);
      
      // Update status to Error
      const updatedCandidates = readCandidates();
      const candToUpdate = updatedCandidates.find((c) => c.id === id);
      if (candToUpdate) {
        candToUpdate.status = "Error";
        candToUpdate.analysis = `Gagal mengevaluasi CV dengan AI: ${aiErr.message || aiErr}`;
        writeCandidates(updatedCandidates);
      }
      res.status(500).json({ error: `AI Gagal: ${aiErr.message || aiErr}` });
    }
  } catch (err: any) {
    console.error(`[BACKEND EVALUATE] Outermost Evaluate endpoint try-catch block failed for ID: ${id}. Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete a single candidate
app.delete("/api/candidates/:id", (req, res) => {
  try {
    const { id } = req.params;
    const candidates = readCandidates();
    const updated = candidates.filter((c) => c.id !== id);
    writeCandidates(updated);
    console.log(`[BACKEND DELETE] Candidate ID ${id} deleted successfully.`);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Bulk delete candidates
app.post("/api/candidates/bulk-delete", (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "ids must be an array." });
    }
    const candidates = readCandidates();
    const updated = candidates.filter((c) => !ids.includes(c.id));
    writeCandidates(updated);
    console.log(`[BACKEND BULK DELETE] Deleted ${ids.length} candidates.`);
    res.json({ success: true, count: ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Reset candidates and optionally requirements
app.post("/api/reset", (req, res) => {
  try {
    ensureDataDirectory();
    writeCandidates([]);
    res.json({ status: "reset_ok" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set up Vite or Static File Server:
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Mount Vite's middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve static files from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`The Blind Recruiter full-stack server operating on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
