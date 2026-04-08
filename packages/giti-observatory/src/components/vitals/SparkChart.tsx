'use client';

interface Props {
  values: number[];
  label: string;
  height?: number;
  color?: string;
}

export function SparkChart({
  values,
  label,
  height = 24,
  color = 'stroke-terrarium-cyan',
}: Props) {
  if (values.length < 2) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 80;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        aria-label={`${label} trend`}
      >
        <polyline
          points={points}
          fill="none"
          className={`${color} opacity-60`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[10px] text-terrarium-text-muted">{label}</span>
    </div>
  );
}
