export type WeatherMode = 'clear' | 'mist' | 'rain' | 'sunshower';

export type InteractionMode = 'inspect' | 'plant' | 'prune';

export type FloraKind = 'bonsai' | 'fern' | 'succulent' | 'mushroom' | 'blossom';

export type PlantableKind = 'fern' | 'succulent' | 'mushroom' | 'blossom';

export type CameraPreset = 'overview' | 'canopy' | 'floor' | 'pond';

export type GlassMode = 'full' | 'open';

export interface FloraSpec {
  id: string;
  kind: FloraKind;
  name: string;
  botanicalName: string;
  description: string;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  seed: number;
  isHero?: boolean;
}

export interface LightingState {
  timeOfDay: number;
  clockLabel: string;
  phaseLabel: string;
  daylightFactor: number;
  twilightFactor: number;
  nightFactor: number;
  bioluminescence: number;
  keyPosition: [number, number, number];
  keyColor: string;
  keyIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  rimColor: string;
  rimIntensity: number;
  backgroundColor: string;
  fogColor: string;
  exposure: number;
}

export interface WeatherState {
  mode: WeatherMode;
  rainRate: number;
  mistDensity: number;
  condensation: number;
  windStrength: number;
  wetness: number;
  humidityPct: number;
  temperatureC: number;
}

export interface InspectedSpecimen {
  id: string;
  name: string;
  botanicalName: string;
  kind: FloraKind | 'stone' | 'pond' | 'vessel';
  description: string;
  moisturePreference: string;
}
