export type CreatureMood = 'content' | 'alert' | 'excited' | 'recoiling' | 'resting' | 'dormant';
export type WeatherType = 'sunny' | 'overcast' | 'storm' | 'fog';
export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn';
export type FloraType = 'shrub' | 'flower' | 'vine';

export interface FloraItem {
  id: string;
  cycle: number;
  type: FloraType;
  position: [number, number, number];
  age: number;
  fossilized: boolean;
}

export interface SporeItem {
  id: string;
  cycle: number;
  status: 'drifting' | 'rooted' | 'fading';
  position: [number, number, number];
}

export interface FossilItem {
  id: string;
  milestone: string;
  cycle: number;
  position: [number, number, number];
}

export interface SceneState {
  creature: {
    mood: CreatureMood;
    size: number;
    maturity: number;
    bioluminescence: number;
    personality: {
      caution: number;
      eagerness: number;
      resilience: number;
    };
    activeOrgans: string[];
  };
  environment: {
    groundLushness: number;
    flora: FloraItem[];
    spores: SporeItem[];
    fossils: FossilItem[];
    weather: WeatherType;
    timeOfDay: TimeOfDay;
    energyPoolLevel: number;
  };
  activity: {
    isLive: boolean;
    currentPhase?: string;
    activeAgent?: string;
  };
}
