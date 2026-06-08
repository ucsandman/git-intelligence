import type { ActionTemplate } from '../types.js';
import { commandOutputEvidenceCapture } from './command-output-evidence-capture.js';
import { generatedOutputPollutionAudit } from './generated-output-pollution-audit.js';
import { regressionClusterDraftStabilizationPlan } from './regression-cluster-draft-stabilization-plan.js';

export const builtInActionTemplates: ActionTemplate[] = [
  regressionClusterDraftStabilizationPlan,
  generatedOutputPollutionAudit,
  commandOutputEvidenceCapture,
];
