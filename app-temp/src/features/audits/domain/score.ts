import type { AuditAnswerDraft, ScoreResult, ScoreThresholds } from "../types";

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  approvedFrom: 85,
  warningFrom: 70,
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

export function calculateAuditScore(
  answers: AuditAnswerDraft[],
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS,
): ScoreResult {
  const maxScore = answers.reduce((total, item) => total + item.maxScore, 0);

  const obtainedScore = answers.reduce((total, item) => {
    if (item.answer === "complies") {
      return total + item.maxScore;
    }

    return total;
  }, 0);

  const compliancePercent = maxScore > 0 ? (obtainedScore / maxScore) * 100 : 0;
  const missingAnswerCount = answers.filter((item) => item.answer === null).length;
  const missingObservationCount = answers.filter(
    (item) => item.observation.trim().length === 0,
  ).length;

  const roundedPercent = roundToTwo(compliancePercent);

  return {
    obtainedScore: roundToTwo(obtainedScore),
    maxScore: roundToTwo(maxScore),
    compliancePercent: roundedPercent,
    status:
      roundedPercent >= thresholds.approvedFrom
        ? "approved"
        : roundedPercent >= thresholds.warningFrom
          ? "warning"
          : "failed",
    missingAnswerCount,
    missingObservationCount,
    isComplete: missingAnswerCount === 0 && missingObservationCount === 0,
  };
}
