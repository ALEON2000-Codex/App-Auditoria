export type AnswerValue = "complies" | "does_not_comply";

export type AuditAnswerDraft = {
  questionId: string;
  prompt: string;
  maxScore: number;
  answer: AnswerValue | null;
  observation: string;
  isCritical?: boolean;
};

export type ScoreResult = {
  obtainedScore: number;
  maxScore: number;
  compliancePercent: number;
  status: "approved" | "warning" | "failed";
  missingAnswerCount: number;
  missingObservationCount: number;
  isComplete: boolean;
};

export type ScoreThresholds = {
  approvedFrom: number;
  warningFrom: number;
};
