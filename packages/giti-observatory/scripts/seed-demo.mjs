#!/usr/bin/env node
/**
 * seed-demo.mjs
 * Populates .organism/ with rich fake data for demo/terrarium visualization.
 * Run from any directory: node packages/giti-observatory/scripts/seed-demo.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve repo root (3 levels up from packages/giti-observatory/scripts/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const ORGANISM_DIR = join(REPO_ROOT, '.organism');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function write(filePath, data) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  wrote  ${filePath.replace(REPO_ROOT, '.')}`);
}

let _uuidCounter = 1000;
function uuid() {
  const hex = (_uuidCounter++).toString(16).padStart(4, '0');
  return `a${hex}b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5`.replace('a', hex.slice(0, 1));
}

/** Return ISO timestamp for a date offset from 2026-03-01 */
function ts(dayOffset, hourOffset = 0, minuteOffset = 0) {
  const base = new Date('2026-03-01T08:00:00Z');
  base.setDate(base.getDate() + dayOffset);
  base.setHours(base.getHours() + hourOffset);
  base.setMinutes(base.getMinutes() + minuteOffset);
  return base.toISOString();
}

// Each cycle is ~1.25 days apart (30 cycles over ~38 days → April 8)
function cycleTs(cycle, offsetHours = 0) {
  const dayOffset = Math.floor((cycle - 1) * 1.25);
  return ts(dayOffset, offsetHours);
}

// ---------------------------------------------------------------------------
// 1. cycle-counter.json
// ---------------------------------------------------------------------------
console.log('\n[1] cycle-counter.json');
write(join(ORGANISM_DIR, 'cycle-counter.json'), { count: 30 });

// ---------------------------------------------------------------------------
// 2. knowledge-base.json
// ---------------------------------------------------------------------------
console.log('\n[2] knowledge-base.json');

const events = [];

// Cycle-by-cycle event generation
const cycleOutcomes = [
  // [cycle, merged, rejected, hasRegression, hasGrowthProposal, growthApproved]
  [1,  1, 0, false, false, false],
  [2,  2, 0, false, false, false],
  [3,  2, 1, false, false, false],  // first-merge milestone territory
  [4,  1, 0, false, false, false],
  [5,  2, 0, false, false, false],
  [6,  1, 1, false, false, false],
  [7,  2, 0, true,  false, false],  // first regression
  [8,  0, 0, false, false, false],  // cooldown cycle
  [9,  1, 0, false, false, false],
  [10, 2, 1, false, false, false],  // changes-10
  [11, 2, 0, false, false, false],
  [12, 1, 1, false, false, false],
  [13, 2, 0, false, false, false],
  [14, 1, 0, false, false, false],
  [15, 2, 0, false, false, false],
  [16, 1, 1, false, false, false],
  [17, 1, 0, false, false, false],
  [18, 2, 2, false, false, false],  // first-self-rejection
  [19, 1, 0, true,  false, false],  // second regression
  [20, 0, 0, false, false, false],  // cooldown
  [21, 1, 0, false, false, false],
  [22, 2, 0, false, true,  true],   // first-growth-proposal + approved
  [23, 1, 1, false, true,  false],  // growth rejected
  [24, 2, 0, false, true,  true],   // growth approved
  [25, 2, 1, false, false, false],  // changes-25
  [26, 1, 0, false, true,  true],   // growth approved
  [27, 2, 0, false, false, false],
  [28, 1, 1, true,  true,  false],  // third regression + growth proposed
  [29, 0, 0, false, false, false],  // cooldown
  [30, 2, 0, false, true,  true],   // final cycle, growth approved
];

const implementations = [
  'Refactor commit analyzer for edge cases',
  'Add P50/P95 latency tracking to sensory cortex',
  'Increase test coverage for file-analyzer',
  'Fix off-by-one in stale branch detection',
  'Optimize hotspots query with early termination',
  'Add retry logic to motor cortex builder',
  'Extract duplicate date-formatting utilities',
  'Improve ghost detection precision',
  'Add confidence scoring to memory curator',
  'Reduce cyclomatic complexity in prioritizer',
  'Add structured error types to sensory collectors',
  'Cache git log results in pulse command',
  'Strengthen immune check for test file deletions',
  'Add TF-IDF weight tuning to FTS query',
  'Reduce average cycle time from 4.2s to 2.8s',
  'Add JSON output flag to dispatch command',
  'Improve branch naming collision resistance',
  'Patch audit log to handle concurrent writes',
  'Add telemetry event deduplication',
  'Improve memory query recall by 12%',
];

const rejectionReasons = [
  'test coverage dropped below 80% threshold',
  'cyclomatic complexity exceeded limit in new function',
  'regression risk flagged by immune system boundary check',
  'diff exceeded 150 lines — too large for single change',
  'new dependency introduced without justification',
  'test file deleted without replacement',
  'performance regression: pulse command slowed by 400ms',
];

const growthDescriptions = [
  'Add repository contributor heatmap command',
  'Implement PR review time analytics',
  'Add commit message quality scoring',
  'Surface work-in-progress detection signal',
  'Add multi-repo aggregate dashboard',
  'Implement semantic duplicate commit detection',
];

let implIdx = 0;
let rejIdx = 0;
let growthIdx = 0;

for (const [cycle, merged, rejected, hasRegression, hasGrowthProposal, growthApproved] of cycleOutcomes) {
  const baseHour = 0;

  // cycle-started
  events.push({
    id: uuid(),
    timestamp: cycleTs(cycle, baseHour),
    cycle,
    type: 'cycle-started',
    agent: 'orchestrator',
    summary: `Cycle ${cycle} started`,
    data: { cycle },
    tags: [],
  });

  // plan-created
  const plannedItems = merged + rejected + (hasRegression ? 1 : 0);
  if (plannedItems > 0 || cycle === 8 || cycle === 20 || cycle === 29) {
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 0, 15),
      cycle,
      type: 'plan-created',
      agent: 'prefrontal-cortex',
      summary: `Planned ${Math.max(merged + rejected, 1)} items for cycle ${cycle}`,
      data: { cycle, items: Math.max(merged + rejected, 1), tier_distribution: { tier1: merged > 1 ? 1 : 0, tier2: merged, tier3: rejected } },
      tags: [],
    });
  }

  // implementations + approvals/rejections
  for (let i = 0; i < merged; i++) {
    const impl = implementations[implIdx % implementations.length];
    implIdx++;
    const implId = uuid();
    events.push({
      id: implId,
      timestamp: cycleTs(cycle, baseHour + 1 + i),
      cycle,
      type: 'implementation-complete',
      agent: 'motor-cortex',
      summary: `Built: ${impl}`,
      data: {
        cycle,
        branch: `organism/motor/${impl.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`,
        files_changed: Math.floor(Math.random() * 5) + 1,
        lines_added: Math.floor(Math.random() * 80) + 10,
        lines_removed: Math.floor(Math.random() * 30) + 2,
      },
      tags: [],
    });
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 1 + i, 30),
      cycle,
      type: 'change-approved',
      agent: 'immune-system',
      summary: `Approved: ${impl}`,
      data: { cycle, checks_passed: 7, checks_total: 7 },
      tags: [],
    });
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 1 + i, 50),
      cycle,
      type: 'change-merged',
      agent: 'orchestrator',
      summary: `Merged: ${impl}`,
      data: { cycle, branch: `organism/motor/${impl.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}` },
      tags: [],
    });
  }

  for (let i = 0; i < rejected; i++) {
    const impl = implementations[(implIdx) % implementations.length];
    implIdx++;
    const reason = rejectionReasons[rejIdx % rejectionReasons.length];
    rejIdx++;
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 2 + i),
      cycle,
      type: 'implementation-complete',
      agent: 'motor-cortex',
      summary: `Built: ${impl}`,
      data: {
        cycle,
        branch: `organism/motor/${impl.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`,
        files_changed: Math.floor(Math.random() * 8) + 2,
        lines_added: Math.floor(Math.random() * 120) + 30,
        lines_removed: Math.floor(Math.random() * 20) + 1,
      },
      tags: [],
    });
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 2 + i, 30),
      cycle,
      type: 'change-rejected',
      agent: 'immune-system',
      summary: `Rejected: ${impl} — ${reason}`,
      data: { cycle, reason, checks_passed: Math.floor(Math.random() * 4) + 2, checks_total: 7 },
      tags: ['rejection'],
    });
  }

  // regression
  if (hasRegression) {
    events.push({
      id: uuid(),
      timestamp: cycleTs(cycle, baseHour + 4),
      cycle,
      type: 'regression-detected',
      agent: 'immune-system',
      summary: `Regression detected in cycle ${cycle} — entering 48h cooldown`,
      data: {
        cycle,
        file: ['src/analyzers/commit.ts', 'src/agents/motor-cortex/builder.ts', 'src/agents/sensory-cortex/collectors.ts'][cycle % 3],
        test_failures: Math.floor(Math.random() * 4) + 1,
        cooldown_until: cycleTs(cycle, baseHour + 52),
      },
      tags: ['regression', 'cooldown'],
    });
  }

  // growth proposal
  if (hasGrowthProposal) {
    const growthDesc = growthDescriptions[growthIdx % growthDescriptions.length];
    growthIdx++;
    const proposalId = uuid();
    events.push({
      id: proposalId,
      timestamp: cycleTs(cycle, baseHour + 3),
      cycle,
      type: 'growth-proposed',
      agent: 'growth-hormone',
      summary: `Growth proposal: ${growthDesc}`,
      data: {
        cycle,
        proposal_id: proposalId,
        signal_type: ['usage-concentration', 'usage-sequence', 'missing-capability', 'ecosystem-signal'][cycle % 4],
        description: growthDesc,
        confidence: (0.6 + Math.random() * 0.3).toFixed(2),
      },
      tags: ['growth'],
    });

    if (growthApproved) {
      events.push({
        id: uuid(),
        timestamp: cycleTs(cycle, baseHour + 3, 45),
        cycle,
        type: 'growth-approved',
        agent: 'prefrontal-cortex',
        summary: `Growth approved: ${growthDesc}`,
        data: { cycle, proposal_id: proposalId, tier: 5 },
        tags: ['growth', 'approved'],
      });
    } else {
      events.push({
        id: uuid(),
        timestamp: cycleTs(cycle, baseHour + 3, 45),
        cycle,
        type: 'growth-rejected',
        agent: 'prefrontal-cortex',
        summary: `Growth rejected: ${growthDesc} — backlog full or low confidence`,
        data: { cycle, proposal_id: proposalId, reason: 'low-confidence' },
        tags: ['growth', 'rejected'],
      });
    }
  }

  // cycle-complete
  events.push({
    id: uuid(),
    timestamp: cycleTs(cycle, baseHour + 5),
    cycle,
    type: 'cycle-complete',
    agent: 'orchestrator',
    summary: `Cycle ${cycle} complete — ${merged} merged, ${rejected} rejected${hasRegression ? ', regression detected' : ''}`,
    data: {
      cycle,
      merged,
      attempted: merged + rejected,
      approved: merged,
      had_regression: hasRegression,
    },
    tags: [],
  });
}

const knowledgeBase = {
  created: '2026-03-01T00:00:00Z',
  last_updated: '2026-04-08T12:00:00Z',
  cycle_count: 30,
  events,
  lessons: [
    {
      id: uuid(),
      learned_at: ts(4),
      lesson: 'Small focused changes under 80 lines have a 94% approval rate versus 48% for larger diffs.',
      evidence_event_ids: [],
      confidence: 0.94,
      category: 'change-size',
      times_referenced: 12,
    },
    {
      id: uuid(),
      learned_at: ts(8),
      lesson: 'The commit analyzer (src/analyzers/commit.ts) is fragile under edge-case inputs — extra test coverage is required before modification.',
      evidence_event_ids: [],
      confidence: 0.88,
      category: 'regressions',
      times_referenced: 7,
    },
    {
      id: uuid(),
      learned_at: ts(10),
      lesson: 'Bug fixes merge 3x faster than refactors because they have clear acceptance criteria.',
      evidence_event_ids: [],
      confidence: 0.82,
      category: 'change-types',
      times_referenced: 9,
    },
    {
      id: uuid(),
      learned_at: ts(14),
      lesson: 'Changes that touch both src/ and tests/ simultaneously have a higher immune approval rate than src-only changes.',
      evidence_event_ids: [],
      confidence: 0.79,
      category: 'test-pairing',
      times_referenced: 5,
    },
    {
      id: uuid(),
      learned_at: ts(18),
      lesson: 'The motor cortex builder tends to over-engineer solutions on first attempt — the self-correction loop has improved output quality measurably.',
      evidence_event_ids: [],
      confidence: 0.76,
      category: 'motor-cortex',
      times_referenced: 4,
    },
    {
      id: uuid(),
      learned_at: ts(22),
      lesson: 'Growth proposals with concrete usage-sequence signals are approved more readily than abstract ecosystem-signal proposals.',
      evidence_event_ids: [],
      confidence: 0.72,
      category: 'growth',
      times_referenced: 3,
    },
    {
      id: uuid(),
      learned_at: ts(27),
      lesson: 'The prefrontal cortex backlog tends to accumulate tier-3 items that are never executed — periodic backlog pruning is recommended.',
      evidence_event_ids: [],
      confidence: 0.68,
      category: 'backlog',
      times_referenced: 2,
    },
    {
      id: uuid(),
      learned_at: ts(30),
      lesson: 'Sensory cortex trend detection becomes more accurate after 10+ state reports — early cycles had noisy signals.',
      evidence_event_ids: [],
      confidence: 0.65,
      category: 'sensory-cortex',
      times_referenced: 1,
    },
    {
      id: uuid(),
      learned_at: ts(33),
      lesson: 'Cooldown periods following regressions have correlated with higher-quality work in the subsequent cycle.',
      evidence_event_ids: [],
      confidence: 0.61,
      category: 'regressions',
      times_referenced: 3,
    },
  ],
  patterns: {
    fragile_files: [
      {
        path: 'src/analyzers/commit.ts',
        regression_count: 2,
        last_regression: cycleTs(19),
        notes: 'Timezone handling and Unicode edge cases trigger failures',
      },
      {
        path: 'src/agents/motor-cortex/builder.ts',
        regression_count: 1,
        last_regression: cycleTs(7),
        notes: 'Prompt construction is sensitive to API response shape changes',
      },
      {
        path: 'src/agents/sensory-cortex/collectors.ts',
        regression_count: 1,
        last_regression: cycleTs(28),
        notes: 'File system enumeration fails on symlinked directories',
      },
      {
        path: 'src/agents/prefrontal-cortex/prioritizer.ts',
        regression_count: 0,
        last_regression: null,
        notes: 'High cyclomatic complexity — changes frequently trigger complexity warnings',
      },
    ],
    rejection_reasons: {
      'test-coverage-drop': 5,
      'complexity-increase': 3,
      'regression-risk': 2,
      'diff-too-large': 2,
      'dependency-added': 1,
      'test-file-deleted': 1,
    },
    successful_change_types: {
      bugfix: 12,
      feature: 6,
      refactor: 4,
      test: 3,
    },
    failed_change_types: {
      feature: 3,
      refactor: 2,
    },
  },
  preferences: [
    {
      id: uuid(),
      preference: 'Prefer diffs under 100 lines to maximize immune approval rate',
      confidence: 0.91,
      source: 'pattern-analysis',
    },
    {
      id: uuid(),
      preference: 'Test files should mirror source structure (tests/agents/ mirrors src/agents/)',
      confidence: 0.87,
      source: 'style-observation',
    },
    {
      id: uuid(),
      preference: 'Branch names should follow organism/{cortex}/{kebab-description} format consistently',
      confidence: 0.83,
      source: 'convention-enforcement',
    },
    {
      id: uuid(),
      preference: 'Avoid touching more than 3 files per work item to keep changes reviewable',
      confidence: 0.78,
      source: 'pattern-analysis',
    },
    {
      id: uuid(),
      preference: 'New commands must include --json and --path flags before submission for immune approval',
      confidence: 0.95,
      source: 'quality-standard',
    },
  ],
};

write(join(ORGANISM_DIR, 'knowledge-base.json'), knowledgeBase);
console.log(`    (${events.length} events generated)`);

// ---------------------------------------------------------------------------
// 3. state-reports/ — 5 recent sense runs
// ---------------------------------------------------------------------------
console.log('\n[3] state-reports/');

const STATE_REPORTS_DIR = join(ORGANISM_DIR, 'state-reports');
ensureDir(STATE_REPORTS_DIR);

// ISO timestamps used both as filenames and as report timestamp values
const stateReportTimestamps = [
  '2026-03-28T09:15:00.000Z',
  '2026-04-01T10:30:00.000Z',
  '2026-04-04T11:45:00.000Z',
  '2026-04-06T14:00:00.000Z',
  '2026-04-08T09:00:00.000Z',
];
// Filesystem-safe versions of the above (colons replaced with hyphens)
const stateReportFilenames = stateReportTimestamps.map(t => t.replace(/:/g, '-'));

const stateReportData = [
  // March 28 — early state, healthy
  {
    total_commits: 210, commits_last_7d: 8, commits_last_30d: 32,
    test_file_count: 43, source_file_count: 57, test_ratio: 0.75, test_coverage_percent: 80,
    lint_error_count: 1, files_exceeding: 2, functions_exceeding: 3,
    pulse_ms: 480, hotspots_ms: 1350, ghosts_ms: 3800,
    outdated_count: 3, total_files: 98, total_lines: 7200,
  },
  // April 1 — regression aftermath, slightly degraded
  {
    total_commits: 218, commits_last_7d: 10, commits_last_30d: 38,
    test_file_count: 44, source_file_count: 58, test_ratio: 0.76, test_coverage_percent: 79,
    lint_error_count: 0, files_exceeding: 3, functions_exceeding: 4,
    pulse_ms: 460, hotspots_ms: 1280, ghosts_ms: 3650,
    outdated_count: 2, total_files: 101, total_lines: 7800,
  },
  // April 4 — recovering
  {
    total_commits: 227, commits_last_7d: 11, commits_last_30d: 42,
    test_file_count: 45, source_file_count: 60, test_ratio: 0.75, test_coverage_percent: 81,
    lint_error_count: 0, files_exceeding: 2, functions_exceeding: 3,
    pulse_ms: 455, hotspots_ms: 1240, ghosts_ms: 3580,
    outdated_count: 2, total_files: 105, total_lines: 8100,
  },
  // April 6 — strong, growth phase beginning
  {
    total_commits: 238, commits_last_7d: 13, commits_last_30d: 44,
    test_file_count: 46, source_file_count: 61, test_ratio: 0.754, test_coverage_percent: 82,
    lint_error_count: 0, files_exceeding: 1, functions_exceeding: 2,
    pulse_ms: 450, hotspots_ms: 1210, ghosts_ms: 3510,
    outdated_count: 2, total_files: 107, total_lines: 8350,
  },
  // April 8 — current state
  {
    total_commits: 245, commits_last_7d: 12, commits_last_30d: 45,
    test_file_count: 47, source_file_count: 62, test_ratio: 0.758, test_coverage_percent: 82,
    lint_error_count: 0, files_exceeding: 1, functions_exceeding: 2,
    pulse_ms: 445, hotspots_ms: 1200, ghosts_ms: 3500,
    outdated_count: 2, total_files: 109, total_lines: 8500,
  },
];

for (let i = 0; i < stateReportTimestamps.length; i++) {
  const isoTimestamp = stateReportTimestamps[i];  // e.g. "2026-03-28T09:15:00.000Z"
  const safeFilename = stateReportFilenames[i];    // e.g. "2026-03-28T09-15-00.000Z"
  const d = stateReportData[i];
  const report = {
    timestamp: isoTimestamp,
    version: '0.1.0',
    git: {
      total_commits: d.total_commits,
      commits_last_7d: d.commits_last_7d,
      commits_last_30d: d.commits_last_30d,
      unique_authors_30d: 1,
      active_branches: 3,
      stale_branches: 2,
      last_commit_age_hours: 2,
      avg_commit_size_lines: 35,
    },
    quality: {
      test_file_count: d.test_file_count,
      source_file_count: d.source_file_count,
      test_ratio: d.test_ratio,
      test_pass_rate: 1.0,
      test_coverage_percent: d.test_coverage_percent,
      lint_error_count: d.lint_error_count,
      files_exceeding_length_limit: d.files_exceeding,
      functions_exceeding_complexity: d.functions_exceeding,
    },
    performance: {
      pulse_execution_ms: d.pulse_ms,
      hotspots_execution_ms: d.hotspots_ms,
      ghosts_execution_ms: d.ghosts_ms,
    },
    dependencies: {
      total_count: 12,
      outdated_count: d.outdated_count,
      vulnerable_count: 0,
      outdated_packages: d.outdated_count >= 2 ? ['chalk', 'ora'] : d.outdated_count === 1 ? ['ora'] : [],
      vulnerabilities: [],
    },
    codebase: {
      total_files: d.total_files,
      total_lines: d.total_lines,
      avg_file_length: Math.round(d.total_lines / d.total_files),
    },
    anomalies: d.test_coverage_percent < 80 ? [
      {
        type: 'quality_floor_approaching',
        severity: 'warning',
        message: `Test coverage (${d.test_coverage_percent}%) is within 5 points of the floor (80%)`,
        data: { current_coverage: d.test_coverage_percent, floor: 80 },
      },
    ] : [],
    growth_signals: i >= 3 ? [
      {
        type: 'usage-concentration',
        signal: 'pulse command used 4x more than any other command',
        confidence: 0.78,
      },
    ] : [],
  };

  write(join(STATE_REPORTS_DIR, `${safeFilename}.json`), report);
}

// ---------------------------------------------------------------------------
// 4. content/dispatches/ — 6-8 dispatch files for notable cycles
// ---------------------------------------------------------------------------
console.log('\n[4] content/dispatches/');

const DISPATCHES_DIR = join(ORGANISM_DIR, 'content', 'dispatches');
ensureDir(DISPATCHES_DIR);

const dispatches = [
  {
    cycle: 1,
    timestamp: cycleTs(1, 5),
    headline: 'The organism takes its first breath',
    narrative: `In the dim stillness before activity, the organism initialized its sensory systems for the first time. Like a newly hatched creature opening its eyes, the sensory cortex swept across the codebase — cataloguing commits, measuring test ratios, mapping the nervous system of a living software project. The prefrontal cortex deliberated, weighed priorities, and dispatched the motor cortex to make its first small incision: a single bug fix, careful and precise. The immune system watched with fresh antibodies, approved the change, and the organism exhaled. One commit merged. The lifecycle had begun.`,
    key_moments: [
      { moment: 'Sensory cortex first initialization', significance: 'The organism perceived its own body for the first time' },
      { moment: 'First motor cortex code generation', significance: 'Claude API called in service of autonomous self-improvement' },
      { moment: 'First immune system approval', significance: 'All 7 checks passed — quality gates held on day one' },
    ],
    stats: { changes_merged: 1, changes_rejected: 0, growth_proposals: 0, fitness_delta: 5, streak: 1 },
    milestone: 'first-cycle',
    platform_versions: {
      twitter: '🧬 Day 1. The organism woke up, ran a self-diagnostic, wrote its first code change, and had it approved. 1 commit merged. The lifecycle begins. #LivingCode #AIDevTools',
      linkedin: 'Today marks the first autonomous lifecycle cycle of giti — a CLI tool that now improves its own codebase. Cycle 1: 1 change merged, all quality gates passed. This is what self-improving software looks like at day one.',
      hn: 'Show HN: giti ran its first autonomous cycle today — sensed its codebase health, planned a work item, generated code via Claude API, passed immune system checks, and merged 1 commit. All without human intervention.',
      blog: '# Cycle 1: First Breath\n\nThe organism initialized today. Sensory cortex scanned the codebase, the prefrontal cortex identified the highest-priority improvement, and the motor cortex drafted the change. The immune system — seven adversarial checks — reviewed it and approved. One commit, cleanly merged.\n\nThis is not automation. This is a new kind of software: a codebase that tends to itself.',
    },
  },
  {
    cycle: 3,
    timestamp: cycleTs(3, 5),
    headline: 'First successful merge — the immune system proves its worth',
    narrative: `By cycle 3 the organism had developed a rhythm. But this cycle tested its self-discipline: three changes were planned, two were built and submitted for immune review, and one was turned away. The immune membrane — the set of adversarial checks that stands between motor cortex output and the main branch — flagged a coverage drop. The organism accepted the rejection without protest. The rejected branch was archived. The two approved changes landed cleanly. In the rejection, the immune system demonstrated its deepest purpose: not to obstruct, but to protect the organism's long-term fitness.`,
    key_moments: [
      { moment: 'First immune rejection processed', significance: 'The organism learned to accept criticism from itself' },
      { moment: '2 changes merged in a single cycle', significance: 'Motor cortex productivity increasing cycle over cycle' },
    ],
    stats: { changes_merged: 2, changes_rejected: 1, growth_proposals: 0, fitness_delta: 7, streak: 3 },
    milestone: 'first-merge',
    platform_versions: {
      twitter: '🛡️ Cycle 3: The immune system rejected its own code. Coverage had dropped 2%. The organism turned itself away from the merge queue. This is self-discipline at the architectural level. #LivingCode',
      linkedin: 'Cycle 3 showed giti\'s immune system working as intended: 2 changes approved and merged, 1 rejected for dropping test coverage. The organism enforces its own quality standards — no human intervention required.',
      hn: 'giti cycle 3: the organism rejected one of its own PRs for dropping test coverage below threshold. The immune system (7 adversarial checks) caught what code review might have missed.',
      blog: '# Cycle 3: The Immune System Earns Its Name\n\nTwo changes merged cleanly. One rejected. The rejected branch had lowered test coverage by 2% — below the 80% floor. The immune system flagged it, the orchestrator archived the branch, and the cycle closed.\n\nThe organism had just enforced its own standards against its own work. That\'s the point.',
    },
  },
  {
    cycle: 10,
    timestamp: cycleTs(10, 5),
    headline: 'Ten cycles in — the organism is learning its own shape',
    narrative: `Ten cycles. The memory agent had accumulated enough evidence to begin surface-level pattern recognition. It had noticed that small changes — under 80 lines — were being approved at nearly twice the rate of larger diffs. The prefrontal cortex had begun to internalize this: tier-1 items were now scoped tighter. The organism was not just improving its codebase. It was improving its approach to improving its codebase. A meta-learning loop had quietly activated.`,
    key_moments: [
      { moment: 'Memory agent detects diff-size approval correlation', significance: 'First time the organism changed its behavior based on observed patterns' },
      { moment: '10 total cycles completed', significance: 'Enough history for meaningful trend analysis' },
    ],
    stats: { changes_merged: 2, changes_rejected: 1, growth_proposals: 0, fitness_delta: 6, streak: 2 },
    milestone: 'changes-10',
    platform_versions: {
      twitter: '🧠 Cycle 10: The organism noticed that small PRs pass review 2x more often. So it started writing smaller PRs. Meta-learning activated. #LivingCode #SelfImproving',
      linkedin: 'After 10 autonomous cycles, giti\'s memory agent identified a pattern: changes under 80 lines have a 94% approval rate vs 48% for larger diffs. The organism is now scoping its own work items tighter. This is second-order learning.',
      hn: 'giti cycle 10: memory agent detected that small diffs have higher immune approval rates, and the prefrontal cortex is now using this to scope work items. The organism optimized its own development process.',
      blog: '# Cycle 10: Learning to Learn\n\nThe memory curator surfaced a pattern this cycle that changed everything: diffs under 80 lines pass immune review at 94%. Larger diffs: 48%.\n\nThe prefrontal cortex absorbed this. Work items are being scoped tighter now — not because we told it to, but because it observed the correlation and acted on it.\n\nThis is meta-learning: the organism improving how it improves itself.',
    },
  },
  {
    cycle: 18,
    timestamp: cycleTs(18, 5),
    headline: 'The organism rejects its own best work — and grows stronger for it',
    narrative: `Cycle 18 will be remembered in the knowledge base as the moment the organism\'s immune system operated at peak discernment. Two changes were proposed. Both were built with care, with the motor cortex producing unusually clean diffs. Both were submitted to the immune membrane for review. And both were rejected. Not because the code was bad — the code was reasonable — but because the immune checks detected a subtle boundary violation: the changes, taken together, would have introduced a circular dependency between the sensory cortex and the memory agent. Neither change alone triggered the alarm. Together, they did. The organism caught something a human reviewer might have missed.`,
    key_moments: [
      { moment: 'First dual-rejection cycle', significance: 'Immune system caught a structural problem invisible in individual diffs' },
      { moment: 'Circular dependency detected across two separate changes', significance: 'The boundary check proves its value for the first time' },
    ],
    stats: { changes_merged: 2, changes_rejected: 2, growth_proposals: 0, fitness_delta: -1, streak: 0 },
    milestone: 'first-self-rejection',
    platform_versions: {
      twitter: '🔬 Cycle 18: The organism rejected 2 changes it was proud of. The immune system found a circular dependency that neither change alone would have triggered. This is why we have immune systems. #LivingCode',
      linkedin: 'Cycle 18 was a lesson in systemic thinking. Two individually clean changes were rejected because — together — they would have created a circular dependency. The immune system caught what isolated code review cannot. Architectural health at the system level.',
      hn: 'giti cycle 18: immune system rejected two changes that each looked fine individually, because their combined effect would create a circular dependency between agents. The boundary check finally justified its existence.',
      blog: '# Cycle 18: When Rejection Is the Answer\n\nThe organism produced two solid diffs this cycle. Both were rejected.\n\nThe immune system\'s boundary check ran the combined dependency graph of both proposed changes and found a cycle: sensory-cortex → memory → sensory-cortex. Neither change alone triggered the alarm. Together, they rang it clearly.\n\nThis is the hardest lesson for a self-improving system to learn: sometimes the right move is to do nothing.',
    },
  },
  {
    cycle: 22,
    timestamp: cycleTs(22, 5),
    headline: 'The growth hormone activates — the organism proposes its own evolution',
    narrative: `Until cycle 22, the organism had been a diligent maintainer: fixing, refactoring, testing, patching. Its world was bounded by the backlog. Then the growth hormone agent parsed six weeks of anonymized telemetry and found a signal: the pulse command was being invoked four times more often than any other. Users were running health checks repeatedly, as if searching for something the tool wasn\'t yet surfacing. The growth hormone agent crystallized this into a proposal: add a contributor heatmap command. The prefrontal cortex reviewed it, assigned it to tier 5, and added it to the backlog. The organism had, for the first time, proposed its own growth.`,
    key_moments: [
      { moment: 'Growth hormone agent activates for first time', significance: 'Telemetry signal converted to evolutionary proposal' },
      { moment: 'First growth proposal approved by prefrontal cortex', significance: 'Organism expands its own roadmap for the first time' },
    ],
    stats: { changes_merged: 2, changes_rejected: 0, growth_proposals: 1, fitness_delta: 8, streak: 4 },
    milestone: 'first-growth-proposal',
    platform_versions: {
      twitter: '🌱 Cycle 22: The organism proposed its own new feature. Telemetry showed users hammering the pulse command — the growth hormone agent turned that signal into a feature proposal. The organism grows. #LivingCode',
      linkedin: 'giti reached a new milestone in cycle 22: the growth hormone agent analyzed telemetry patterns and proposed a new command — a contributor heatmap — because usage data showed users repeatedly seeking information the tool doesn\'t yet surface. Self-directed evolution.',
      hn: 'giti cycle 22: the growth hormone agent identified a usage pattern (pulse command invoked 4x more than others) and converted it into a feature proposal that the prefrontal cortex accepted into the tier-5 backlog. The organism is now proposing its own roadmap.',
      blog: '# Cycle 22: The Organism Wants Something New\n\nFor 21 cycles, the organism worked within its existing boundaries. Then the growth hormone agent read the telemetry and noticed something: users keep running `giti pulse`. Over and over. As if looking for information that isn\'t there yet.\n\nThe proposal: a contributor heatmap. The signal: usage concentration on one command.\n\nThe prefrontal cortex approved it. It\'s in the backlog now. The organism decided what to build next.',
    },
  },
  {
    cycle: 25,
    timestamp: cycleTs(25, 5),
    headline: 'Twenty-five merges — the organism has rewritten itself three times over',
    narrative: `A milestone worth pausing at: 25 changes merged across 25 cycles. Not a single human-authored commit in the functional core since cycle 3. The codebase is measurably better: test coverage climbed from 76% to 82%, average execution time for the pulse command dropped 12%, and the functions-exceeding-complexity count fell from 8 to 2. The organism had not just maintained itself — it had improved itself. And the quality floor had held through every cycle. The immune system had rejected 10 changes in total. Each rejection had been correct.`,
    key_moments: [
      { moment: '25th change merged', significance: 'Sustained autonomous improvement over 7 weeks' },
      { moment: 'Pulse command 12% faster than cycle 1', significance: 'Performance improvements accumulating across autonomous cycles' },
      { moment: 'Zero security vulnerabilities across all dependency audits', significance: 'Safety rails holding under real-world conditions' },
    ],
    stats: { changes_merged: 2, changes_rejected: 1, growth_proposals: 0, fitness_delta: 5, streak: 3 },
    milestone: 'changes-25',
    platform_versions: {
      twitter: '🎯 Cycle 25: 25 changes merged by an autonomous organism. Test coverage: 76% → 82%. Pulse command: 12% faster. Complexity violations: 8 → 2. No humans required. #LivingCode',
      linkedin: 'giti has now autonomously merged 25 changes over 25 cycles. Measurable outcomes: test coverage +8%, pulse command 12% faster, complexity violations down 75%. This is what sustained autonomous improvement looks like at scale.',
      hn: 'giti milestone: 25 autonomous cycles completed, 25 changes merged, 10 correctly rejected. Codebase metrics all trending positive. The self-improvement loop is working.',
      blog: '# Cycle 25: 25 Merges In\n\nLet\'s look at the numbers.\n\nCycle 1 baseline:\n- Test coverage: 76%\n- Pulse command: 480ms\n- Functions exceeding complexity: 8\n- Changes merged: 1\n\nCycle 25 state:\n- Test coverage: 82%\n- Pulse command: 445ms\n- Functions exceeding complexity: 2\n- Total changes merged: 25\n\nThe organism has rewritten itself. Not dramatically — carefully, incrementally, one small correct change at a time.',
    },
  },
  {
    cycle: 28,
    timestamp: cycleTs(28, 5),
    headline: 'A third regression — and the organism enters its deepest reflection',
    narrative: `The third regression arrived quietly. A change to the sensory cortex collectors — seemingly routine — broke file enumeration on symlinked directories. Tests passed on the CI environment, where symlinks were absent. In production repos, the command silently returned empty data. The immune system\'s regression check caught the failure within minutes of the change landing. The kill switch was not activated, but the 48-hour cooldown clock began. The organism paused. In the silence of the cooldown period, the memory curator extracted a new lesson: symlinked paths require dedicated test fixtures. The knowledge base grew. And the growth hormone agent, still active, filed a proposal for a self-testing infrastructure improvement.`,
    key_moments: [
      { moment: 'Third regression in 28 cycles', significance: 'Regression rate remains below 10% — organism is learning from failures' },
      { moment: 'Memory curator extracts symlink test lesson during cooldown', significance: 'Downtime converted to learning' },
      { moment: 'Growth hormone proposes infrastructure improvement in response to regression', significance: 'Organism proposes fixing its own blind spots' },
    ],
    stats: { changes_merged: 1, changes_rejected: 1, growth_proposals: 1, fitness_delta: -3, streak: 0 },
    milestone: null,
    platform_versions: {
      twitter: '⚠️ Cycle 28: Regression #3. Symlinked directory enumeration broke silently. 48h cooldown activated. The organism is now in reflection mode — extracting lessons and filing improvement proposals. #LivingCode',
      linkedin: 'giti cycle 28: regression detected in symlink handling, 48-hour cooldown activated. During the pause, the memory agent extracted a new lesson and the growth hormone filed a proposal for better test infrastructure. Failure converted to learning.',
      hn: 'giti cycle 28: third regression in 28 cycles (10.7% regression rate). Symlinked directory bug. 48h cooldown. The organism is using the pause to add a lesson to the knowledge base and propose a self-testing improvement.',
      blog: '# Cycle 28: The Pause\n\nA regression hit. Symlinked directories returned empty data silently — the worst kind of bug: one that doesn\'t fail loudly.\n\nThe immune system caught it. 48-hour cooldown began.\n\nIn the pause: the memory curator added a lesson about symlink test fixtures. The growth hormone agent turned the gap into a proposal. When the cooldown lifts, the organism will know what it didn\'t know before.\n\nThis is how organisms learn from injury.',
    },
  },
  {
    cycle: 30,
    timestamp: cycleTs(30, 5),
    headline: 'The organism enters its next phase — growth proposals queued, backlog expanding',
    narrative: `Cycle 30 closes a chapter. The organism emerged from its final cooldown, executed two clean changes, and received its fourth growth hormone proposal: semantic duplicate commit detection, drawn from a usage-sequence signal showing users running both hotspots and ghosts in immediate succession. The memory agent now holds 9 lessons and 30 cycles of event history. The immune system has rejected 10 changes and approved 25. The knowledge base has crystallized preferences and fragile-file patterns that make each subsequent cycle safer than the last. This is not an endpoint. This is the organism at full operating capacity, with a backlog that will keep it busy for the next 10 cycles. The lifecycle continues.`,
    key_moments: [
      { moment: 'Cycle 30 completed', significance: 'First full month of autonomous operation' },
      { moment: 'Fourth growth proposal received and approved', significance: 'Growth hormone pipeline fully operational' },
      { moment: '9 lessons accumulated in knowledge base', significance: 'The organism has meaningful institutional memory' },
    ],
    stats: { changes_merged: 2, changes_rejected: 0, growth_proposals: 1, fitness_delta: 9, streak: 2 },
    milestone: null,
    platform_versions: {
      twitter: '🌿 Cycle 30: One month of autonomous operation. 25 merges, 10 rejections, 3 regressions, 9 lessons learned. Growth hormone queue: 4 proposals. The organism is thriving. #LivingCode',
      linkedin: 'giti completes its 30th autonomous cycle and its first full month of self-directed development. Stats: 25 changes merged, 10 correctly rejected, 3 regressions recovered from, 9 lessons in the knowledge base. The organism knows itself now.',
      hn: 'giti at 30 cycles: 25 merges, 10 rejections (all correct), 3 regressions (all recovered), 9 learned lessons, 4 growth proposals in the backlog. Codebase fitness measurably higher than cycle 1 across all metrics.',
      blog: '# Cycle 30: One Month In\n\n30 cycles. 38 days. Here is what the organism has done:\n\n**Changes**: 25 merged, 10 rejected, 35 total attempted\n**Quality**: Coverage 76% → 82%, complexity violations 8 → 2\n**Performance**: Pulse 480ms → 445ms, hotspots 1350ms → 1200ms\n**Memory**: 9 lessons, 4 fragile files identified, preferences crystallized\n**Growth**: 4 proposals in the backlog, 1 more queued\n\nThe organism does not rest. Cycle 31 is already planned.',
    },
  },
];

for (const dispatch of dispatches) {
  const filename = `cycle-${String(dispatch.cycle).padStart(3, '0')}-dispatch.json`;
  write(join(DISPATCHES_DIR, filename), dispatch);
}

// ---------------------------------------------------------------------------
// 5. Verify organism.json identity
// ---------------------------------------------------------------------------
console.log('\n[5] organism.json — checking identity');

const ORGANISM_JSON_PATH = join(REPO_ROOT, 'organism.json');
try {
  const existing = JSON.parse(readFileSync(ORGANISM_JSON_PATH, 'utf8'));
  if (existing.identity && existing.identity.name !== 'giti') {
    existing.identity.name = 'giti';
    writeFileSync(ORGANISM_JSON_PATH, JSON.stringify(existing, null, 2));
    console.log('  updated identity.name to "giti"');
  } else {
    console.log('  identity.name is already "giti" — no changes needed');
  }
} catch (err) {
  console.warn('  could not read organism.json:', err.message);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n✓ Seed complete');
console.log(`  Organism dir: ${ORGANISM_DIR}`);
console.log(`  Events written: ${events.length}`);
console.log(`  State reports: ${stateReportTimestamps.length}`);
console.log(`  Dispatches: ${dispatches.length}`);
console.log(`  Lessons: ${knowledgeBase.lessons.length}`);
