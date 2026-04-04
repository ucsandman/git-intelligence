export interface GrowthSignal {
  type:
    | 'usage-concentration'
    | 'usage-sequence'
    | 'error-pattern'
    | 'flag-pattern'
    | 'missing-capability'
    | 'ecosystem-signal';
  title: string;
  evidence: string;
  confidence: number;
  data: Record<string, unknown>;
}

export interface GrowthProposal {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  rationale: string;
  evidence: Array<{
    signal_type: string;
    data_point: string;
    confidence: number;
  }>;
  proposed_interface: {
    command: string;
    flags: string[];
    output_description: string;
  };
  estimated_complexity: 'small' | 'medium' | 'large';
  target_files: string[];
  dependencies_needed: string[];
  alignment: {
    purpose_alignment: string;
    growth_zone_category: string;
    principle_compliance: string[];
  };
  risks: string[];
  success_metrics: string[];
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  immune_system_notes?: string;
}
