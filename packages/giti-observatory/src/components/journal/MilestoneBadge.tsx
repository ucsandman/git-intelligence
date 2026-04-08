'use client';

const milestoneLabels: Record<string, string> = {
  'first-cycle': 'First Breath',
  'first-merge': 'First Growth',
  'first-growth-proposal': 'First Idea',
  'first-growth-shipped': 'First Evolution',
  'changes-10': '10 Changes',
  'changes-25': '25 Changes',
  'changes-50': '50 Changes',
  'changes-100': 'Century',
  'first-self-fix': 'Self-Healer',
  'first-self-rejection': 'Self-Aware',
  'ship-of-theseus': 'Ship of Theseus',
};

interface Props {
  milestone: string;
}

export function MilestoneBadge({ milestone }: Props) {
  const label = milestoneLabels[milestone] ?? milestone;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terrarium-amber/15 text-terrarium-amber text-xs font-display font-bold tracking-wide border border-terrarium-amber/20">
      {label}
    </span>
  );
}
