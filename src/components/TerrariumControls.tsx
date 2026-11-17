import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  CloudRain,
  CloudSun,
  Compass,
  Droplets,
  Eye,
  EyeOff,
  Flower2,
  Moon,
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Search,
  Shuffle,
  Sprout,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { FLORA_CATALOG } from '../terrarium/environmentMath';
import type {
  CameraPreset,
  GlassMode,
  InspectedSpecimen,
  InteractionMode,
  LightingState,
  PlantableKind,
  WeatherMode,
  WeatherState,
} from '../terrarium/types';

export type DockTab = 'atmosphere' | 'botany' | 'camera';

interface TerrariumControlsProps {
  lighting: LightingState;
  weather: WeatherState;
  timeOfDay: number;
  weatherMode: WeatherMode;
  humidityBias: number;
  glassMode: GlassMode;
  autoCycle: boolean;
  autoRotate: boolean;
  soundEnabled: boolean;
  interactionMode: InteractionMode;
  plantKind: PlantableKind;
  cameraPreset: CameraPreset;
  floraCount: number;
  inspected: InspectedSpecimen | null;
  statusNote: string | null;
  dockCollapsed: boolean;
  onTimeChange: (time: number) => void;
  onToggleAutoCycle: () => void;
  onWeatherChange: (mode: WeatherMode) => void;
  onHumidityBiasChange: (bias: number) => void;
  onGlassModeChange: (mode: GlassMode) => void;
  onInteractionModeChange: (mode: InteractionMode) => void;
  onPlantKindChange: (kind: PlantableKind) => void;
  onQuickPlant: () => void;
  onRegenerateFlora: () => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
  onToggleAutoRotate: () => void;
  onResetCamera: () => void;
  onToggleSound: () => void;
  onToggleDock: () => void;
  onDismissInspected: () => void;
}

const TIME_PRESETS: Array<{ label: string; hour: number }> = [
  { label: 'Dawn', hour: 6.2 },
  { label: 'Noon', hour: 13.0 },
  { label: 'Golden', hour: 17.8 },
  { label: 'Night', hour: 22.5 },
];

const WEATHER_OPTIONS: Array<{
  id: WeatherMode;
  label: string;
  Icon: typeof Sun;
}> = [
  { id: 'clear', label: 'Clear', Icon: Sun },
  { id: 'mist', label: 'Mist', Icon: CloudFog },
  { id: 'rain', label: 'Rain', Icon: CloudRain },
  { id: 'sunshower', label: 'Sunshower', Icon: CloudSun },
];

const PLANT_OPTIONS: Array<{ id: PlantableKind; label: string }> = [
  { id: 'fern', label: 'Sword Fern' },
  { id: 'succulent', label: 'Echeveria' },
  { id: 'mushroom', label: 'Mooncap' },
  { id: 'blossom', label: 'Star Moss' },
];

const CAMERA_OPTIONS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'floor', label: 'Forest Floor' },
  { id: 'pond', label: 'Mirror Pond' },
];

export function TerrariumControls({
  lighting,
  weather,
  timeOfDay,
  weatherMode,
  humidityBias,
  glassMode,
  autoCycle,
  autoRotate,
  soundEnabled,
  interactionMode,
  plantKind,
  cameraPreset,
  floraCount,
  inspected,
  statusNote,
  dockCollapsed,
  onTimeChange,
  onToggleAutoCycle,
  onWeatherChange,
  onHumidityBiasChange,
  onGlassModeChange,
  onInteractionModeChange,
  onPlantKindChange,
  onQuickPlant,
  onRegenerateFlora,
  onCameraPresetChange,
  onToggleAutoRotate,
  onResetCamera,
  onToggleSound,
  onToggleDock,
  onDismissInspected,
}: TerrariumControlsProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('atmosphere');

  return (
    <>
      {/* Top-Left Editorial Title & Unboxed Microclimate Metadata */}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-10 flex items-start justify-between px-5 pt-4 sm:px-7 sm:pt-5">
        <div className="pointer-events-auto">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#edf2ee] leading-none">
            Wardian Conservatory
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#b7c5ba]">
            <span className="font-mono-tabular text-[#e2ecd9]" data-testid="clock-readout">
              {lighting.clockLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span data-testid="phase-readout">{lighting.phaseLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular" data-testid="humidity-readout">
              {weather.humidityPct}% RH
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{weather.temperatureC}°C</span>
          </p>
        </div>

        {/* Top-Right Compact Utility Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute Ambient Sound' : 'Enable Ambient Sound'}
            title={soundEnabled ? 'Mute Ambient Sound' : 'Ambient Sound'}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-[#2a3b30] border-[#78a172]/50 text-[#e4f0dc]'
                : 'bg-[#131815]/90 border-white/10 text-[#b7c5ba] hover:text-[#edf2ee] hover:border-white/25'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onResetCamera}
            aria-label="Reset Camera View"
            title="Reset Camera View"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#131815]/90 border border-white/10 text-[#b7c5ba] hover:text-[#edf2ee] hover:border-white/25 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Bottom Dock Container + Optional Specimen Inspector Strip */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-10 flex w-[min(860px,94vw)] -translate-x-1/2 flex-col items-center">
        {/* Status Toast or Botanical Specimen Inspector */}
        {inspected && !dockCollapsed && (
          <section
            aria-label="Inspected Specimen Details"
            className="pointer-events-auto mb-2.5 flex w-full max-w-xl items-start justify-between gap-4 rounded-xl border border-white/12 bg-[#131915]/95 px-4 py-3 text-left shadow-xl"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-display text-lg font-semibold text-[#edf2ee]">
                  {inspected.name}
                </h2>
                <span className="text-xs italic text-[#9eb3a2]">
                  {inspected.botanicalName}
                </span>
                <span className="text-xs text-[#8ba18f]">
                  · {inspected.moisturePreference}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#c6d2c8]">
                {inspected.description}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissInspected}
              aria-label="Close Specimen Details"
              className="shrink-0 rounded-md p-1 text-[#9eb3a2] hover:bg-white/10 hover:text-[#edf2ee] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </section>
        )}

        {statusNote && !inspected && !dockCollapsed && (
          <div
            role="status"
            className="pointer-events-none mb-2 rounded-lg border border-white/10 bg-[#131915]/92 px-3.5 py-1.5 text-xs text-[#d6e4cc] shadow-lg"
          >
            {statusNote}
          </div>
        )}

        {/* Collapse / Expand Dock Handle */}
        <button
          type="button"
          onClick={onToggleDock}
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? 'Show Controls' : 'Hide Controls'}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#131915]/92 px-3 py-1 text-xs font-medium text-[#cdd9ce] hover:border-white/25 hover:text-[#edf2ee] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Collapsible Unified Control Dock */}
        {!dockCollapsed && (
          <section
            aria-label="Terrarium Controls"
            className="pointer-events-auto w-full rounded-xl border border-white/12 bg-[#131915]/94 p-3 sm:p-4 shadow-2xl"
          >
            {/* Top Tab Strip + Summary Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              <div role="tablist" aria-label="Control Categories" className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'atmosphere'}
                  onClick={() => setActiveTab('atmosphere')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'atmosphere'
                      ? 'bg-[#2a3b30] text-[#edf2ee]'
                      : 'text-[#9eb0a2] hover:text-[#edf2ee]'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Atmosphere</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'botany'}
                  onClick={() => setActiveTab('botany')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'botany'
                      ? 'bg-[#2a3b30] text-[#edf2ee]'
                      : 'text-[#9eb0a2] hover:text-[#edf2ee]'
                  }`}
                >
                  <Sprout className="h-3.5 w-3.5" />
                  <span>Botany</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'camera'}
                  onClick={() => setActiveTab('camera')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'camera'
                      ? 'bg-[#2a3b30] text-[#edf2ee]'
                      : 'text-[#9eb0a2] hover:text-[#edf2ee]'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Camera</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#9cb0a0]">
                <span className="font-mono-tabular" data-testid="flora-count-readout">
                  {floraCount} specimens
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() =>
                    onGlassModeChange(glassMode === 'full' ? 'open' : 'full')
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#d6e3d8] hover:border-white/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {glassMode === 'full' ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Full Glass</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Open View</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tab 1: Atmosphere (Day/Night & Weather) */}
            {activeTab === 'atmosphere' && (
              <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-12">
                {/* Day/Night Lighting Column */}
                <div className="md:col-span-6 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="time-of-day-slider"
                      className="text-xs font-medium text-[#d5e0d7]"
                    >
                      Solar Time
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-xs text-[#b5c4b8]">
                        {lighting.clockLabel} · {lighting.phaseLabel}
                      </span>
                      <button
                        type="button"
                        onClick={onToggleAutoCycle}
                        aria-pressed={autoCycle}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          autoCycle
                            ? 'border-[#78a172]/60 bg-[#2a3b30] text-[#e7f2df]'
                            : 'border-white/10 bg-white/5 text-[#aebeb1] hover:text-[#edf2ee]'
                        }`}
                      >
                        {autoCycle ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span>{autoCycle ? 'Cycling' : 'Cycle'}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    id="time-of-day-slider"
                    type="range"
                    min={0}
                    max={23.95}
                    step={0.1}
                    value={timeOfDay}
                    onChange={(e) => onTimeChange(parseFloat(e.target.value))}
                    className="terrarium-slider w-full"
                    aria-label="Solar Time of Day"
                  />

                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_PRESETS.map((preset) => {
                      const active = Math.abs(timeOfDay - preset.hour) < 0.7;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => onTimeChange(preset.hour)}
                          className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#78a172]/60 bg-[#27382c] text-[#eef5ea]'
                              : 'border-white/10 bg-white/4 text-[#b3c2b6] hover:border-white/25 hover:text-[#edf2ee]'
                          }`}
                        >
                          {preset.label === 'Night' && <Moon className="h-3 w-3" />}
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weather & Condensation Column */}
                <div className="md:col-span-6 space-y-2.5 md:border-l md:border-white/10 md:pl-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#d5e0d7]">
                      Microclimate Weather
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#9fb2a3]">
                      <Droplets className="h-3.5 w-3.5 text-[#8cc2b8]" />
                      <span className="font-mono-tabular">{weather.humidityPct}% RH</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {WEATHER_OPTIONS.map(({ id, label, Icon }) => {
                      const active = weatherMode === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onWeatherChange(id)}
                          aria-pressed={active}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#78a172]/60 bg-[#27382c] text-[#eef5ea]'
                              : 'border-white/10 bg-white/4 text-[#b3c2b6] hover:border-white/25 hover:text-[#edf2ee]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 pt-0.5">
                    <label
                      htmlFor="humidity-bias-slider"
                      className="text-xs text-[#aabba9] whitespace-nowrap"
                    >
                      Glass Dew
                    </label>
                    <input
                      id="humidity-bias-slider"
                      type="range"
                      min={-0.25}
                      max={0.25}
                      step={0.05}
                      value={humidityBias}
                      onChange={(e) => onHumidityBiasChange(parseFloat(e.target.value))}
                      className="terrarium-slider flex-1"
                      aria-label="Glass Dew and Moisture"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Botany (Inspect, Plant, Prune, Regenerate) */}
            {activeTab === 'botany' && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
                    <button
                      type="button"
                      onClick={() => onInteractionModeChange('inspect')}
                      aria-pressed={interactionMode === 'inspect'}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        interactionMode === 'inspect'
                          ? 'bg-[#2a3b30] text-[#edf2ee]'
                          : 'text-[#a7b8aa] hover:text-[#edf2ee]'
                      }`}
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onInteractionModeChange('plant')}
                      aria-pressed={interactionMode === 'plant'}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        interactionMode === 'plant'
                          ? 'bg-[#2a3b30] text-[#edf2ee]'
                          : 'text-[#a7b8aa] hover:text-[#edf2ee]'
                      }`}
                    >
                      <Sprout className="h-3.5 w-3.5" />
                      <span>Plant</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onInteractionModeChange('prune')}
                      aria-pressed={interactionMode === 'prune'}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        interactionMode === 'prune'
                          ? 'bg-[#3d2624] text-[#f5dedb]'
                          : 'text-[#a7b8aa] hover:text-[#edf2ee]'
                      }`}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      <span>Prune</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onQuickPlant}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#78a172]/50 bg-[#27382c] px-3 py-1.5 text-xs font-medium text-[#e9f4e2] hover:bg-[#314637] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Flower2 className="h-3.5 w-3.5" />
                      <span>Add {FLORA_CATALOG[plantKind].name.split(' ').pop()}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onRegenerateFlora}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#cfdcd1] hover:border-white/25 hover:text-[#edf2ee] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      <span>New Arrangement</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PLANT_OPTIONS.map((opt) => {
                      const active = plantKind === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onPlantKindChange(opt.id);
                            if (interactionMode !== 'plant') {
                              onInteractionModeChange('plant');
                            }
                          }}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'border-[#78a172]/60 bg-[#27382c] text-[#eef5ea]'
                              : 'border-white/10 bg-white/4 text-[#aebeb1] hover:border-white/25 hover:text-[#edf2ee]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-[#9cb0a0]">
                    {interactionMode === 'plant'
                      ? `Click on the soil bed inside the vessel to plant ${FLORA_CATALOG[plantKind].name}.`
                      : interactionMode === 'prune'
                        ? 'Click any fern, succulent, moss, or mushroom cluster to prune it.'
                        : 'Click any flora specimen, basalt outcrop, or pond to inspect.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 3: Camera Presets & Auto-Orbit */}
            {activeTab === 'camera' && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CAMERA_OPTIONS.map((cam) => {
                    const active = cameraPreset === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => onCameraPresetChange(cam.id)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'border-[#78a172]/60 bg-[#27382c] text-[#eef5ea]'
                            : 'border-white/10 bg-white/4 text-[#b3c2b6] hover:border-white/25 hover:text-[#edf2ee]'
                        }`}
                      >
                        {cam.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleAutoRotate}
                    aria-pressed={autoRotate}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      autoRotate
                        ? 'border-[#78a172]/60 bg-[#27382c] text-[#eef5ea]'
                        : 'border-white/10 bg-white/4 text-[#b3c2b6] hover:border-white/25 hover:text-[#edf2ee]'
                    }`}
                  >
                    <span>{autoRotate ? 'Auto-Orbit On' : 'Auto-Orbit Off'}</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
