import type { AgentRole } from '../types.js';

export interface WorkItem {
  id: string;
  tier: 1 | 2 | 3 | 4 | 5;
  priority_score: number;        // 0-100 within tier
  title: string;
  description: string;
  rationale: string;
  target_files: string[];
  estimated_complexity: 'trivial' | 'small' | 'medium' | 'large';
  memory_context: string[];      // lesson IDs
  success_criteria: string[];
  created_by: AgentRole;
  status: 'proposed' | 'planned' | 'in-progress' | 'completed' | 'rejected';
}

export interface CyclePlan {
  cycle_number: number;
  timestamp: string;
  state_report_id: string;
  selected_items: WorkItem[];
  deferred_items: WorkItem[];
  rationale: string;
  estimated_risk: 'low' | 'medium' | 'high';
  memory_consulted: boolean;
}
