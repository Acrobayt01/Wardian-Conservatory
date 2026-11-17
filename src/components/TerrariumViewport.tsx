import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computeLightingState,
  computeWeatherState,
  isInsideBasin,
  isInsidePond,
} from '../terrarium/environmentMath';
import {
  type FloraInstanceHandle,
  buildFloraModel,
  buildGroundCoverInstancedMesh,
} from '../terrarium/floraBuilder';
import {
  type ProceduralTextures,
  createProceduralTextures,
  disposeProceduralTextures,
} from '../terrarium/textures';
import type {
  CameraPreset,
  FloraSpec,
  GlassMode,
  InspectedSpecimen,
  InteractionMode,
  WeatherMode,
} from '../terrarium/types';
import {
  type TerrariumVesselHandles,
  buildTerrariumVessel,
} from '../terrarium/vesselBuilder';
import { TerrariumWeatherSystem } from '../terrarium/weatherSystem';

interface TerrariumViewportProps {
  floraSpecs: FloraSpec[];
  floraSeed: number;
  timeOfDay: number;
  weatherMode: WeatherMode;
  humidityBias: number;
  glassMode: GlassMode;
  autoCycle: boolean;
  autoRotate: boolean;
  interactionMode: InteractionMode;
  cameraPreset: CameraPreset;
  cameraResetNonce: number;
  onTimeTick: (nextTime: number) => void;
  onInspectSpecimen: (specimen: InspectedSpecimen | null) => void;
  onPlantAt: (x: number, z: number) => void;
  onPruneFlora: (id: string) => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [6.5, 4.1, 6.8], target: [0, 1.15, 0] },
  canopy: { pos: [-2.4, 2.55, 2.35], target: [-0.55, 1.45, -0.45] },
  floor: { pos: [2.55, 1.28, 2.75], target: [0.05, 0.72, -0.05] },
  pond: { pos: [2.85, 1.65, 2.65], target: [0.85, 0.42, 0.65] },
};

const _bgColor = new THREE.Color();
const _keyColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _rimColor = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

export function TerrariumViewport({
  floraSpecs,
  floraSeed,
  timeOfDay,
  weatherMode,
  humidityBias,
  glassMode,
  autoCycle,
  autoRotate,
  interactionMode,
  cameraPreset,
  cameraResetNonce,
  onTimeTick,
  onInspectSpecimen,
  onPlantAt,
  onPruneFlora,
}: TerrariumViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Refs synced to props so the Three.js scene mounts once and never tears down
  const stateRef = useRef({
    timeOfDay,
    weatherMode,
    humidityBias,
    glassMode,
    autoCycle,
    autoRotate,
    interactionMode,
  });
  stateRef.current = {
    timeOfDay,
    weatherMode,
    humidityBias,
    glassMode,
    autoCycle,
    autoRotate,
    interactionMode,
  };

  const callbacksRef = useRef({
    onTimeTick,
    onInspectSpecimen,
    onPlantAt,
    onPruneFlora,
  });
  callbacksRef.current = {
    onTimeTick,
    onInspectSpecimen,
    onPlantAt,
    onPruneFlora,
  };

  // Scene object refs for incremental flora/camera updates
  const sceneHandlesRef = useRef<{
    floraGroup: THREE.Group;
    floraHandles: Map<string, FloraInstanceHandle>;
    groundCover: ReturnType<typeof buildGroundCoverInstancedMesh> | null;
    vessel: TerrariumVesselHandles | null;
    cameraTransition: {
      active: boolean;
      pos: [number, number, number];
      target: [number, number, number];
    };
  }>({
    floraGroup: new THREE.Group(),
    floraHandles: new Map(),
    groundCover: null,
    vessel: null,
    cameraTransition: {
      active: false,
      pos: CAMERA_PRESETS.overview.pos,
      target: CAMERA_PRESETS.overview.target,
    },
  });

  // Trigger smooth damped camera transition on preset/reset change
  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset];
    sceneHandlesRef.current.cameraTransition = {
      active: true,
      pos: preset.pos,
      target: preset.target,
    };
  }, [cameraPreset, cameraResetNonce]);

  // Incrementally sync floraSpecs into the 3D scene without rebuilding renderer
  useEffect(() => {
    const { floraGroup, floraHandles } = sceneHandlesRef.current;
    const incomingIds = new Set(floraSpecs.map((s) => s.id));

    // Remove pruned or replaced specimens
    for (const [id, handle] of floraHandles.entries()) {
      if (!incomingIds.has(id)) {
        floraGroup.remove(handle.group);
        handle.dispose();
        floraHandles.delete(id);
      }
    }

    // Add new specimens (animate scale up if added after initial mount)
    const hadExisting = floraHandles.size > 0;
    for (const spec of floraSpecs) {
      if (!floraHandles.has(spec.id)) {
        const handle = buildFloraModel(spec, hadExisting);
        floraGroup.add(handle.group);
        floraHandles.set(spec.id, handle);
      }
    }
  }, [floraSpecs]);

  // Rebuild instanced ground cover when floraSeed changes
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles.vessel) return;
    if (handles.groundCover) {
      handles.floraGroup.remove(handles.groundCover.mesh);
      handles.groundCover.dispose();
    }
    const gc = buildGroundCoverInstancedMesh(floraSeed);
    handles.floraGroup.add(gc.mesh);
    handles.groundCover = gc;
  }, [floraSeed]);

  // Mount Three.js WebGLRenderer & Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'terrarium-canvas');
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const initialLight = computeLightingState(
      stateRef.current.timeOfDay,
      stateRef.current.weatherMode,
    );
    scene.background = new THREE.Color(initialLight.backgroundColor);
    scene.fog = new THREE.FogExp2(initialLight.fogColor, 0.048);

    // Mandatory studio PMREM environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.2 + initialLight.daylightFactor * 0.58;
    pmremGenerator.dispose();

    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 80);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.6;
    controls.maxDistance = 12.5;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.enablePan = false;
    controls.update();

    const onControlsStart = () => {
      sceneHandlesRef.current.cameraTransition.active = false;
    };
    controls.addEventListener('start', onControlsStart);

    // 3-Point Studio & Day/Night Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialLight.hemiSkyColor,
      initialLight.hemiGroundColor,
      initialLight.hemiIntensity,
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(
      initialLight.keyColor,
      initialLight.keyIntensity,
    );
    keyLight.position.set(...initialLight.keyPosition);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 26;
    const shadowBound = 4.2;
    keyLight.shadow.camera.left = -shadowBound;
    keyLight.shadow.camera.right = shadowBound;
    keyLight.shadow.camera.top = shadowBound;
    keyLight.shadow.camera.bottom = -shadowBound;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(
      initialLight.rimColor,
      initialLight.rimIntensity,
    );
    rimLight.position.set(-5.5, 4.2, -5.0);
    scene.add(rimLight);

    // Bioluminescent night accent point light inside terrarium hollow
    const bioLight = new THREE.PointLight(0x4bf5c6, 0, 4.2, 1.8);
    bioLight.position.set(0.3, 0.95, 0.2);
    scene.add(bioLight);

    // Procedural Textures, Vessel, Flora Group & Weather System
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const textures: ProceduralTextures = createProceduralTextures(maxAnisotropy);
    const vessel = buildTerrariumVessel(textures, isSoftwareGl);
    scene.add(vessel.root);

    const handles = sceneHandlesRef.current;
    handles.vessel = vessel;
    handles.floraGroup.name = 'FloraCollection';
    scene.add(handles.floraGroup);

    const gc = buildGroundCoverInstancedMesh(floraSeed);
    handles.floraGroup.add(gc.mesh);
    handles.groundCover = gc;

    // Populate initial flora synchronously on mount
    for (const spec of floraSpecs) {
      if (!handles.floraHandles.has(spec.id)) {
        const fh = buildFloraModel(spec, false);
        handles.floraGroup.add(fh.group);
        handles.floraHandles.set(spec.id, fh);
      }
    }

    const weatherSystem = new TerrariumWeatherSystem(textures);
    scene.add(weatherSystem.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for Inspect / Plant / Prune
    const raycaster = new THREE.Raycaster();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // Was an orbit drag

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_pointerNdc, camera);

      const mode = stateRef.current.interactionMode;
      if (mode === 'plant') {
        const hits = raycaster.intersectObject(vessel.soilMesh, false);
        if (hits.length > 0) {
          const pt = hits[0].point;
          if (isInsideBasin(pt.x, pt.z, 0.34) && !isInsidePond(pt.x, pt.z, 0.14)) {
            callbacksRef.current.onPlantAt(pt.x, pt.z);
          }
        }
        return;
      }

      // Inspect or Prune: raycast flora groups and vessel landmarks
      const floraRoots: THREE.Object3D[] = [];
      for (const h of handles.floraHandles.values()) {
        floraRoots.push(h.group);
      }
      const targets =
        mode === 'prune'
          ? floraRoots
          : [...floraRoots, ...vessel.interactables.filter((o) => o !== vessel.soilMesh)];

      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length === 0) {
        if (mode === 'inspect') {
          callbacksRef.current.onInspectSpecimen(null);
        }
        return;
      }

      const hitObj = hits[0].object;
      const floraId = hitObj.userData.floraId as string | undefined;

      if (mode === 'prune') {
        if (floraId) {
          callbacksRef.current.onPruneFlora(floraId);
        }
        return;
      }

      if (floraId) {
        const fh = handles.floraHandles.get(floraId);
        if (fh) {
          fh.highlightPulse = 0.55;
        }
      }
      const specimen = hitObj.userData.specimen as InspectedSpecimen | undefined;
      callbacksRef.current.onInspectSpecimen(specimen ?? null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop with software-WebGL afterDraw pacing
    let frameId = 0;
    let disposed = false;
    let lastNow = performance.now();
    let elapsed = 0;
    let lastHudSync = 0;
    let simTimeOfDay = stateRef.current.timeOfDay;
    let lastPropTime = stateRef.current.timeOfDay;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      elapsed += dt;

      const st = stateRef.current;

      // Sync manual time changes, or advance smoothly when autoCycle is on
      if (Math.abs(st.timeOfDay - lastPropTime) > 0.001) {
        simTimeOfDay = st.timeOfDay;
        lastPropTime = st.timeOfDay;
      }
      if (st.autoCycle) {
        simTimeOfDay = (simTimeOfDay + dt * 0.45) % 24;
        if (now - lastHudSync > 140) {
          lastHudSync = now;
          lastPropTime = simTimeOfDay;
          callbacksRef.current.onTimeTick(simTimeOfDay);
        }
      }

      // Compute lighting & weather physics
      const light = computeLightingState(simTimeOfDay, st.weatherMode);
      const weather = computeWeatherState(st.weatherMode, st.humidityBias);

      // Update scene atmosphere & 3-point lighting smoothly
      _bgColor.set(light.backgroundColor);
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(_bgColor, 1 - Math.exp(-5 * dt));
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
        const targetFogDensity = 0.046 + weather.mistDensity * 0.022;
        scene.fog.density = THREE.MathUtils.damp(scene.fog.density, targetFogDensity, 4, dt);
      }

      const targetEnvIntensity = 0.16 + light.daylightFactor * 0.64;
      scene.environmentIntensity = THREE.MathUtils.damp(
        scene.environmentIntensity,
        targetEnvIntensity,
        5,
        dt,
      );

      _keyColor.set(light.keyColor);
      keyLight.color.lerp(_keyColor, 1 - Math.exp(-6 * dt));
      keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, light.keyIntensity, 6, dt);
      keyLight.position.set(...light.keyPosition);

      _hemiSky.set(light.hemiSkyColor);
      _hemiGround.set(light.hemiGroundColor);
      hemiLight.color.lerp(_hemiSky, 1 - Math.exp(-6 * dt));
      hemiLight.groundColor.lerp(_hemiGround, 1 - Math.exp(-6 * dt));
      hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, light.hemiIntensity, 6, dt);

      _rimColor.set(light.rimColor);
      rimLight.color.lerp(_rimColor, 1 - Math.exp(-6 * dt));
      rimLight.intensity = THREE.MathUtils.damp(rimLight.intensity, light.rimIntensity, 6, dt);

      bioLight.intensity = THREE.MathUtils.damp(
        bioLight.intensity,
        light.bioluminescence * 1.45,
        4,
        dt,
      );
      renderer.toneMappingExposure = THREE.MathUtils.damp(
        renderer.toneMappingExposure,
        light.exposure,
        5,
        dt,
      );

      // Glass mode & condensation modulation
      const targetGlassVisible = st.glassMode === 'full';
      vessel.glassGroup.visible = targetGlassVisible;
      vessel.condensationMat.opacity = THREE.MathUtils.damp(
        vessel.condensationMat.opacity,
        targetGlassVisible ? weather.condensation * 0.42 : 0,
        4,
        dt,
      );

      // Surface wetness sheen on soil, rocks, pond & foliage
      vessel.soilMat.roughness = THREE.MathUtils.damp(
        vessel.soilMat.roughness,
        0.92 - weather.wetness * 0.34,
        3.5,
        dt,
      );
      vessel.rockMat.roughness = THREE.MathUtils.damp(
        vessel.rockMat.roughness,
        0.8 - weather.wetness * 0.42,
        3.5,
        dt,
      );
      vessel.waterMesh.position.y =
        0.27 + Math.sin(elapsed * 1.6) * (0.002 + weather.rainRate * 0.003);

      // Animate flora sway, planting spring pop-in, and night bioluminescence
      for (const fh of handles.floraHandles.values()) {
        if (Math.abs(fh.currentScale - fh.targetScale) > 0.002 || fh.highlightPulse > 0.005) {
          fh.currentScale = THREE.MathUtils.damp(fh.currentScale, fh.targetScale, 8, dt);
          fh.highlightPulse = THREE.MathUtils.damp(fh.highlightPulse, 0, 7, dt);
          fh.group.scale.setScalar(fh.currentScale * (1 + fh.highlightPulse * 0.16));
        }

        const swaySpeed = 1.15 + weather.windStrength * 1.6;
        const swayMagnitude = fh.swayAmp * (0.65 + weather.windStrength * 1.35);
        fh.group.rotation.z =
          Math.sin(elapsed * swaySpeed + fh.swayPhase) * swayMagnitude;
        fh.group.rotation.x =
          Math.cos(elapsed * (swaySpeed * 0.85) + fh.swayPhase) * swayMagnitude * 0.6;

        for (const bm of fh.biolumMaterials) {
          const pulse = 0.85 + 0.15 * Math.sin(elapsed * 2.2 + fh.swayPhase);
          bm.emissiveIntensity = THREE.MathUtils.damp(
            bm.emissiveIntensity,
            0.05 + light.bioluminescence * 1.45 * pulse,
            4,
            dt,
          );
        }
        for (const fm of fh.foliageMaterials) {
          fm.roughness = THREE.MathUtils.damp(
            fm.roughness,
            0.65 - weather.wetness * 0.28,
            3.5,
            dt,
          );
        }
      }

      // Weather particles (rain, mist, fireflies)
      weatherSystem.update(dt, elapsed, weather, light.bioluminescence);

      // Smooth damped camera preset transitions
      if (handles.cameraTransition.active) {
        _targetCamPos.set(...handles.cameraTransition.pos);
        _targetLookAt.set(...handles.cameraTransition.target);
        const dampAlpha = 1 - Math.exp(-5.2 * dt);
        camera.position.lerp(_targetCamPos, dampAlpha);
        controls.target.lerp(_targetLookAt, dampAlpha);
        if (
          camera.position.distanceTo(_targetCamPos) < 0.025 &&
          controls.target.distanceTo(_targetLookAt) < 0.025
        ) {
          handles.cameraTransition.active = false;
        }
      }

      controls.autoRotate = st.autoRotate && !isSoftwareGl;
      controls.autoRotateSpeed = 0.65;
      controls.update();

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      for (const fh of handles.floraHandles.values()) {
        fh.dispose();
      }
      handles.floraHandles.clear();
      handles.groundCover?.dispose();
      handles.groundCover = null;
      weatherSystem.dispose();
      vessel.dispose();
      handles.vessel = null;
      disposeProceduralTextures(textures);
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mountRef}
        className={`w-full h-full ${
          interactionMode === 'plant'
            ? 'cursor-crosshair'
            : interactionMode === 'prune'
              ? 'cursor-not-allowed'
              : 'cursor-grab active:cursor-grabbing'
        }`}
      />
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#121715] text-[#edf2ee] p-6 text-center">
          <h2 className="font-display text-2xl font-semibold mb-2">
            3D Viewport Restoring
          </h2>
          <p className="text-sm text-[#a6b5aa] max-w-md">
            The WebGL graphics context was temporarily suspended by the browser.
            It will resume automatically when GPU resources are available.
          </p>
        </div>
      )}
    </div>
  );
}
