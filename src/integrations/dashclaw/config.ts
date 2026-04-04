export interface PanelConfig {
  id: string;
  title: string;
  type: 'gauge' | 'timeline' | 'treemap' | 'table' | 'cards' | 'text';
  description: string;
  data_source: string;
}

export function getDashboardConfig(): PanelConfig[] {
  return [
    {
      id: 'vital-signs',
      title: 'Vital Signs',
      type: 'gauge',
      description: 'Real-time organism health gauges',
      data_source: 'vital_signs',
    },
    {
      id: 'evolutionary-timeline',
      title: 'Evolutionary Timeline',
      type: 'timeline',
      description: 'Interactive cycle history with event stacking',
      data_source: 'cycle_summary',
    },
    {
      id: 'cognitive-map',
      title: 'Cognitive Map',
      type: 'treemap',
      description: 'Codebase visualization by confidence and size',
      data_source: 'evolutionary_state',
    },
    {
      id: 'decision-log',
      title: 'Decision Log',
      type: 'table',
      description: 'Searchable log of all organism decisions',
      data_source: 'decisions',
    },
    {
      id: 'growth-tracker',
      title: 'Growth Tracker',
      type: 'cards',
      description: 'Feature proposal lifecycle timeline',
      data_source: 'growth_proposals',
    },
    {
      id: 'personality-profile',
      title: 'Personality Profile',
      type: 'text',
      description: 'Emerged preferences and decision patterns',
      data_source: 'evolutionary_state.emerged_preferences',
    },
  ];
}
