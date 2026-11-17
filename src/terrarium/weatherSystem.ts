import * as THREE from 'three';
import {
  POND_CENTER,
  POND_WATER_Y,
  TERRARIUM_RADIUS,
  terrainHeightAt,
} from './environmentMath';
import type { ProceduralTextures } from './textures';
import type { WeatherState } from './types';

interface RainParticle {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
}

interface FireflyParticle {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  radius: number;
  speed: number;
}

interface MistPuffData {
  mesh: THREE.Mesh;
  baseAngle: number;
  radius: number;
  baseY: number;
  speed: number;
}

const _dummy = new THREE.Object3D();

export class TerrariumWeatherSystem {
  public readonly group = new THREE.Group();

  private readonly rainMesh: THREE.InstancedMesh;
  private readonly rainMat: THREE.MeshBasicMaterial;
  private readonly rainParticles: RainParticle[] = [];
  private readonly rainCount = 160;

  private readonly mistPuffs: MistPuffData[] = [];
  private readonly mistMat: THREE.MeshBasicMaterial;

  private readonly fireflyGeo: THREE.BufferGeometry;
  private readonly fireflyMat: THREE.PointsMaterial;
  private readonly fireflyPoints: THREE.Points;
  private readonly fireflies: FireflyParticle[] = [];

  private readonly splashRing: THREE.Mesh;
  private readonly splashMat: THREE.MeshBasicMaterial;
  private splashAge = 0;

  constructor(textures: ProceduralTextures) {
    this.group.name = 'WeatherSystem';

    // 1. Rain streaks inside the terrarium glass dome
    const rainGeo = new THREE.CylinderGeometry(0.0055, 0.003, 1, 5, 1);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xd6ecff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMat, this.rainCount);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.renderOrder = 4;

    const maxRainY = (rad: number) => {
      const clampedR = Math.max(0, Math.min(2.6, rad));
      return 2.66 + (1 - clampedR / 2.65) * 1.05 - 0.14;
    };

    for (let i = 0; i < this.rainCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * (TERRARIUM_RADIUS - 0.42);
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const ceiling = maxRainY(rad);
      const floorY = terrainHeightAt(x, z) + 0.12;
      this.rainParticles.push({
        x,
        z,
        y: floorY + Math.random() * Math.max(0.4, ceiling - floorY),
        speed: 4.1 + Math.random() * 2.1,
        len: 0.13 + Math.random() * 0.1,
      });
    }
    this.group.add(this.rainMesh);

    // 2. Pond ripple ring during rain
    const splashGeo = new THREE.RingGeometry(0.08, 0.11, 24);
    splashGeo.rotateX(-Math.PI / 2);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.splashRing = new THREE.Mesh(splashGeo, this.splashMat);
    this.splashRing.position.set(POND_CENTER.x, POND_WATER_Y + 0.008, POND_CENTER.z);
    this.splashRing.renderOrder = 3;
    this.group.add(this.splashRing);

    // 3. Swirling Volumetric Mist Layers
    const mistGeo = new THREE.PlaneGeometry(2.1, 2.1);
    this.mistMat = new THREE.MeshBasicMaterial({
      map: textures.mistPuff,
      color: 0xdbece8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(mistGeo, this.mistMat);
      puff.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.22;
      puff.renderOrder = 4;
      const baseAngle = (i / 12) * Math.PI * 2;
      const radius = 0.25 + (i % 3) * 0.42;
      const baseY = 0.65 + (i % 4) * 0.22;
      puff.position.set(
        Math.cos(baseAngle) * radius,
        baseY,
        Math.sin(baseAngle) * radius,
      );
      this.group.add(puff);
      this.mistPuffs.push({
        mesh: puff,
        baseAngle,
        radius,
        baseY,
        speed: 0.12 + (i % 3) * 0.05,
      });
    }

    // 4. Night Fireflies & Sunshower Pollen Motes
    const fireflyCount = 38;
    const positions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.25 + Math.sqrt(Math.random()) * (TERRARIUM_RADIUS - 0.55);
      const bx = Math.cos(ang) * rad;
      const bz = Math.sin(ang) * rad;
      const by = terrainHeightAt(bx, bz) + 0.28 + Math.random() * 1.45;
      this.fireflies.push({
        baseX: bx,
        baseY: by,
        baseZ: bz,
        phase: Math.random() * Math.PI * 2,
        radius: 0.12 + Math.random() * 0.22,
        speed: 0.55 + Math.random() * 0.75,
      });
      positions[i * 3] = bx;
      positions[i * 3 + 1] = by;
      positions[i * 3 + 2] = bz;
    }

    this.fireflyGeo = new THREE.BufferGeometry();
    this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      map: textures.softGlow,
      color: 0xc9ff9e,
      size: 0.13,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.fireflyPoints = new THREE.Points(this.fireflyGeo, this.fireflyMat);
    this.fireflyPoints.renderOrder = 5;
    this.group.add(this.fireflyPoints);
  }

  public update(
    dt: number,
    elapsed: number,
    weather: WeatherState,
    bioluminescence: number,
  ): void {
    // 1. Update Rain Streaks
    const activeRain = Math.round(weather.rainRate * this.rainCount);
    this.rainMesh.visible = activeRain > 0;
    this.rainMat.opacity = weather.rainRate * (weather.mode === 'sunshower' ? 0.42 : 0.58);

    if (activeRain > 0) {
      for (let i = 0; i < this.rainCount; i++) {
        if (i >= activeRain) {
          _dummy.scale.set(0, 0, 0);
          _dummy.updateMatrix();
          this.rainMesh.setMatrixAt(i, _dummy.matrix);
          continue;
        }
        const p = this.rainParticles[i];
        p.y -= p.speed * dt;
        const floorY = terrainHeightAt(p.x, p.z) + 0.08;
        if (p.y < floorY) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * (TERRARIUM_RADIUS - 0.42);
          p.x = Math.cos(ang) * rad;
          p.z = Math.sin(ang) * rad;
          p.y = 2.66 + (1 - rad / 2.65) * 1.05 - 0.14;
        }
        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(0, 0, weather.windStrength * 0.06);
        _dummy.scale.set(1, p.len, 1);
        _dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, _dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;

      // Pond splash ring
      this.splashAge = (this.splashAge + dt * 1.65) % 1;
      const ringScale = 0.5 + this.splashAge * 2.4;
      this.splashRing.scale.setScalar(ringScale);
      this.splashMat.opacity = (1 - this.splashAge) * weather.rainRate * 0.45;
      this.splashRing.visible = true;
    } else {
      this.splashRing.visible = false;
    }

    // 2. Update Mist Layers
    this.mistMat.opacity = weather.mistDensity * 0.26;
    const showMist = weather.mistDensity > 0.02;
    for (const puff of this.mistPuffs) {
      puff.mesh.visible = showMist;
      if (!showMist) continue;
      const a = puff.baseAngle + elapsed * puff.speed;
      puff.mesh.position.x = Math.cos(a) * puff.radius;
      puff.mesh.position.z = Math.sin(a) * puff.radius;
      puff.mesh.position.y = puff.baseY + Math.sin(elapsed * 0.6 + puff.baseAngle) * 0.06;
      puff.mesh.rotation.z = elapsed * 0.1 + puff.baseAngle;
    }

    // 3. Update Fireflies (night) / Golden Pollen (sunshower)
    const sunshowerMotes = weather.mode === 'sunshower' ? 0.55 : 0;
    const moteVisibility = Math.max(bioluminescence, sunshowerMotes);
    this.fireflyPoints.visible = moteVisibility > 0.03;
    if (this.fireflyPoints.visible) {
      this.fireflyMat.opacity = moteVisibility * 0.88;
      if (bioluminescence >= sunshowerMotes) {
        this.fireflyMat.color.setHex(0xc8ff94);
        this.fireflyMat.size = 0.13 + Math.sin(elapsed * 2.5) * 0.015;
      } else {
        this.fireflyMat.color.setHex(0xffe194);
        this.fireflyMat.size = 0.085;
      }

      const posAttr = this.fireflyGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.fireflies.length; i++) {
        const f = this.fireflies[i];
        const t = elapsed * f.speed + f.phase;
        posAttr.setXYZ(
          i,
          f.baseX + Math.cos(t) * f.radius,
          f.baseY + Math.sin(t * 1.4) * 0.14,
          f.baseZ + Math.sin(t * 0.9) * f.radius,
        );
      }
      posAttr.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.rainMesh.geometry.dispose();
    this.rainMat.dispose();
    this.splashRing.geometry.dispose();
    this.splashMat.dispose();
    this.mistPuffs[0]?.mesh.geometry.dispose();
    this.mistMat.dispose();
    this.fireflyGeo.dispose();
    this.fireflyMat.dispose();
  }
}
