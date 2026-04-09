'use client';

interface Props {
  state: 'active' | 'idle' | 'cooldown' | 'killed';
  organismName: string;
}

const stateStyles = {
  active: 'bg-terrarium-moss-light shadow-[0_0_10px_rgba(61,122,55,0.8)]',
  idle: 'bg-terrarium-moss animate-breathe shadow-[0_0_6px_rgba(45,90,39,0.5)]',
  cooldown: 'bg-terrarium-amber animate-pulse-slow shadow-[0_0_6px_rgba(212,160,74,0.5)]',
  killed: 'bg-terrarium-text-muted opacity-30',
};

export function StateIndicator({ state, organismName }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-all duration-1000 ${stateStyles[state]}`}
        />
        {/* Outer glow ring for active/idle states */}
        {(state === 'active' || state === 'idle') && (
          <div
            className={`absolute inset-[-3px] rounded-full animate-breathe ${
              state === 'active'
                ? 'bg-terrarium-moss-light/20'
                : 'bg-terrarium-moss/15'
            }`}
          />
        )}
      </div>
      <span className="font-display text-sm font-bold tracking-wide">
        {organismName}
      </span>
    </div>
  );
}
