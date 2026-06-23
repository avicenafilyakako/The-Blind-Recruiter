/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Candidate {
  id: string;               // Unique ID, e.g. "cand_1717441762"
  tempNameId: string;       // Public pseudonymous ID, e.g. "Candidate_001"
  originalFilename: string; // The file name upload e.g. "CV_Tersensor_A.pdf"
  redactedText: string;     // Text with Real Name, Email, Phone scrubbed
  status: 'Parsing/Loading' | 'Evaluating' | 'Approved' | 'Rejected' | 'Error';
  score?: number;           // AI evaluation match score (0 - 100)
  analysis?: string;        // AI evaluation feedback
  recommendation?: string;  // AI status recommendation
  uploadedAt: string;       // Date and time of upload
  scoreBreakdown?: {
    technicalSkills: number;  // Maks 40
    workExperience: number;   // Maks 30
    projectImpact: number;    // Maks 30
  };
}

export interface RedactionRAMStore {
  [tempNameId: string]: {
    realName: string;
    email: string;
    phone: string;
  };
}

export interface JobRequirements {
  requirementsText: string;
  updatedAt: string;
}
