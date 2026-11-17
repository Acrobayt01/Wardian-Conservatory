import * as THREE from 'three';
import {
  POND_CENTER,
  POND_RADIUS,
  POND_WATER_Y,
  TERRARIUM_RADIUS,
  mulberry32,
  terrainHeightAt,
} from './environmentMath';
import type { ProceduralTextures } from './textures';
import type { InspectedSpecimen } from './types';

export interface TerrariumVesselHandles {
  root: THREE.Group;
  glassGroup: THREE.Group;
  glassMat: THREE.MeshPhysicalMaterial;
  condensationMat: THREE.MeshStandardMaterial;
  waterMesh: THREE.Mesh;
  waterMat: THREE.MeshPhysicalMaterial;
  soilMesh: THREE.Mesh;
  soilMat: THREE.MeshStandardMaterial;
  rockMat: THREE.MeshStandardMaterial;
  interactables: THREE.Object3D[];
  dispose: () => void;
}

export function buildTerrariumVessel(
  textures: ProceduralTextures,
  isSoftwareGl: boolean,
): TerrariumVesselHandles {
  const root = new THREE.Group();
  root.name = 'WardianTerrarium';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const interactables: THREE.Object3D[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Studio Ground / Table Contact Shadow & Pedestal Base
  const contactGeo = trackGeo(new THREE.CircleGeometry(3.65, 48));
  contactGeo.rotateX(-Math.PI / 2);
  const contactMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(contactGeo, contactMat);
  contactShadow.position.y = -0.355;
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  // Subtle architectural studio tabletop extending into horizon fog
  const tableGeo = trackGeo(new THREE.CylinderGeometry(28, 28, 0.25, 64));
  const tableMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x151a18,
      roughness: 0.88,
      metalness: 0.04,
    }),
  );
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.y = -0.49;
  tableMesh.receiveShadow = true;
  root.add(tableMesh);

  // 2. Turned Walnut Display Plinth (LatheGeometry)
  const plinthPoints = [
    new THREE.Vector2(0.0, -0.35),
    new THREE.Vector2(2.72, -0.35),
    new THREE.Vector2(2.78, -0.32),
    new THREE.Vector2(2.86, -0.24),
    new THREE.Vector2(2.68, -0.15),
    new THREE.Vector2(2.64, -0.05),
    new THREE.Vector2(2.86, 0.02),
    new THREE.Vector2(2.88, 0.08),
    new THREE.Vector2(2.68, 0.08),
    new THREE.Vector2(2.64, 0.04),
    new THREE.Vector2(0.0, 0.04),
  ];
  const plinthGeo = trackGeo(new THREE.LatheGeometry(plinthPoints, 8));
  plinthGeo.rotateY(Math.PI / 8);
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.woodAlbedo,
      bumpMap: textures.woodBump,
      bumpScale: 0.015,
      roughness: 0.46,
      metalness: 0.04,
    }),
  );
  const plinthMesh = new THREE.Mesh(plinthGeo, woodMat);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  root.add(plinthMesh);

  // 3. Brushed Brass Architectural Frame (Base Collar, 8 Mullions, Cornice, Roof Ribs, Finial)
  const brassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc9a35d,
      roughness: 0.26,
      metalness: 0.92,
      roughnessMap: textures.brassRoughness,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
    }),
  );

  const glassOuterR = 2.82;
  const wallBottomY = 0.08;
  const wallTopY = 2.68;
  const roofPeakY = 3.92;

  // Lower brass basin rim
  const lowerRingGeo = trackGeo(new THREE.TorusGeometry(glassOuterR, 0.045, 12, 8));
  lowerRingGeo.rotateX(Math.PI / 2);
  lowerRingGeo.rotateY(Math.PI / 8);
  const lowerRing = new THREE.Mesh(lowerRingGeo, brassMat);
  lowerRing.position.y = wallBottomY + 0.01;
  lowerRing.castShadow = true;
  root.add(lowerRing);

  // Upper cornice brass ring
  const upperRingGeo = trackGeo(new THREE.TorusGeometry(glassOuterR, 0.038, 12, 8));
  upperRingGeo.rotateX(Math.PI / 2);
  upperRingGeo.rotateY(Math.PI / 8);
  const upperRing = new THREE.Mesh(upperRingGeo, brassMat);
  upperRing.position.y = wallTopY;
  upperRing.castShadow = true;
  root.add(upperRing);

  // Mid decorative brass band separating substrate cross-section from upper gallery
  const midRingGeo = trackGeo(new THREE.TorusGeometry(glassOuterR - 0.006, 0.018, 8, 8));
  midRingGeo.rotateX(Math.PI / 2);
  midRingGeo.rotateY(Math.PI / 8);
  const midRing = new THREE.Mesh(midRingGeo, brassMat);
  midRing.position.y = 0.41;
  root.add(midRing);

  // 8 vertical mullions & 8 pitched roof ribs + corner rivets
  const mullionGeo = trackGeo(
    new THREE.CylinderGeometry(0.022, 0.024, wallTopY - wallBottomY, 8),
  );
  const rivetGeo = trackGeo(new THREE.SphereGeometry(0.034, 10, 10));
  const cornerR = glassOuterR;

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const cx = Math.cos(angle) * cornerR;
    const cz = Math.sin(angle) * cornerR;

    const mullion = new THREE.Mesh(mullionGeo, brassMat);
    mullion.position.set(cx, (wallBottomY + wallTopY) * 0.5, cz);
    mullion.castShadow = true;
    root.add(mullion);

    const rivet = new THREE.Mesh(rivetGeo, brassMat);
    rivet.position.set(cx, wallTopY + 0.01, cz);
    root.add(rivet);

    // Pitched roof rib from (cx, wallTopY, cz) to (0, roofPeakY, 0)
    const start = new THREE.Vector3(cx, wallTopY, cz);
    const end = new THREE.Vector3(Math.cos(angle) * 0.24, roofPeakY, Math.sin(angle) * 0.24);
    const ribLen = start.distanceTo(end);
    const ribGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.021, ribLen, 8));
    const rib = new THREE.Mesh(ribGeo, brassMat);
    rib.position.copy(start).lerp(end, 0.5);
    rib.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize(),
    );
    rib.castShadow = true;
    root.add(rib);
  }

  // Turned Brass Finial Crown & Ring Handle at peak
  const finialProfile = [
    new THREE.Vector2(0.0, roofPeakY - 0.04),
    new THREE.Vector2(0.28, roofPeakY - 0.04),
    new THREE.Vector2(0.25, roofPeakY + 0.04),
    new THREE.Vector2(0.11, roofPeakY + 0.11),
    new THREE.Vector2(0.14, roofPeakY + 0.19),
    new THREE.Vector2(0.05, roofPeakY + 0.26),
    new THREE.Vector2(0.0, roofPeakY + 0.28),
  ];
  const finialGeo = trackGeo(new THREE.LatheGeometry(finialProfile, 16));
  const finial = new THREE.Mesh(finialGeo, brassMat);
  finial.castShadow = true;
  root.add(finial);

  const handleRingGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.018, 10, 24));
  const handleRing = new THREE.Mesh(handleRingGeo, brassMat);
  handleRing.position.y = roofPeakY + 0.36;
  root.add(handleRing);

  // 4. Stratified Cross-Section Layers (Visible through lower glass band)
  // 4a. Drainage pebble strata perimeter (InstancedMesh)
  const pebbleGeo = trackGeo(new THREE.DodecahedronGeometry(0.068, 1));
  const pebbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.04,
    }),
  );
  const pebbleCount = 96;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  const rng = mulberry32(1337);
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const pebblePalette = [0x8b857a, 0xa89f90, 0x676b6d, 0xb2a48e, 0x5c5851];

  for (let i = 0; i < pebbleCount; i++) {
    const ang = (i / pebbleCount) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const rad = TERRARIUM_RADIUS - 0.05 - rng() * 0.14;
    const py = 0.14 + (i % 2) * 0.068 + rng() * 0.025;
    dummy.position.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad);
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    dummy.scale.set(
      0.85 + rng() * 0.55,
      0.55 + rng() * 0.35,
      0.85 + rng() * 0.45,
    );
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    cTmp.setHex(pebblePalette[i % pebblePalette.length]);
    pebbles.setColorAt(i, cTmp);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  root.add(pebbles);

  // 4b. Charcoal & Sub-soil Dark Mineral Cylinder Skirt
  const subSoilGeo = trackGeo(
    new THREE.CylinderGeometry(TERRARIUM_RADIUS - 0.02, TERRARIUM_RADIUS - 0.02, 0.22, 48),
  );
  const subSoilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1d1916,
      roughness: 0.92,
      metalness: 0.02,
      bumpMap: textures.soilBump,
      bumpScale: 0.02,
    }),
  );
  const subSoil = new THREE.Mesh(subSoilGeo, subSoilMat);
  subSoil.position.y = 0.18;
  root.add(subSoil);

  // 4c. Sculpted Undulating Soil & Moss Topographic Terrain
  const soilMesh = buildTerrainMesh(
    textures,
    trackGeo,
    trackMat,
  );
  soilMesh.receiveShadow = true;
  soilMesh.castShadow = false;
  soilMesh.userData.isSoil = true;
  root.add(soilMesh);
  interactables.push(soilMesh);

  // 5. Crystal Pond Basin & Submerged Stones
  const waterGeo = trackGeo(new THREE.CircleGeometry(POND_RADIUS * 0.96, 40));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b7a75,
      roughness: 0.06,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.82,
      ior: 1.333,
      reflectivity: 0.9,
    }),
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(POND_CENTER.x, POND_WATER_Y, POND_CENTER.z);
  waterMesh.receiveShadow = true;
  waterMesh.renderOrder = 2;
  const pondMeta: InspectedSpecimen = {
    id: 'specimen-pond',
    name: 'Springwater Mirror Pond',
    botanicalName: 'Micro-basin Hydrology',
    kind: 'pond',
    description:
      'Collects condensed rainwater and maintains steady capillary humidity across the moss bed.',
    moisturePreference: 'Saturated · 100% RH',
  };
  waterMesh.userData.specimen = pondMeta;
  root.add(waterMesh);
  interactables.push(waterMesh);

  // Submerged river stones inside pond
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + 0.4;
    const dist = 0.14 + (i % 3) * 0.14;
    const sx = POND_CENTER.x + Math.cos(ang) * dist;
    const sz = POND_CENTER.z + Math.sin(ang) * dist;
    const stoneGeo = trackGeo(new THREE.DodecahedronGeometry(0.055 + (i % 2) * 0.025, 1));
    const stoneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x3a4442 : 0x515852,
        roughness: 0.25,
        metalness: 0.05,
      }),
    );
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.scale.set(1.2, 0.55, 0.9);
    stone.position.set(sx, terrainHeightAt(sx, sz) + 0.02, sz);
    stone.rotation.y = ang;
    root.add(stone);
  }

  // 6. Sculpted Basalt Rock Outcrop (Composite 5-part Group)
  const rockGroup = new THREE.Group();
  const rockX = 0.85;
  const rockZ = -0.68;
  const rockBaseY = terrainHeightAt(rockX, rockZ);
  rockGroup.position.set(rockX, rockBaseY - 0.04, rockZ);

  const rockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x484d4a,
      roughness: 0.78,
      metalness: 0.06,
      flatShading: true,
      bumpMap: textures.soilBump,
      bumpScale: 0.015,
    }),
  );
  const mossCapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3e6f3a,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );

  const rockParts = [
    { pos: [0, 0.24, 0], scale: [0.32, 0.48, 0.28], rot: [0.1, 0.3, -0.08] },
    { pos: [-0.26, 0.15, 0.14], scale: [0.24, 0.3, 0.22], rot: [-0.15, 1.1, 0.12] },
    { pos: [0.24, 0.12, 0.12], scale: [0.22, 0.24, 0.21], rot: [0.18, 2.1, -0.15] },
    { pos: [0.06, 0.1, -0.24], scale: [0.2, 0.22, 0.19], rot: [-0.12, 0.7, 0.2] },
  ];
  const rockBaseGeo = trackGeo(new THREE.DodecahedronGeometry(1, 0));
  for (const part of rockParts) {
    const m = new THREE.Mesh(rockBaseGeo, rockMat);
    m.position.set(part.pos[0], part.pos[1], part.pos[2]);
    m.scale.set(part.scale[0], part.scale[1], part.scale[2]);
    m.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    rockGroup.add(m);
  }
  // Moss cap perched on main basalt spire
  const capGeo = trackGeo(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52));
  const cap = new THREE.Mesh(capGeo, mossCapMat);
  cap.position.set(0.01, 0.44, -0.01);
  cap.scale.set(1.15, 0.45, 1.0);
  rockGroup.add(cap);

  const rockMeta: InspectedSpecimen = {
    id: 'specimen-basalt',
    name: 'Lichen-Capped Basalt',
    botanicalName: 'Volcanic Stone Outcrop',
    kind: 'stone',
    description:
      'Porous dark basalt anchoring thermal mass and sheltering shade-loving cushion moss.',
    moisturePreference: 'Damp Micro-crevices',
  };
  rockGroup.traverse((obj) => {
    obj.userData.specimen = rockMeta;
  });
  root.add(rockGroup);
  interactables.push(rockGroup);

  // 7. Optical Octagonal Glass Enclosure & Condensation Layer
  const glassGroup = new THREE.Group();
  glassGroup.name = 'GlassEnclosure';

  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xeef7f3,
      metalness: 0.0,
      roughness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.2 : 1.0,
      ior: 1.52,
      thickness: 0.14,
      attenuationColor: new THREE.Color(0xdcf0e6),
      attenuationDistance: 8.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );

  const wallGlassGeo = trackGeo(
    new THREE.CylinderGeometry(glassOuterR - 0.01, glassOuterR - 0.01, wallTopY - wallBottomY, 8, 1, true),
  );
  const wallGlass = new THREE.Mesh(wallGlassGeo, glassMat);
  wallGlass.position.y = (wallBottomY + wallTopY) * 0.5;
  wallGlass.renderOrder = 6;
  glassGroup.add(wallGlass);

  const roofGlassGeo = trackGeo(
    new THREE.CylinderGeometry(0.24, glassOuterR - 0.01, roofPeakY - wallTopY, 8, 1, true),
  );
  const roofGlass = new THREE.Mesh(roofGlassGeo, glassMat);
  roofGlass.position.y = (wallTopY + roofPeakY) * 0.5;
  roofGlass.renderOrder = 6;
  glassGroup.add(roofGlass);

  // Inner condensation mist/droplet shell
  const condMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe7f4f1,
      alphaMap: textures.condensationMap,
      roughnessMap: textures.condensationMap,
      roughness: 0.35,
      metalness: 0.02,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );
  const condGeo = trackGeo(
    new THREE.CylinderGeometry(glassOuterR - 0.035, glassOuterR - 0.035, wallTopY - wallBottomY - 0.1, 8, 1, true),
  );
  const condMesh = new THREE.Mesh(condGeo, condMat);
  condMesh.position.y = (wallBottomY + wallTopY) * 0.5;
  condMesh.renderOrder = 7;
  glassGroup.add(condMesh);

  root.add(glassGroup);

  // Keep soilMat reference for wetness modulation
  const soilMat = soilMesh.material as THREE.MeshStandardMaterial;

  return {
    root,
    glassGroup,
    glassMat,
    condensationMat: condMat,
    waterMesh,
    waterMat,
    soilMesh,
    soilMat,
    rockMat,
    interactables,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

function buildTerrainMesh(
  textures: ProceduralTextures,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T,
): THREE.Mesh {
  const rings = 26;
  const segments = 56;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const humusColor = new THREE.Color(0x281e15);
  const mossColor = new THREE.Color(0x2d5e26);
  const lushMossColor = new THREE.Color(0x478034);
  const pondBedColor = new THREE.Color(0x1f2e2b);
  const tmpColor = new THREE.Color();

  // Center vertex
  const cY = terrainHeightAt(0, 0);
  positions.push(0, cY, 0);
  uvs.push(0.5, 0.5);
  colors.push(mossColor.r, mossColor.g, mossColor.b);

  for (let rIdx = 1; rIdx <= rings; rIdx++) {
    const frac = rIdx / rings;
    const rad = frac * (TERRARIUM_RADIUS - 0.03);
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const theta = (sIdx / segments) * Math.PI * 2;
      const x = Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;
      const y = terrainHeightAt(x, z);

      positions.push(x, y, z);
      uvs.push(0.5 + x / (TERRARIUM_RADIUS * 2), 0.5 + z / (TERRARIUM_RADIUS * 2));

      const dPond = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
      if (dPond < POND_RADIUS * 1.05) {
        const pondMix = 1 - Math.min(1, dPond / (POND_RADIUS * 1.05));
        tmpColor.copy(humusColor).lerp(pondBedColor, pondMix * 0.9);
      } else {
        const elev = Math.max(0, Math.min(1, (y - 0.34) * 2.1));
        const noise = 0.5 + 0.5 * Math.sin(x * 3.8 + z * 2.9);
        tmpColor
          .copy(humusColor)
          .lerp(mossColor, 0.42 + elev * 0.45)
          .lerp(lushMossColor, noise * elev * 0.55);
      }
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  // Center fan triangles
  for (let sIdx = 0; sIdx < segments; sIdx++) {
    const next = (sIdx + 1) % segments;
    indices.push(0, 1 + next, 1 + sIdx);
  }

  // Concentric rings
  for (let rIdx = 1; rIdx < rings; rIdx++) {
    const ringStart = 1 + (rIdx - 1) * segments;
    const nextRingStart = 1 + rIdx * segments;
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const next = (sIdx + 1) % segments;
      const a = ringStart + sIdx;
      const b = ringStart + next;
      const c = nextRingStart + sIdx;
      const d = nextRingStart + next;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = trackGeo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.soilAlbedo,
      bumpMap: textures.soilBump,
      bumpScale: 0.025,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );

  return new THREE.Mesh(geo, mat);
}
