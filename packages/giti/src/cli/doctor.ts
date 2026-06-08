import { buildDoctorDiagnosis } from '../agents/doctor/index.js';
import { formatDoctorDiagnosis } from '../agents/doctor/formatter.js';

export async function executeDoctor(options: { path?: string; json?: boolean }): Promise<void> {
  const repoPath = options.path ?? process.cwd();

  try {
    const diagnosis = await buildDoctorDiagnosis(repoPath);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(diagnosis, null, 2)}\n`);
    } else {
      process.stdout.write(`${formatDoctorDiagnosis(diagnosis)}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  }
}
