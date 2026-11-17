import type {
  FloraKind,
  FloraSpec,
  LightingState,
  PlantableKind,
  WeatherMode,
  WeatherState,
} from './types';

export const TERRARIUM_RADIUS = 2.62;
export const SOIL_BASE_Y = 0.38;
export const POND_CENTER = { x: 0.92, z: 0.72 } as const;
export const POND_RADIUS = 0.64;
export const POND_WATER_Y = SOIL_BASE_Y - 0.11;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const k = clamp(t, 0, 1);
  const r = Math.round(lerp(r1, r2, k));
  const g = Math.round(lerp(g1, g2, k));
  const b = Math.round(lerp(b1, b2, k));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function terrainHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const edgeTaper = 1 - smoothstep(TERRARIUM_RADIUS * 0.65, TERRARIUM_RADIUS, r);

  // Back-left mossy hillock where the bonsai & stone outcrop sit
  const dxHill = x + 0.68;
  const dzHill = z + 0.52;
  const hill = 0.42 * Math.exp(-(dxHill * dxHill + dzHill * dzHill) / 1.45);

  // Secondary gentle ridge on the right-back
  const dxRidge = x - 0.88;
  const dzRidge = z + 0.65;
  const ridge = 0.2 * Math.exp(-(dxRidge * dxRidge + dzRidge * dzRidge) / 0.85);

  // Micro-undulation
  const micro =
    0.045 * Math.sin(x * 2.1 + 0.4) * Math.cos(z * 1.9 - 0.3) +
    0.025 * Math.sin(x * 4.2 - z * 3.1);

  // Sunken basin for the clear forest pond
  const dPond = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
  const pondDepression = 0.29 * (1 - smoothstep(POND_RADIUS * 0.35, POND_RADIUS * 1.18, dPond));

  return SOIL_BASE_Y + (hill + ridge + micro) * edgeTaper - pondDepression;
}

export function isInsidePond(x: number, z: number, padding = 0.08): boolean {
  return Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + padding;
}

export function isInsideBasin(x: number, z: number, margin = 0.28): boolean {
  return Math.hypot(x, z) <= TERRARIUM_RADIUS - margin;
}

export function formatClock(timeOfDay: number): string {
  const wrapped = ((timeOfDay % 24) + 24) % 24;
  const hours = Math.floor(wrapped);
  const mins = Math.floor((wrapped - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getPhaseLabel(timeOfDay: number): string {
  const t = ((timeOfDay % 24) + 24) % 24;
  if (t < 5 || t >= 21) return 'Nightfall';
  if (t < 7.5) return 'Dawn';
  if (t < 11.5) return 'Morning';
  if (t < 16.5) return 'Daylight';
  if (t < 19) return 'Golden Hour';
  return 'Dusk';
}

export function computeLightingState(
  timeOfDay: number,
  weather: WeatherMode,
): LightingState {
  const t = ((timeOfDay % 24) + 24) % 24;

  // Sun angle: 6:00 = sunrise (0 rad), 12:00 = zenith (pi/2), 18:00 = sunset (pi)
  const sunAngle = ((t - 6) / 24) * Math.PI * 2;
  const sunSin = Math.sin(sunAngle); // >0 during day, <0 at night
  const sunCos = Math.cos(sunAngle);

  const daylightFactor = smoothstep(-0.08, 0.32, sunSin);
  const nightFactor = 1 - daylightFactor;
  const twilightFactor = Math.exp(-Math.pow(sunSin / 0.24, 2));
  const bioluminescence = smoothstep(0.18, -0.22, sunSin);

  // Orbit key light: sun by day, cool moon by night
  const isDaySide = sunSin >= -0.05;
  const activeSin = isDaySide ? Math.max(0.16, sunSin) : Math.max(0.24, -sunSin);
  const activeCos = isDaySide ? sunCos : -sunCos;
  const orbitR = 11.5;
  const keyX = activeCos * orbitR * 0.85;
  const keyY = activeSin * orbitR + 2.2;
  const keyZ = lerp(5.8, -3.5, (activeCos + 1) * 0.5);

  // Palette blending across Night -> Dawn/Golden -> Noon
  let keyColor = lerpHexColor('#84a9e8', '#fff4df', daylightFactor);
  keyColor = lerpHexColor(keyColor, '#ff9c54', twilightFactor * 0.85);

  let hemiSkyColor = lerpHexColor('#1c2a44', '#b8d7eb', daylightFactor);
  hemiSkyColor = lerpHexColor(hemiSkyColor, '#d98f6c', twilightFactor * 0.55);

  let hemiGroundColor = lerpHexColor('#0d1412', '#394734', daylightFactor);

  let backgroundColor = lerpHexColor('#0b1015', '#1d2723', daylightFactor);
  backgroundColor = lerpHexColor(backgroundColor, '#271e1c', twilightFactor * 0.55);

  // Weather modulation (rain/mist cool & mute bright sunlight, sunshower warms it)
  const overcast = weather === 'rain' ? 0.42 : weather === 'mist' ? 0.25 : 0;
  if (overcast > 0) {
    keyColor = lerpHexColor(keyColor, '#b7c9d4', overcast);
    backgroundColor = lerpHexColor(backgroundColor, '#131a1b', overcast * 0.85);
    hemiSkyColor = lerpHexColor(hemiSkyColor, '#8da2ad', overcast * 0.6);
  }
  if (weather === 'sunshower' && daylightFactor > 0.15) {
    keyColor = lerpHexColor(keyColor, '#ffd38c', 0.45);
    backgroundColor = lerpHexColor(backgroundColor, '#21251f', 0.35);
  }

  const sunIntensity = lerp(0.82, 2.75, daylightFactor) * (1 - overcast * 0.45);
  const hemiIntensity = lerp(0.55, 1.15, daylightFactor) * (1 - overcast * 0.15);
  const rimIntensity = lerp(0.95, 1.2, daylightFactor);
  const rimColor = lerpHexColor('#4c78a8', '#d7e6cc', daylightFactor);

  return {
    timeOfDay: t,
    clockLabel: formatClock(t),
    phaseLabel: getPhaseLabel(t),
    daylightFactor,
    twilightFactor,
    nightFactor,
    bioluminescence,
    keyPosition: [keyX, keyY, keyZ],
    keyColor,
    keyIntensity: sunIntensity,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    rimColor,
    rimIntensity,
    backgroundColor,
    fogColor: backgroundColor,
    exposure: lerp(0.96, 1.12, daylightFactor),
  };
}

export function computeWeatherState(
  mode: WeatherMode,
  humidityBias = 0,
): WeatherState {
  const bias = clamp(humidityBias, -0.25, 0.25);

  let base: Omit<WeatherState, 'mode'>;
  switch (mode) {
    case 'rain':
      base = {
        rainRate: 1.0,
        mistDensity: 0.35,
        condensation: 0.85,
        windStrength: 0.85,
        wetness: 0.95,
        humidityPct: 92,
        temperatureC: 18.5,
      };
      break;
    case 'mist':
      base = {
        rainRate: 0.0,
        mistDensity: 0.92,
        condensation: 0.62,
        windStrength: 0.28,
        wetness: 0.52,
        humidityPct: 84,
        temperatureC: 19.8,
      };
      break;
    case 'sunshower':
      base = {
        rainRate: 0.48,
        mistDensity: 0.28,
        condensation: 0.45,
        windStrength: 0.52,
        wetness: 0.68,
        humidityPct: 78,
        temperatureC: 22.4,
      };
      break;
    case 'clear':
    default:
      base = {
        rainRate: 0.0,
        mistDensity: 0.06,
        condensation: 0.14,
        windStrength: 0.18,
        wetness: 0.12,
        humidityPct: 62,
        temperatureC: 21.6,
      };
      break;
  }

  return {
    mode,
    rainRate: base.rainRate,
    mistDensity: clamp(base.mistDensity + bias * 0.4, 0, 1),
    condensation: clamp(base.condensation + bias * 0.65, 0.04, 1),
    windStrength: base.windStrength,
    wetness: clamp(base.wetness + bias * 0.3, 0, 1),
    humidityPct: Math.round(clamp(base.humidityPct + bias * 36, 35, 99)),
    temperatureC: Number((base.temperatureC - bias * 2).toFixed(1)),
  };
}

export const FLORA_CATALOG: Record<
  FloraKind,
  { name: string; botanicalName: string; description: string }
> = {
  bonsai: {
    name: 'Gnarled Ficus Bonsai',
    botanicalName: 'Ficus microcarpa',
    description:
      'Root-clasped centerpiece canopy anchored on the upper moss mound with aerial roots.',
  },
  fern: {
    name: 'Emerald Sword Fern',
    botanicalName: 'Nephrolepis exaltata',
    description:
      'Arching pinnate fronds that unfurl in high humidity and sway gently in conservatory drafts.',
  },
  succulent: {
    name: 'Rose-Tipped Echeveria',
    botanicalName: 'Echeveria elegans',
    description:
      'Fibonacci phyllotaxis rosette storing dew droplets across dusty glaucous leaves.',
  },
  mushroom: {
    name: 'Mooncap Mycena',
    botanicalName: 'Mycena chlorophos',
    description:
      'Clustered woodland fungi whose fluted caps softly bioluminesce after dusk.',
  },
  blossom: {
    name: 'Conservatory Star Moss',
    botanicalName: 'Fittonia & Oxalis',
    description:
      'Velvet cushion moss dotted with delicate ivory-pink botanical blooms.',
  },
};

export function createFloraSpec(
  kind: PlantableKind,
  x: number,
  z: number,
  seed: number,
  scale = 1,
): FloraSpec {
  const meta = FLORA_CATALOG[kind];
  return {
    id: `flora-${kind}-${seed}-${Math.round(x * 100)}-${Math.round(z * 100)}`,
    kind,
    name: meta.name,
    botanicalName: meta.botanicalName,
    description: meta.description,
    x,
    z,
    scale,
    rotationY: ((seed % 360) * Math.PI) / 180,
    seed,
  };
}

export function generateInitialFlora(seed: number): FloraSpec[] {
  const rng = mulberry32(seed);
  const items: FloraSpec[] = [];

  // 1. Hero Driftwood Bonsai on the elevated back-left hillock
  const bonsaiMeta = FLORA_CATALOG.bonsai;
  items.push({
    id: `flora-bonsai-hero-${seed}`,
    kind: 'bonsai',
    name: bonsaiMeta.name,
    botanicalName: bonsaiMeta.botanicalName,
    description: bonsaiMeta.description,
    x: -0.68,
    z: -0.52,
    scale: 1.0,
    rotationY: (rng() - 0.5) * 0.55,
    seed: Math.floor(rng() * 100000),
    isHero: true,
  });

  // Candidate placement helper avoiding pond, bonsai trunk, and neighbors
  const placed: Array<{ x: number; z: number; r: number }> = [
    { x: -0.68, z: -0.52, r: 0.72 },
    { x: POND_CENTER.x, z: POND_CENTER.z, r: POND_RADIUS + 0.16 },
    // Basalt stone outcrop zone
    { x: 0.85, z: -0.68, r: 0.52 },
  ];

  const tryPlace = (
    kind: PlantableKind,
    minDist: number,
    scaleRange: [number, number],
    preferNearPond = false,
  ) => {
    for (let attempt = 0; attempt < 90; attempt++) {
      let x: number;
      let z: number;
      if (preferNearPond && attempt < 45) {
        const ang = rng() * Math.PI * 2;
        const dist = POND_RADIUS + 0.18 + rng() * 0.45;
        x = POND_CENTER.x + Math.cos(ang) * dist;
        z = POND_CENTER.z + Math.sin(ang) * dist;
      } else {
        const ang = rng() * Math.PI * 2;
        const rad = 0.45 + Math.sqrt(rng()) * (TERRARIUM_RADIUS - 0.82);
        x = Math.cos(ang) * rad;
        z = Math.sin(ang) * rad;
      }

      if (!isInsideBasin(x, z, 0.36)) continue;
      if (isInsidePond(x, z, 0.14)) continue;

      let overlaps = false;
      for (const p of placed) {
        if (Math.hypot(x - p.x, z - p.z) < p.r + minDist) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      const s = lerp(scaleRange[0], scaleRange[1], rng());
      const itemSeed = Math.floor(rng() * 1_000_000);
      items.push(createFloraSpec(kind, x, z, itemSeed, s));
      placed.push({ x, z, r: minDist });
      return;
    }
  };

  // Place rich layered composition: ferns, succulents, glowing mushrooms, blossoms
  for (let i = 0; i < 4; i++) tryPlace('fern', 0.44, [0.85, 1.2], i === 0);
  for (let i = 0; i < 4; i++) tryPlace('succulent', 0.34, [0.88, 1.18], false);
  for (let i = 0; i < 4; i++) tryPlace('mushroom', 0.3, [0.85, 1.2], i < 2);
  for (let i = 0; i < 5; i++) tryPlace('blossom', 0.28, [0.85, 1.15], i === 0);

  return items;
}
