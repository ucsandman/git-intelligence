import chalk from 'chalk';
import type { DoctorDiagnosis, DoctorSafetyGate, DoctorSignal } from './index.js';

function formatSignal(signal: DoctorSignal): string {
  const label = signal.level === 'critical'
    ? chalk.red(signal.label)
    : signal.level === 'warning'
      ? chalk.yellow(signal.label)
      : chalk.cyan(signal.label);
  return `  - ${label}: ${signal.value} - ${signal.detail}`;
}

function formatGate(gate: DoctorSafetyGate): string {
  const status = gate.status === 'block'
    ? chalk.red(gate.status)
    : gate.status === 'warn'
      ? chalk.yellow(gate.status)
      : chalk.green(gate.status);
  return `  - ${gate.name}: ${status} - ${gate.detail}`;
}

export function formatDoctorDiagnosis(diagnosis: DoctorDiagnosis): string {
  const lines: string[] = [];

  lines.push(chalk.bold('giti doctor'));
  lines.push(chalk.dim('-----------'));
  lines.push(`Current state: ${diagnosis.health.current_state}`);
  lines.push(`Health: ${diagnosis.health.status} - ${diagnosis.health.summary}`);
  if (diagnosis.health.last_report_at) {
    lines.push(`Last report: ${diagnosis.health.last_report_at}`);
  }
  lines.push('');

  lines.push('Top signals:');
  for (const signal of diagnosis.signals.slice(0, 3)) {
    lines.push(formatSignal(signal));
  }
  lines.push('');

  lines.push(`Top recommendation: ${diagnosis.recommendations[0]?.title ?? 'none'}`);
  if (diagnosis.recommendations[0]) {
    lines.push(`  Rationale: ${diagnosis.recommendations[0].rationale}`);
    lines.push(`  Risk: ${diagnosis.recommendations[0].risk}`);
  }
  lines.push('');

  lines.push('Safety gates:');
  lines.push(`  - doctor mode: pass - ${diagnosis.safety.read_only ? 'read-only inspection' : 'unexpected write mode'}`);
  for (const gate of diagnosis.safety.gates) {
    lines.push(formatGate(gate));
  }
  lines.push('');
  lines.push(`Next command: ${diagnosis.next_action.command}`);

  return lines.join('\n');
}
