import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TerrariumControls } from './components/TerrariumControls';
import { TerrariumViewport } from './components/TerrariumViewport';
import {
  POND_CENTER,
  POND_RADIUS,
  TERRARIUM_RADIUS,
  computeLightingState,
  computeWeatherState,
  createFloraSpec,
  generateInitialFlora,
  isInsideBasin,
  isInsidePond,
  mulberry32,
} from './terrarium/environmentMath';
import { TerrariumSoundscape } from './terrarium/soundscape';
import type {
  CameraPreset,
  FloraSpec,
  GlassMode,
  InspectedSpecimen,
  InteractionMode,
  PlantableKind,
  WeatherMode,
} from './terrarium/types';

export default function App() {
  const [floraSeed, setFloraSeed] = useState<number>(42);
  const [floraSpecs, setFloraSpecs] = useState<FloraSpec[]>(() =>
    generateInitialFlora(42),
  );
  const [timeOfDay, setTimeOfDay] = useState<number>(13.5);
  const [autoCycle, setAutoCycle] = useState<boolean>(false);
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('clear');
  const [humidityBias, setHumidityBias] = useState<number>(0);
  const [glassMode, setGlassMode] = useState<GlassMode>('full');
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>('inspect');
  const [plantKind, setPlantKind] = useState<PlantableKind>('fern');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [cameraResetNonce, setCameraResetNonce] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [inspected, setInspected] = useState<InspectedSpecimen | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const soundRef = useRef<TerrariumSoundscape | null>(null);
  const nextPlantCounterRef = useRef<number>(1);
  const noteTimerRef = useRef<number | null>(null);

  const lighting = useMemo(
    () => computeLightingState(timeOfDay, weatherMode),
    [timeOfDay, weatherMode],
  );
  const weather = useMemo(
    () => computeWeatherState(weatherMode, humidityBias),
    [weatherMode, humidityBias],
  );

  const showTransientNote = useCallback((msg: string) => {
    setStatusNote(msg);
    if (noteTimerRef.current) {
      window.clearTimeout(noteTimerRef.current);
    }
    noteTimerRef.current = window.setTimeout(() => {
      setStatusNote(null);
    }, 3200);
  }, []);

  useEffect(() => {
    const sound = new TerrariumSoundscape();
    soundRef.current = sound;
    return () => {
      sound.dispose();
      soundRef.current = null;
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    soundRef.current?.update(weatherMode, lighting.nightFactor);
  }, [weatherMode, lighting.nightFactor, soundEnabled]);

  // Keyboard shortcut 'H' to collapse/expand HUD dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const handleTimeChange = useCallback((nextTime: number) => {
    setAutoCycle(false);
    setTimeOfDay(nextTime);
  }, []);

  const handlePlantAt = useCallback(
    (x: number, z: number) => {
      const seed = floraSeed * 97 + nextPlantCounterRef.current++ * 313;
      const spec = createFloraSpec(plantKind, x, z, seed, 0.95);
      setFloraSpecs((prev) => [...prev, spec]);
      setInspected(null);
      showTransientNote(`Planted ${spec.name}`);
    },
    [floraSeed, plantKind, showTransientNote],
  );

  const handleQuickPlant = useCallback(() => {
    const idx = nextPlantCounterRef.current++;
    const rng = mulberry32(floraSeed * 131 + idx * 7919);

    for (let attempt = 0; attempt < 80; attempt++) {
      const ang = rng() * Math.PI * 2;
      const rad = 0.4 + Math.sqrt(rng()) * (TERRARIUM_RADIUS - 0.8);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      if (!isInsideBasin(x, z, 0.36)) continue;
      if (isInsidePond(x, z, 0.16)) continue;

      const tooClose = floraSpecs.some(
        (f) => Math.hypot(f.x - x, f.z - z) < (f.isHero ? 0.65 : 0.34),
      );
      if (tooClose) continue;

      const spec = createFloraSpec(
        plantKind,
        x,
        z,
        Math.floor(rng() * 999999),
        0.92 + rng() * 0.22,
      );
      setFloraSpecs((prev) => [...prev, spec]);
      setInspected(null);
      showTransientNote(`Planted ${spec.name}`);
      return;
    }

    // Fallback spot near pond bank if crowded
    const fallbackX = POND_CENTER.x - POND_RADIUS - 0.35;
    const fallbackZ = POND_CENTER.z - 0.25;
    const spec = createFloraSpec(plantKind, fallbackX, fallbackZ, idx * 991, 0.95);
    setFloraSpecs((prev) => [...prev, spec]);
    showTransientNote(`Planted ${spec.name}`);
  }, [floraSeed, floraSpecs, plantKind, showTransientNote]);

  const handlePruneFlora = useCallback(
    (id: string) => {
      setFloraSpecs((prev) => {
        const target = prev.find((f) => f.id === id);
        if (!target) return prev;
        if (target.isHero) {
          showTransientNote('The centerpiece Ficus Bonsai is anchored to the mound.');
          return prev;
        }
        showTransientNote(`Pruned ${target.name}`);
        return prev.filter((f) => f.id !== id);
      });
      setInspected((prev) => (prev?.id === id ? null : prev));
    },
    [showTransientNote],
  );

  const handleRegenerateFlora = useCallback(() => {
    const nextSeed = (floraSeed + 17) % 10000;
    setFloraSeed(nextSeed);
    setFloraSpecs(generateInitialFlora(nextSeed));
    setInspected(null);
    showTransientNote('Generated a fresh botanical arrangement');
  }, [floraSeed, showTransientNote]);

  const handleResetCamera = useCallback(() => {
    setCameraPreset('overview');
    setCameraResetNonce((n) => n + 1);
  }, []);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#0e1311]"
      data-time-phase={lighting.phaseLabel}
      data-weather={weatherMode}
      data-flora-count={floraSpecs.length}
      data-glass-mode={glassMode}
      data-dock-collapsed={String(dockCollapsed)}
    >
      <TerrariumViewport
        floraSpecs={floraSpecs}
        floraSeed={floraSeed}
        timeOfDay={timeOfDay}
        weatherMode={weatherMode}
        humidityBias={humidityBias}
        glassMode={glassMode}
        autoCycle={autoCycle}
        autoRotate={autoRotate}
        interactionMode={interactionMode}
        cameraPreset={cameraPreset}
        cameraResetNonce={cameraResetNonce}
        onTimeTick={setTimeOfDay}
        onInspectSpecimen={setInspected}
        onPlantAt={handlePlantAt}
        onPruneFlora={handlePruneFlora}
      />

      <TerrariumControls
        lighting={lighting}
        weather={weather}
        timeOfDay={timeOfDay}
        weatherMode={weatherMode}
        humidityBias={humidityBias}
        glassMode={glassMode}
        autoCycle={autoCycle}
        autoRotate={autoRotate}
        soundEnabled={soundEnabled}
        interactionMode={interactionMode}
        plantKind={plantKind}
        cameraPreset={cameraPreset}
        floraCount={floraSpecs.length}
        inspected={inspected}
        statusNote={statusNote}
        dockCollapsed={dockCollapsed}
        onTimeChange={handleTimeChange}
        onToggleAutoCycle={() => setAutoCycle((prev) => !prev)}
        onWeatherChange={setWeatherMode}
        onHumidityBiasChange={setHumidityBias}
        onGlassModeChange={setGlassMode}
        onInteractionModeChange={setInteractionMode}
        onPlantKindChange={setPlantKind}
        onQuickPlant={handleQuickPlant}
        onRegenerateFlora={handleRegenerateFlora}
        onCameraPresetChange={(preset) => {
          setCameraPreset(preset);
          setCameraResetNonce((n) => n + 1);
        }}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        onResetCamera={handleResetCamera}
        onToggleSound={handleToggleSound}
        onToggleDock={() => setDockCollapsed((prev) => !prev)}
        onDismissInspected={() => setInspected(null)}
      />
    </main>
  );
}
