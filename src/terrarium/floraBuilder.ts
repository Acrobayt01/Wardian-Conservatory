import * as THREE from 'three';
import {
  TERRARIUM_RADIUS,
  isInsidePond,
  mulberry32,
  terrainHeightAt,
} from './environmentMath';
import type { FloraSpec, InspectedSpecimen } from './types';

export interface FloraInstanceHandle {
  spec: FloraSpec;
  group: THREE.Group;
  swayPhase: number;
  swayAmp: number;
  targetScale: number;
  currentScale: number;
  highlightPulse: number;
  biolumMaterials: THREE.MeshStandardMaterial[];
  foliageMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

export function buildGroundCoverInstancedMesh(seed: number): {
  mesh: THREE.InstancedMesh;
  material: THREE.MeshStandardMaterial;
  dispose: () => void;
} {
  const rng = mulberry32(seed + 909);
  const count = 150;

  // Tapered curved grass / moss blade geometry (bottom-center pivot at y=0)
  const shape = new THREE.Shape();
  shape.moveTo(-0.012, 0);
  shape.lineTo(0.012, 0);
  shape.quadraticCurveTo(0.008, 0.075, 0.0, 0.14);
  shape.quadraticCurveTo(-0.008, 0.075, -0.012, 0);

  const bladeGeo = new THREE.ShapeGeometry(shape, 4);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const inst = new THREE.InstancedMesh(bladeGeo, bladeMat, count);
  inst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const greens = [0x4c7c39, 0x5c8b42, 0x3b6731, 0x6c9449];

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 1200) {
    guard++;
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * (TERRARIUM_RADIUS - 0.18);
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    if (isInsidePond(x, z, 0.04)) continue;

    const y = terrainHeightAt(x, z);
    dummy.position.set(x, y - 0.01, z);
    dummy.rotation.set(
      (rng() - 0.5) * 0.35,
      rng() * Math.PI * 2,
      (rng() - 0.5) * 0.35,
    );
    const s = 0.75 + rng() * 0.65;
    dummy.scale.set(s, s * (0.85 + rng() * 0.4), s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed, dummy.matrix);

    cTmp.setHex(greens[placed % greens.length]);
    inst.setColorAt(placed, cTmp);
    placed++;
  }

  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();

  return {
    mesh: inst,
    material: bladeMat,
    dispose: () => {
      bladeGeo.dispose();
      bladeMat.dispose();
    },
  };
}

export function buildFloraModel(
  spec: FloraSpec,
  startSmall = false,
): FloraInstanceHandle {
  const group = new THREE.Group();
  group.name = spec.id;
  const rng = mulberry32(spec.seed);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const biolumMaterials: THREE.MeshStandardMaterial[] = [];
  const foliageMaterials: THREE.MeshStandardMaterial[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  if (spec.kind === 'bonsai') {
    buildBonsai(group, rng, trackGeo, trackMat, foliageMaterials);
  } else if (spec.kind === 'fern') {
    buildFern(group, rng, trackGeo, trackMat, foliageMaterials);
  } else if (spec.kind === 'succulent') {
    buildSucculent(group, rng, trackGeo, trackMat, foliageMaterials);
  } else if (spec.kind === 'mushroom') {
    buildMushroomCluster(group, rng, trackGeo, trackMat, biolumMaterials);
  } else {
    buildBlossomMoss(group, rng, trackGeo, trackMat, foliageMaterials);
  }

  const baseY = terrainHeightAt(spec.x, spec.z);
  group.position.set(spec.x, baseY - 0.015, spec.z);
  group.rotation.y = spec.rotationY;

  const initialScale = startSmall ? 0.02 : spec.scale;
  group.scale.setScalar(initialScale);

  const specimenInfo: InspectedSpecimen = {
    id: spec.id,
    name: spec.name,
    botanicalName: spec.botanicalName,
    kind: spec.kind,
    description: spec.description,
    moisturePreference:
      spec.kind === 'succulent'
        ? 'Moderate · 45–65% RH'
        : spec.kind === 'bonsai'
          ? 'Balanced · 60–80% RH'
          : 'High Mist · 75–95% RH',
  };

  group.traverse((child) => {
    child.userData.floraId = spec.id;
    child.userData.specimen = specimenInfo;
  });

  return {
    spec,
    group,
    swayPhase: rng() * Math.PI * 2,
    swayAmp:
      spec.kind === 'bonsai'
        ? 0.016
        : spec.kind === 'fern'
          ? 0.042
          : spec.kind === 'blossom'
            ? 0.036
            : 0.012,
    targetScale: spec.scale,
    currentScale: initialScale,
    highlightPulse: startSmall ? 0.45 : 0,
    biolumMaterials,
    foliageMaterials,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

function buildBonsai(
  group: THREE.Group,
  rng: () => number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  foliageMaterials: THREE.MeshStandardMaterial[],
): void {
  const barkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4a3527,
      roughness: 0.9,
      metalness: 0.03,
    }),
  );

  // Primary sinuous trunk (TubeGeometry)
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.14, 0.38, 0.06),
    new THREE.Vector3(-0.08, 0.85, -0.05),
    new THREE.Vector3(0.18, 1.32, 0.08),
    new THREE.Vector3(0.06, 1.68, 0.02),
  ]);
  const trunkGeo = trackGeo(new THREE.TubeGeometry(trunkCurve, 22, 0.115, 10, false));
  // Taper trunk radius slightly upward
  const posAttr = trunkGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const t = Math.max(0, Math.min(1, y / 1.7));
    const taper = 1.15 - t * 0.58;
    const center = trunkCurve.getPoint(t);
    posAttr.setXYZ(
      i,
      center.x + (posAttr.getX(i) - center.x) * taper,
      y,
      center.z + (posAttr.getZ(i) - center.z) * taper,
    );
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, barkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // 4 clasping root flares anchored into the soil mound
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + 0.35;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * 0.07, 0.16, Math.sin(ang) * 0.07),
      new THREE.Vector3(Math.cos(ang) * 0.24, 0.05, Math.sin(ang) * 0.24),
      new THREE.Vector3(Math.cos(ang) * 0.42, -0.05, Math.sin(ang) * 0.42),
    ]);
    const rootGeo = trackGeo(new THREE.TubeGeometry(rootCurve, 10, 0.036, 7, false));
    const rootMesh = new THREE.Mesh(rootGeo, barkMat);
    rootMesh.castShadow = true;
    group.add(rootMesh);
  }

  // 3 gnarled secondary branches + layered organic canopy pads
  const branchConfigs = [
    {
      pts: [
        new THREE.Vector3(-0.04, 0.96, -0.02),
        new THREE.Vector3(-0.36, 1.18, 0.14),
        new THREE.Vector3(-0.58, 1.32, 0.22),
      ],
      padScale: [0.46, 0.24, 0.42] as [number, number, number],
      color: 0x2d5e2b,
    },
    {
      pts: [
        new THREE.Vector3(0.14, 1.24, 0.06),
        new THREE.Vector3(0.46, 1.38, -0.14),
        new THREE.Vector3(0.68, 1.48, -0.22),
      ],
      padScale: [0.48, 0.23, 0.42] as [number, number, number],
      color: 0x376d31,
    },
    {
      pts: [
        new THREE.Vector3(0.06, 1.56, 0.02),
        new THREE.Vector3(0.02, 1.76, -0.06),
        new THREE.Vector3(-0.08, 1.88, -0.04),
      ],
      padScale: [0.58, 0.28, 0.52] as [number, number, number],
      color: 0x417a37,
    },
    {
      pts: [
        new THREE.Vector3(0.02, 1.12, -0.05),
        new THREE.Vector3(-0.18, 1.32, -0.36),
        new THREE.Vector3(-0.28, 1.45, -0.52),
      ],
      padScale: [0.42, 0.22, 0.38] as [number, number, number],
      color: 0x295627,
    },
  ];

  const basePadGeo = trackGeo(new THREE.IcosahedronGeometry(1, 2));
  // Organically perturb canopy pad vertices slightly once
  const pAttr = basePadGeo.attributes.position;
  for (let i = 0; i < pAttr.count; i++) {
    const vx = pAttr.getX(i);
    const vy = pAttr.getY(i);
    const vz = pAttr.getZ(i);
    const bump = 1 + 0.14 * Math.sin(vx * 5.2 + vy * 4.1 + vz * 6.3);
    pAttr.setXYZ(i, vx * bump, vy * bump, vz * bump);
  }
  basePadGeo.computeVertexNormals();

  for (const b of branchConfigs) {
    const curve = new THREE.CatmullRomCurve3(b.pts);
    const bGeo = trackGeo(new THREE.TubeGeometry(curve, 12, 0.038, 7, false));
    const bMesh = new THREE.Mesh(bGeo, barkMat);
    bMesh.castShadow = true;
    group.add(bMesh);

    const leafMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.68,
        metalness: 0.02,
      }),
    );
    foliageMaterials.push(leafMat);

    const tip = b.pts[b.pts.length - 1];
    // 2 overlapping canopy sub-clusters per branch
    for (let k = 0; k < 2; k++) {
      const pad = new THREE.Mesh(basePadGeo, leafMat);
      pad.position.set(
        tip.x + (k === 1 ? (rng() - 0.5) * 0.22 : 0),
        tip.y + 0.06 + k * 0.08,
        tip.z + (k === 1 ? (rng() - 0.5) * 0.22 : 0),
      );
      const mult = k === 0 ? 1 : 0.72;
      pad.scale.set(b.padScale[0] * mult, b.padScale[1] * mult, b.padScale[2] * mult);
      pad.rotation.y = rng() * Math.PI;
      pad.castShadow = true;
      pad.receiveShadow = true;
      group.add(pad);
    }
  }
}

function buildFern(
  group: THREE.Group,
  rng: () => number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  foliageMaterials: THREE.MeshStandardMaterial[],
): void {
  const crownMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b3123,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  const frondMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x45803b,
      roughness: 0.58,
      metalness: 0.03,
      side: THREE.DoubleSide,
    }),
  );
  foliageMaterials.push(frondMat);

  // Central rhizome crown
  const crownGeo = trackGeo(new THREE.SphereGeometry(0.065, 10, 8));
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.scale.set(1.1, 0.7, 1.1);
  crown.position.y = 0.02;
  group.add(crown);

  // Shared pinnate leaflet geometry
  const leafletShape = new THREE.Shape();
  leafletShape.moveTo(0, 0);
  leafletShape.quadraticCurveTo(0.028, 0.045, 0, 0.11);
  leafletShape.quadraticCurveTo(-0.028, 0.045, 0, 0);
  const leafletGeo = trackGeo(new THREE.ShapeGeometry(leafletShape, 4));

  const frondCount = 9;
  for (let i = 0; i < frondCount; i++) {
    const azim = (i / frondCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const isInner = i % 3 === 0;
    const reach = isInner ? 0.32 : 0.48;
    const height = isInner ? 0.44 : 0.36;

    const frondGroup = new THREE.Group();
    frondGroup.rotation.y = azim;

    const spineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(reach * 0.35, height * 0.85, 0),
      new THREE.Vector3(reach * 0.78, height * 0.92, 0),
      new THREE.Vector3(reach, height * 0.45, 0),
    ]);
    const spineGeo = trackGeo(new THREE.TubeGeometry(spineCurve, 10, 0.006, 5, false));
    const spine = new THREE.Mesh(spineGeo, frondMat);
    spine.castShadow = true;
    frondGroup.add(spine);

    // Paired pinnate leaflets along the arched spine
    const pairCount = 7;
    for (let p = 1; p <= pairCount; p++) {
      const t = 0.2 + (p / (pairCount + 1)) * 0.76;
      const pt = spineCurve.getPoint(t);
      const tang = spineCurve.getTangent(t);
      const sizeFactor = Math.sin(t * Math.PI) * 0.95 + 0.25;

      for (const side of [-1, 1]) {
        const leaf = new THREE.Mesh(leafletGeo, frondMat);
        leaf.position.copy(pt);
        leaf.rotation.set(
          side * 0.95,
          Math.atan2(-tang.z, tang.x) + side * 0.25,
          -Math.PI / 2 + 0.35,
        );
        leaf.scale.set(sizeFactor * 0.8, sizeFactor * 1.1, sizeFactor);
        leaf.castShadow = true;
        frondGroup.add(leaf);
      }
    }

    group.add(frondGroup);
  }
}

function buildSucculent(
  group: THREE.Group,
  rng: () => number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  foliageMaterials: THREE.MeshStandardMaterial[],
): void {
  const innerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b9e8d,
      roughness: 0.56,
      metalness: 0.04,
    }),
  );
  const outerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8ea99a,
      emissive: 0x1b0b0e,
      emissiveIntensity: 0.22,
      roughness: 0.52,
      metalness: 0.04,
    }),
  );
  foliageMaterials.push(innerMat, outerMat);

  // Thick succulent petal geometry via extruded plump teardrop profile
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.055, 0.045, 0.042, 0.125);
  petalShape.quadraticCurveTo(0, 0.165, -0.042, 0.125);
  petalShape.quadraticCurveTo(-0.055, 0.045, 0, 0);

  const petalGeo = trackGeo(
    new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
    }),
  );
  petalGeo.translate(0, 0, -0.009);

  // Fibonacci spiral phyllotaxis (137.508 degrees)
  const goldenAngle = 2.39996323;
  const totalPetals = 17;
  for (let i = 0; i < totalPetals; i++) {
    const frac = i / (totalPetals - 1);
    const angle = i * goldenAngle + rng() * 0.06;
    const tiltOut = 0.22 + frac * 0.92;
    const radialOffset = 0.012 + frac * 0.065;

    const petal = new THREE.Mesh(petalGeo, frac > 0.55 ? outerMat : innerMat);
    const holder = new THREE.Group();
    holder.rotation.y = angle;

    petal.position.set(0, 0.02 + (1 - frac) * 0.045, radialOffset);
    petal.rotation.x = tiltOut;
    const scale = 0.55 + frac * 0.65;
    petal.scale.set(scale, scale, scale);
    petal.castShadow = true;
    petal.receiveShadow = true;

    holder.add(petal);
    group.add(holder);
  }
}

function buildMushroomCluster(
  group: THREE.Group,
  rng: () => number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  biolumMaterials: THREE.MeshStandardMaterial[],
): void {
  const stemMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9dfd2,
      roughness: 0.62,
      metalness: 0.02,
    }),
  );

  const capMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x99d9cc,
      emissive: 0x3ef5c8,
      emissiveIntensity: 0.05,
      roughness: 0.36,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );
  biolumMaterials.push(capMat);

  // Fluted bell mushroom cap profile (LatheGeometry)
  const capProfile = [
    new THREE.Vector2(0.0, 0.075),
    new THREE.Vector2(0.032, 0.07),
    new THREE.Vector2(0.075, 0.045),
    new THREE.Vector2(0.105, 0.012),
    new THREE.Vector2(0.115, 0.0),
    new THREE.Vector2(0.08, 0.008),
    new THREE.Vector2(0.018, 0.035),
  ];
  const capGeo = trackGeo(new THREE.LatheGeometry(capProfile, 16));

  const count = 4;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rng() * 0.5;
    const dist = i === 0 ? 0.01 : 0.065 + rng() * 0.055;
    const height = i === 0 ? 0.29 : 0.16 + rng() * 0.11;
    const capScale = i === 0 ? 1.05 : 0.62 + rng() * 0.32;

    const sx = Math.cos(ang) * dist;
    const sz = Math.sin(ang) * dist;
    const leanX = Math.cos(ang) * 0.055;
    const leanZ = Math.sin(ang) * 0.055;

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0, sz),
      new THREE.Vector3(sx + leanX * 0.5, height * 0.5, sz + leanZ * 0.5),
      new THREE.Vector3(sx + leanX, height, sz + leanZ),
    ]);
    const stemGeo = trackGeo(new THREE.TubeGeometry(stemCurve, 8, 0.012 * capScale, 6, false));
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.castShadow = true;
    group.add(stem);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(sx + leanX, height - 0.02 * capScale, sz + leanZ);
    cap.rotation.set(leanZ * 2.2, ang, -leanX * 2.2);
    cap.scale.setScalar(capScale);
    cap.castShadow = true;
    group.add(cap);
  }
}

function buildBlossomMoss(
  group: THREE.Group,
  rng: () => number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
  foliageMaterials: THREE.MeshStandardMaterial[],
): void {
  const mossMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x457438,
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
  const stemMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x5d8c45,
      roughness: 0.65,
      metalness: 0.02,
    }),
  );
  const petalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4d8de,
      roughness: 0.45,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  const centerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6b84c,
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  foliageMaterials.push(mossMat, stemMat);

  // Cushion moss pad
  const padGeo = trackGeo(new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5));
  const pad = new THREE.Mesh(padGeo, mossMat);
  pad.scale.set(1.15, 0.48, 1.0);
  pad.receiveShadow = true;
  group.add(pad);

  const petalGeo = trackGeo(new THREE.CircleGeometry(0.026, 8));
  const centerGeo = trackGeo(new THREE.SphereGeometry(0.012, 8, 6));

  // 4 slender flower stems sprouting from the moss cushion
  for (let f = 0; f < 4; f++) {
    const ang = (f / 4) * Math.PI * 2 + rng() * 0.6;
    const r = 0.04 + rng() * 0.07;
    const h = 0.14 + rng() * 0.12;
    const tx = Math.cos(ang) * (r + 0.035);
    const tz = Math.sin(ang) * (r + 0.035);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ang) * r * 0.4, 0.04, Math.sin(ang) * r * 0.4),
      new THREE.Vector3(tx * 0.7, h * 0.6, tz * 0.7),
      new THREE.Vector3(tx, h, tz),
    ]);
    const stemGeo = trackGeo(new THREE.TubeGeometry(curve, 6, 0.005, 5, false));
    const stem = new THREE.Mesh(stemGeo, stemMat);
    group.add(stem);

    const flowerHead = new THREE.Group();
    flowerHead.position.set(tx, h, tz);
    flowerHead.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.4);

    const cMesh = new THREE.Mesh(centerGeo, centerMat);
    flowerHead.add(cMesh);

    for (let p = 0; p < 5; p++) {
      const pAng = (p / 5) * Math.PI * 2;
      const pMesh = new THREE.Mesh(petalGeo, petalMat);
      pMesh.position.set(Math.cos(pAng) * 0.022, 0.004, Math.sin(pAng) * 0.022);
      pMesh.rotation.x = -Math.PI / 2 + 0.28;
      pMesh.rotation.z = -pAng;
      flowerHead.add(pMesh);
    }

    group.add(flowerHead);
  }
}
