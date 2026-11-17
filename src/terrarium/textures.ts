import * as THREE from 'three';

export interface ProceduralTextures {
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  soilAlbedo: THREE.CanvasTexture;
  soilBump: THREE.CanvasTexture;
  brassRoughness: THREE.CanvasTexture;
  condensationMap: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  softGlow: THREE.CanvasTexture;
  mistPuff: THREE.CanvasTexture;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeat = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  // 1. Dark Walnut Wood Albedo & Bump
  const [woodC, woodCtx] = makeCanvas(512, 512);
  const [woodBC, woodBCtx] = makeCanvas(512, 512);
  woodCtx.fillStyle = '#332218';
  woodCtx.fillRect(0, 0, 512, 512);
  woodBCtx.fillStyle = '#808080';
  woodBCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y++) {
    const grain =
      Math.sin(y * 0.09 + Math.sin(y * 0.02) * 3.5) * 0.5 +
      Math.sin(y * 0.27) * 0.25 +
      (Math.random() - 0.5) * 0.2;
    const tone = Math.round(clampVal(44 + grain * 18, 22, 74));
    const r = Math.round(tone * 1.25);
    const g = Math.round(tone * 0.85);
    const b = Math.round(tone * 0.62);
    woodCtx.fillStyle = `rgb(${r},${g},${b})`;
    woodCtx.fillRect(0, y, 512, 1);

    const bump = Math.round(clampVal(128 + grain * 55, 40, 215));
    woodBCtx.fillStyle = `rgb(${bump},${bump},${bump})`;
    woodBCtx.fillRect(0, y, 512, 1);
  }

  // 2. Rich Forest Soil / Humus Albedo & Bump
  const [soilC, soilCtx] = makeCanvas(512, 512);
  const [soilBC, soilBCtx] = makeCanvas(512, 512);
  soilCtx.fillStyle = '#2d241b';
  soilCtx.fillRect(0, 0, 512, 512);
  soilBCtx.fillStyle = '#7c7c7c';
  soilBCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const rad = 1 + Math.random() * 4.5;
    const v = Math.random();
    if (v > 0.72) {
      soilCtx.fillStyle = 'rgba(58, 76, 40, 0.38)';
    } else if (v > 0.32) {
      soilCtx.fillStyle = 'rgba(32, 23, 16, 0.45)';
    } else {
      soilCtx.fillStyle = 'rgba(72, 56, 42, 0.35)';
    }
    soilCtx.beginPath();
    soilCtx.arc(x, y, rad, 0, Math.PI * 2);
    soilCtx.fill();

    const bv = Math.round(70 + v * 150);
    soilBCtx.fillStyle = `rgba(${bv},${bv},${bv},0.55)`;
    soilBCtx.beginPath();
    soilBCtx.arc(x, y, rad, 0, Math.PI * 2);
    soilBCtx.fill();
  }

  // 3. Brushed Brass Roughness Map
  const [brassC, brassCtx] = makeCanvas(256, 256);
  brassCtx.fillStyle = '#606060';
  brassCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const streak = Math.round(68 + (Math.random() - 0.5) * 44);
    brassCtx.fillStyle = `rgb(${streak},${streak},${streak})`;
    brassCtx.fillRect(0, y, 256, 1);
  }

  // 4. Glass Condensation Droplet Map (linear alpha/roughness)
  const [condC, condCtx] = makeCanvas(512, 512);
  condCtx.fillStyle = '#000000';
  condCtx.fillRect(0, 0, 512, 512);
  const fogGrad = condCtx.createLinearGradient(0, 0, 0, 512);
  fogGrad.addColorStop(0, 'rgba(255,255,255,0.03)');
  fogGrad.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  fogGrad.addColorStop(1, 'rgba(255,255,255,0.28)');
  condCtx.fillStyle = fogGrad;
  condCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 1100; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 0.8 + Math.random() * 2.4;
    const g = condCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.82)');
    g.addColorStop(0.6, 'rgba(210,225,220,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    condCtx.fillStyle = g;
    condCtx.beginPath();
    condCtx.arc(x, y, r, 0, Math.PI * 2);
    condCtx.fill();
  }

  // 5. Soft Radial Contact Shadow
  const [shadC, shadCtx] = makeCanvas(256, 256);
  const sg = shadCtx.createRadialGradient(128, 128, 18, 128, 128, 126);
  sg.addColorStop(0, 'rgba(0,0,0,0.72)');
  sg.addColorStop(0.55, 'rgba(0,0,0,0.34)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  shadCtx.fillStyle = sg;
  shadCtx.fillRect(0, 0, 256, 256);

  // 6. Soft Firefly / Particle Glow Sprite
  const [glowC, glowCtx] = makeCanvas(128, 128);
  const gg = glowCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gg.addColorStop(0, 'rgba(255,255,255,1)');
  gg.addColorStop(0.32, 'rgba(255,248,205,0.75)');
  gg.addColorStop(0.7, 'rgba(180,255,190,0.18)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  glowCtx.fillStyle = gg;
  glowCtx.fillRect(0, 0, 128, 128);

  // 7. Mist Puff Sprite
  const [mistC, mistCtx] = makeCanvas(256, 256);
  const mg = mistCtx.createRadialGradient(128, 128, 10, 128, 128, 122);
  mg.addColorStop(0, 'rgba(232,244,242,0.42)');
  mg.addColorStop(0.5, 'rgba(218,234,232,0.18)');
  mg.addColorStop(1, 'rgba(218,234,232,0)');
  mistCtx.fillStyle = mg;
  mistCtx.fillRect(0, 0, 256, 256);

  const contactShadow = new THREE.CanvasTexture(shadC);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  const softGlow = new THREE.CanvasTexture(glowC);
  softGlow.colorSpace = THREE.SRGBColorSpace;
  softGlow.needsUpdate = true;

  const mistPuff = new THREE.CanvasTexture(mistC);
  mistPuff.colorSpace = THREE.SRGBColorSpace;
  mistPuff.needsUpdate = true;

  return {
    woodAlbedo: configureTexture(woodC, true, maxAnisotropy, 2),
    woodBump: configureTexture(woodBC, false, maxAnisotropy, 2),
    soilAlbedo: configureTexture(soilC, true, maxAnisotropy, 3),
    soilBump: configureTexture(soilBC, false, maxAnisotropy, 3),
    brassRoughness: configureTexture(brassC, false, maxAnisotropy, 2),
    condensationMap: configureTexture(condC, false, maxAnisotropy, 2),
    contactShadow,
    softGlow,
    mistPuff,
  };
}

function clampVal(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function disposeProceduralTextures(tex: ProceduralTextures): void {
  Object.values(tex).forEach((t) => t.dispose());
}
