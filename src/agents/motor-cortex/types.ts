export interface ImplementationContext {
  work_item_id: string;
  title: string;
  description: string;
  target_files: string[];
  success_criteria: string[];
  quality_standards: {
    max_file_length: number;
    max_complexity: number;
    test_coverage_floor: number;
  };
  evolutionary_principles: string[];
  memory_lessons: string[];
  current_file_contents: Record<string, string>;
}

export interface FileChange {
  path: string;
  action: 'modify' | 'create' | 'delete';
  content?: string;
}

export interface ImplementationResult {
  work_item_id: string;
  branch_name: string;
  status: 'success' | 'partial' | 'failed';
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  lines_added: number;
  lines_removed: number;
  tests_added: number;
  tests_modified: number;
  pre_review_check: {
    tests_pass: boolean;
    lint_clean: boolean;
    builds: boolean;
  };
  error?: string;
  claude_tokens_used: number;
}
