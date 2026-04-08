'use client';

interface Props {
  state: 'active' | 'idle' | 'cooldown' | 'killed';
  organismName: string;
}

const stateStyles = {
  active: 'bg-terrarium-moss-light shadow-[0_0_8px_rgba(61,122,55,0.6)]',
  idle: 'bg-terrarium-moss animate-breathe',
  cooldown: 'bg-terrarium-amber animate-pulse-slow',
  killed: 'bg-terrarium-text-muted opacity-30',
};

export function StateIndicator({ state, organismName }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2.5 h-2.5 rounded-full transition-all duration-1000 ${stateStyles[state]}`}
      />
      <span className="font-display text-sm font-bold tracking-wide">
        {organismName}
      </span>
    </div>
  );
}
