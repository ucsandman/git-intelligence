'use client';

import { useObservatory } from '@/data/provider-context';

function statusTone(status: string): string {
  switch (status) {
    case 'running':
    case 'approved':
      return 'text-terrarium-amber';
    case 'succeeded':
      return 'text-terrarium-moss-light';
    case 'failed':
    case 'rejected':
      return 'text-red-300';
    default:
      return 'text-terrarium-text-muted';
  }
}

export function HealingJournal() {
  const { snapshot } = useObservatory();

  if (!snapshot) {
    return null;
  }

  const { healing } = snapshot;

  return (
    <section className="border-y border-terrarium-soil-light/30 bg-terrarium-soil/35">
      <div className="max-w-3xl mx-auto px-6 py-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-terrarium-amber-dim font-mono">
              Self-healing
            </p>
            <h2 className="font-display text-lg text-terrarium-text">
              Action Journal
            </h2>
          </div>
          <div className="text-right font-mono text-xs text-terrarium-text-muted">
            {healing.total_actions} attempts
          </div>
        </div>

        {healing.recent_actions.length === 0 ? (
          <p className="text-sm text-terrarium-text-muted">
            No healing actions recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {healing.active_action && (
              <div className="rounded-organic border border-terrarium-amber/30 bg-terrarium-surface/70 px-4 py-3">
                <div className="text-xs font-mono text-terrarium-amber mb-1">
                  active
                </div>
                <div className="text-sm text-terrarium-text">
                  {healing.active_action.template_id}
                </div>
                <div className="text-xs text-terrarium-text-muted font-mono mt-1">
                  {healing.active_action.status} - {healing.active_action.updated_at}
                </div>
              </div>
            )}

            <ol className="space-y-2">
              {healing.recent_actions.slice(0, 4).map((action) => (
                <li
                  key={action.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-terrarium-soil-light/20 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-terrarium-text truncate">
                      {action.template_id}
                    </div>
                    <div className="text-xs text-terrarium-text-muted font-mono truncate">
                      {action.id}
                    </div>
                  </div>
                  <div className={`text-xs font-mono ${statusTone(action.status)}`}>
                    {action.status}
                  </div>
                </li>
              ))}
            </ol>

            {healing.recent_artifacts.length > 0 && (
              <div className="pt-2">
                <div className="text-xs uppercase tracking-[0.16em] text-terrarium-text-muted font-mono mb-2">
                  Artifacts
                </div>
                <ul className="space-y-1">
                  {healing.recent_artifacts.slice(0, 3).map((artifact) => (
                    <li
                      key={`${artifact.action_id}-${artifact.path}`}
                      className="text-xs text-terrarium-text-muted font-mono truncate"
                    >
                      {artifact.path}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
