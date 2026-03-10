import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// ─── TOWER GEOMETRY (exact landing page constants) ──────────────────────────
const BS = 0.85, BG = 0.005, HW = 6, HD = 3.5, TL = 25, SS = 16;
function lScale(l: number) { const t = l / (TL - 1); return 1 + 0.8 * t * t; }
function lY(l: number) { let y = 0; for (let i = 0; i < l; i++) y += BS * lScale(i) + BG; return y; }
function spireDim(l: number) { const p = (l - SS) / (TL - 1 - SS), s = Math.pow(1 - p, 1.5); return { hw: HW * s, hd: HD * s }; }
function bpf(fw: number, sc: number) { const bw = BS * sc; return fw < bw * 0.5 ? 0 : Math.max(1, Math.round(fw / bw)); }

interface BlockPos { x: number; y: number; z: number; ry: number }

function buildTowerPositions(): BlockPos[] {
  const pos: BlockPos[] = [];
  function addFace(y: number, ahw: number, ahd: number, fc: number, sc: number, bw: number) {
    const bh = bw / 2;
    function d(n: number, fw: number) { if (n <= 0) return []; const tw = fw / n; const o: number[] = []; for (let i = 0; i < n; i++) o.push(-fw / 2 + tw / 2 + i * tw); return o; }
    const fp = d(fc, 2 * ahw), sp = d(sc, 2 * ahd);
    for (const x of fp) { pos.push({ x, y, z: ahd + bh, ry: 0 }); pos.push({ x, y, z: -ahd - bh, ry: Math.PI }); }
    for (const z of sp) { pos.push({ x: ahw + bh, y, z, ry: Math.PI / 2 }); pos.push({ x: -ahw - bh, y, z, ry: -Math.PI / 2 }); }
    if (fc > 0 && sc > 0) { pos.push({ x: ahw + bh, y, z: ahd + bh, ry: 0 }, { x: -ahw - bh, y, z: ahd + bh, ry: 0 }, { x: ahw + bh, y, z: -ahd - bh, ry: 0 }, { x: -ahw - bh, y, z: -ahd - bh, ry: 0 }); }
  }
  for (let l = 0; l < TL; l++) {
    const sc = lScale(l), bw = BS * sc, y = lY(l);
    if (l < SS) { addFace(y, HW, HD, bpf(2 * HW, sc), bpf(2 * HD, sc), bw); }
    else { const { hw, hd } = spireDim(l); const fc = bpf(2 * hw, sc), scc = bpf(2 * hd, sc); if (!fc && !scc) pos.push({ x: 0, y, z: 0, ry: 0 }); else addFace(y, (fc * bw) / 2, (scc * bw) / 2, fc, scc, bw); }
  }
  return pos;
}

const POSITIONS = buildTowerPositions();
const NB = POSITIONS.length;
const TH = lY(TL - 1) + BS * lScale(TL - 1);
const TH_STR = TH.toFixed(1);
const SPIRE_NORM = (lY(SS) / TH).toFixed(4);

// ─── BLOCK SHADER (exact landing page) ──────────────────────────────────────
const blockVS = `precision highp float;
attribute float aEnergy;
attribute float aHue;
attribute float aPhase;
varying float vEnergy, vHue, vLayerNorm;
varying vec3 vNormal, vWorldPos;
varying float vInstanceOffset;
void main() {
  vEnergy = aEnergy;
  vHue = aHue;
  vNormal = normalize(normalMatrix * normal);
  vLayerNorm = instanceMatrix[3].y / ${TH_STR};
  vec4 wp = instanceMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vInstanceOffset = wp.x * 0.3 + wp.y * 0.7 + wp.z * 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * wp;
}`;

const blockFS = `precision mediump float;
uniform highp float uTime;
uniform vec3 uCamPos;
uniform float uTowerHeight;
uniform float uSpireNorm;
varying float vEnergy, vHue, vLayerNorm;
varying vec3 vNormal, vWorldPos;
varying float vInstanceOffset;
vec3 hsv2rgb(float h, float s, float v) {
  vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), c, s);
}
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
vec3 pastelColor(float hue, float energy) {
  return hsv2rgb(hue, 0.35 + energy * 0.20, 0.55 + energy * 0.30);
}
vec3 energyTint(float e) {
  return mix(vec3(0.15, 0.18, 0.30), vec3(1.0, 0.85, 0.55), smoothstep(0.0, 0.8, e));
}
void main() {
  float energy = clamp(vEnergy, 0.0, 1.0);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);
  float NdotV = max(dot(N, V), 0.0);
  float hue = fract(vHue + vLayerNorm * 0.08);
  vec3 baseCol = pastelColor(hue, energy);
  vec3 tint = energyTint(energy);
  vec3 col = baseCol + tint * energy * 0.15;
  vec3 lightDir = normalize(vec3(0.25, 0.8, -0.5));
  float faceBright = 0.72 + 0.30 * dot(N, lightDir) + max(0.0, N.y) * 0.15 - max(0.0, -N.y) * 0.10;
  col *= faceBright;
  float fresnel = pow(max(0.0, 1.0 - NdotV), 4.0);
  col += mix(vec3(0.5, 0.7, 1.0), tint, 0.5 + energy * 0.5) * fresnel * (0.1 + energy * 0.3);
  vec3 H = normalize(lightDir + V);
  col += vec3(1.0, 0.95, 0.85) * pow(max(0.0, dot(N, H)), 28.0) * 0.25 * energy;
  float breathe = 0.0, bI = 0.0; vec3 aT = vec3(0.0);
  if (energy > 0.8) { breathe = 0.5 + 0.5 * sin(uTime * 5.03 + vInstanceOffset); bI = 0.15 + energy * 0.15; aT = vec3(0.12, 0.09, 0.0); }
  else if (energy > 0.5) { breathe = 0.5 + 0.5 * sin(uTime * 7.54 + vInstanceOffset); bI = 0.10 + energy * 0.15; aT = vec3(0.08, 0.04, 0.0); }
  else if (energy > 0.2) { breathe = 0.5 + 0.5 * sin(uTime * 15.7 + vInstanceOffset) + (hash21(vec2(floor(uTime * 8.0), vInstanceOffset)) * 0.4 - 0.2); bI = 0.08 + energy * 0.10; aT = vec3(0.06, 0.02, 0.0); }
  else if (energy > 0.01) { float sp = hash21(vec2(floor(uTime * 12.0), vInstanceOffset + 7.3)); breathe = sp > 0.85 ? sp * 2.0 : 0.1; bI = 0.05 + energy * 0.08; aT = vec3(-0.03, -0.01, 0.04); }
  col *= (0.9 + breathe * bI * 0.25); col += aT * breathe * bI;
  float scanY = mod(uTime * 0.65, uTowerHeight + 8.0) - 4.0;
  col += tint * smoothstep(2.5, 0.0, abs(vWorldPos.y - scanY)) * 0.2 * energy;
  float spireBoost = smoothstep(uSpireNorm - 0.05, uSpireNorm + 0.15, vLayerNorm);
  col += tint * spireBoost * (0.35 + 0.45 * sin(uTime * 1.5 + vInstanceOffset * 2.0)) * 0.08;
  col += mix(vec3(0.03, 0.02, 0.04), vec3(0.20, 0.15, 0.06), vLayerNorm) * 0.04;
  gl_FragColor = vec4(col, 1.0);
}`;

// ─── AURORA SKYBOX SHADER (exact landing page) ──────────────────────────────
const skyVS = `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFS = `precision mediump float;
uniform highp float uTime; varying vec3 vP;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float vn(vec2 p) { vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p) { float v=0.0,a=0.5; mat2 rot=mat2(0.8,0.6,-0.6,0.8); for(int i=0;i<6;i++){v+=a*vn(p);p=rot*p*2.0;a*=0.5;} return v; }
void main() {
  vec3 d = normalize(vP); float lat = acos(d.y) / 3.14159; float t = uTime;
  float cx = d.x / max(length(vec2(d.x, d.z)), 0.001);
  float cz = d.z / max(length(vec2(d.x, d.z)), 0.001);
  vec3 sky = vec3(0.015, 0.020, 0.042);
  sky = mix(sky, vec3(0.025, 0.035, 0.07), smoothstep(0.0, 0.12, lat));
  sky = mix(sky, vec3(0.04, 0.058, 0.12), smoothstep(0.10, 0.28, lat));
  sky = mix(sky, vec3(0.03, 0.078, 0.10), smoothstep(0.32, 0.50, lat));
  sky = mix(sky, vec3(0.015, 0.025, 0.045), smoothstep(0.55, 1.0, lat));
  float aZone = smoothstep(0.75, 0.08, lat) * smoothstep(0.0, 0.06, lat);
  float curtain = 0.55 + 0.45 * fb(vec2(cx * 1.2 + cz * 0.8 + t * 0.005, lat * 0.8 + t * 0.003));
  float r1uv = fb(vec2(cx * 2.5 + cz * 1.5 + t * 0.015 + sin(t * 0.008) * 0.3, lat * 5.5 + t * 0.010));
  float ribbon1 = smoothstep(0.22, 0.58, r1uv);
  float r1edge = smoothstep(0.58, 0.50, r1uv) * 0.5;
  sky += vec3(0.45, 0.12, 0.72) * (ribbon1 + r1edge) * aZone * curtain * 1.0;
  float r2uv = fb(vec2(cx * 3.5 - cz * 2.0 - t * 0.018 + cos(t * 0.006) * 0.2, lat * 7.0 + t * 0.013));
  float ribbon2 = smoothstep(0.20, 0.56, r2uv);
  float r2edge = smoothstep(0.56, 0.48, r2uv) * 0.4;
  sky += vec3(0.06, 0.85, 0.35) * (ribbon2 + r2edge) * aZone * curtain * 1.0;
  float r3uv = fb(vec2(cx * 2.0 + cz * 1.2 + t * 0.010, lat * 4.5 - t * 0.007 + sin(t * 0.005) * 0.15));
  sky += vec3(0.90, 0.72, 0.28) * smoothstep(0.28, 0.57, r3uv) * aZone * curtain * 0.7;
  float r4uv = fb(vec2(cx * 4.5 - cz * 2.5 + t * 0.020, lat * 6.0 + t * 0.012));
  sky += vec3(0.12, 0.68, 0.42) * smoothstep(0.34, 0.62, r4uv) * aZone * curtain * 0.6;
  sky += vec3(0.30, 0.35, 0.10) * smoothstep(0.58, 0.40, lat) * smoothstep(0.36, 0.48, lat) * 0.5;
  float sZone = smoothstep(0.55, 0.0, lat);
  if (sZone > 0.0) {
    float az = atan(d.z, d.x); vec2 su = vec2(az * 90.0, lat * 180.0); float s = h(floor(su));
    float tw = 0.45 + 0.55 * sin(t * (1.2 + s * 3.5) + s * 100.0);
    if (s > 0.988) sky += vec3(1.0, 0.97, 0.94) * (s - 0.988) * 450.0 * tw * sZone;
    else if (s > 0.975) sky += vec3(0.55, 0.60, 0.78) * (s - 0.975) * 70.0 * tw * sZone;
    else if (s > 0.960) sky += vec3(0.30, 0.35, 0.50) * (s - 0.960) * 25.0 * tw * sZone;
  }
  gl_FragColor = vec4(sky, 1.0);
}`;

// ─── MARBLE PEDESTAL SHADER (exact landing page) ────────────────────────────
const marbleVS = `precision highp float;
varying vec3 vWP, vN, vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vWP = wp.xyz; vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
}`;

const marbleFS = `precision mediump float;
uniform highp float uTime;
varying vec3 vWP, vN, vV;
const float CT=-0.500;const float MT=-1.100;const float BT=-2.300;
const float ML_FILLET=-0.480;const float ML_CAVETTO=-0.580;const float ML_ASTRAGAL=-1.060;
const float ML_FASCIA=-1.160;const float ML_SCOTIA=-1.700;const float ML_TORUS=-2.220;
const float ML_BASELIP=-2.280;const float ML_PLINTH=-3.040;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
float fb(vec2 p){float v=0.0,a=0.5;mat2 rot=mat2(0.8,0.6,-0.6,0.8);for(int i=0;i<5;i++){v+=a*vn(p);p=rot*p*2.0;a*=0.5;}return v;}
vec3 marble(vec2 uv, float t){
  vec2 flow = uv + vec2(sin(t * 0.04 + uv.y * 0.5) * 0.08, cos(t * 0.03 + uv.x * 0.4) * 0.06);
  float n = fb(flow * 2.5 + t * 0.015);
  float v1 = smoothstep(-0.12, 0.12, sin(flow.x * 8.0 + n * 7.0 + t * 0.06));
  float v2 = smoothstep(-0.25, 0.25, sin(flow.y * 11.0 + fb(flow * 4.0 + 3.7 + t * 0.02) * 5.0));
  float vn2 = min(v1, v2 * 0.6 + 0.4);
  return mix(vec3(0.48, 0.45, 0.52), vec3(0.94, 0.92, 0.90), vn2) * vec3(1.06, 1.04, 1.10);
}
float ml(float y,float c,float w){return smoothstep(w,0.0,abs(y-c));}
void main(){
  float t = uTime; float y=vWP.y;vec3 rN=normalize(vN);float isSide=1.0-abs(rN.y);float isTop=max(rN.y,0.0);
  vec3 bW=abs(rN);bW=bW/(bW.x+bW.y+bW.z+0.001);
  vec2 mUV=vWP.yz*0.08*bW.x+vWP.xz*0.08*bW.y+vWP.xy*0.08*bW.z;
  vec3 mc=pow(marble(mUV, t),vec3(0.82));
  vec3 up=abs(rN.y)>0.99?vec3(1,0,0):vec3(0,1,0);vec3 T=normalize(cross(rN,up));vec3 B=cross(rN,T);
  float nFlow = t * 0.02;
  float nO=vn(mUV*20.0 + nFlow)*2.0-1.0;vec3 N=normalize(rN+(T*nO+B*(vn(mUV*18.0+5.0+nFlow)*2.0-1.0))*0.04);
  vec3 V=normalize(vV);float NdV=max(dot(N,V),0.0);
  vec3 wLD=normalize(vec3(0.1,1.0,0.05));vec3 wL=vec3(1.0,0.88,0.65)*max(dot(N,wLD),0.0)*0.85;
  vec3 cL=vec3(0.4,0.45,0.6)*max(dot(N,normalize(vec3(-0.5,0.3,0.8))),0.0)*0.3;
  vec3 hV=normalize(wLD+V);vec3 spec=vec3(1.0,0.95,0.88)*pow(max(dot(N,hV),0.0),28.0)*0.3;
  vec3 rim=vec3(0.22,0.18,0.35)*pow(1.0-NdV,3.0)*0.45;
  vec3 col=mc*(vec3(0.24,0.22,0.27)+wL+cL)+spec+rim;
  col+=vec3(0.40,0.35,0.25)*ml(y,ML_FILLET,0.03)*isSide*0.6;
  col*=1.0-ml(y,ML_CAVETTO,0.06)*isSide*0.18;
  col+=vec3(0.35,0.30,0.22)*ml(y,ML_ASTRAGAL,0.025)*isSide*0.5;
  col+=vec3(0.30,0.27,0.22)*ml(y,ML_FASCIA,0.02)*isSide*0.4;
  col*=1.0-ml(y,ML_SCOTIA,0.04)*isSide*0.12;
  col+=vec3(0.28,0.25,0.20)*ml(y,ML_TORUS,0.03)*isSide*0.45;
  col+=vec3(0.32,0.28,0.20)*ml(y,ML_BASELIP,0.025)*isSide*0.5;
  col*=1.0-ml(y,ML_PLINTH,0.035)*isSide*0.15;
  float eG=max(max(smoothstep(0.15,0.0,abs(y-CT))*isTop,smoothstep(0.15,0.0,abs(y-MT))*isTop),smoothstep(0.15,0.0,abs(y-BT))*isTop);
  col+=vec3(0.45,0.38,0.25)*eG*0.35;
  float fog=smoothstep(-3.0,-10.0,y);col=mix(col,vec3(0.02,0.015,0.03),fog);
  col=max(col,vec3(0.12,0.11,0.14)*smoothstep(-4.0,-0.5,y));
  gl_FragColor=vec4(col,1.0);
}`;

// ─── GROUND GLOW SHADER (exact landing page) ────────────────────────────────
const groundGlowVS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const groundGlowFS = `precision mediump float;
uniform highp float uTime; varying vec2 vUv;
void main() {
  float d = distance(vUv, vec2(0.5));
  float g = smoothstep(0.5, 0.02, d); g *= g;
  float p = 0.85 + 0.15 * sin(uTime * 0.35);
  float shift = sin(uTime * 0.15) * 0.5 + 0.5;
  vec3 warm = vec3(0.35, 0.34, 0.12);
  vec3 cool = vec3(0.10, 0.32, 0.25);
  vec3 c = mix(cool, warm, g) * p + vec3(0.06, 0.12, 0.10) * (1.0 - g) * shift;
  gl_FragColor = vec4(c, g * 0.15);
}`;

// ─── DETERMINISTIC RNG ──────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ─── CAMERA ─────────────────────────────────────────────────────────────────
function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function getCameraPosition(time: number): { pos: [number, number, number]; lookAt: [number, number, number] } {
  const introDur = 5.0;
  const introT = Math.min(time / introDur, 1);
  const introE = easeOutExpo(introT);
  const introSpin = (1 - introE) * Math.PI * 1.8;
  const autoOrbit = time * 0.015;
  const camAngle = 0.6 + autoOrbit + introSpin;
  const camR = 55 + (22 - 55) * introE;
  const introY = (1 - introE) * 8;
  return {
    pos: [Math.sin(camAngle) * camR, introY, Math.cos(camAngle) * camR],
    lookAt: [0, TH * 0.35, 0],
  };
}

// ─── TOWER BLOCKS COMPONENT ────────────────────────────────────────────────
const TowerBlocks: React.FC<{ time: number; cameraPos: [number, number, number] }> = ({ time, cameraPos }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { blockMat, energyAttr } = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: blockVS,
      fragmentShader: blockFS,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uTowerHeight: { value: TH },
        uSpireNorm: { value: parseFloat(SPIRE_NORM) },
      },
      toneMapped: true,
    });

    const rand = mulberry32(42);
    const energies = new Float32Array(NB);
    const hueOffsets = new Float32Array(NB);
    const phases = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      energies[i] = Math.pow(rand(), 0.4) * 0.7 + 0.3;
      phases[i] = rand() * Math.PI * 2;
      hueOffsets[i] = rand();
    }

    return {
      blockMat: mat,
      energyAttr: new THREE.InstancedBufferAttribute(energies, 1),
      hueAttr: new THREE.InstancedBufferAttribute(hueOffsets, 1),
      phaseAttr: new THREE.InstancedBufferAttribute(phases, 1),
    };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    function layerOf(y: number) { for (let l = TL - 1; l >= 0; l--) if (y >= lY(l) - 0.01) return l; return 0; }
    for (let i = 0; i < NB; i++) {
      const p = POSITIONS[i], sc = lScale(layerOf(p.y));
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.ry, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const rand = mulberry32(42);
    const energies = new Float32Array(NB);
    const hueOffsets = new Float32Array(NB);
    const phases = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      energies[i] = Math.pow(rand(), 0.4) * 0.7 + 0.3;
      phases[i] = rand() * Math.PI * 2;
      hueOffsets[i] = rand();
    }
    mesh.geometry.setAttribute("aEnergy", new THREE.InstancedBufferAttribute(energies, 1));
    mesh.geometry.setAttribute("aHue", new THREE.InstancedBufferAttribute(hueOffsets, 1));
    mesh.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  }, [energyAttr]);

  blockMat.uniforms.uTime.value = time;
  blockMat.uniforms.uCamPos.value.set(...cameraPos);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, NB]} frustumCulled={false} material={blockMat}>
      <boxGeometry args={[BS, BS, BS]} />
    </instancedMesh>
  );
};

// ─── AURORA SKYBOX COMPONENT ────────────────────────────────────────────────
const AuroraSkybox: React.FC<{ time: number }> = ({ time }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: skyVS, fragmentShader: skyFS,
  }), []);
  mat.uniforms.uTime.value = time;
  return <mesh material={mat}><sphereGeometry args={[500, 32, 16]} /></mesh>;
};

// ─── MARBLE PEDESTAL COMPONENT ──────────────────────────────────────────────
const MarblePedestal: React.FC<{ time: number }> = ({ time }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: marbleVS, fragmentShader: marbleFS,
    uniforms: { uTime: { value: 0 } }, toneMapped: true,
  }), []);
  mat.uniforms.uTime.value = time;

  const tiers = useMemo(() => {
    const TIERS = [{ s: 1.6, h: 0.6 }, { s: 2.8, h: 1.2 }, { s: 3.8, h: 0.8 }, { s: 3.8, h: 10 }];
    const result: Array<{ r: number; h: number; y: number }> = [];
    let yT = -0.5;
    for (const t of TIERS) {
      const r = HW * t.s, h = t.h;
      result.push({ r, h, y: yT - h / 2 });
      yT -= h;
    }
    return result;
  }, []);

  return (
    <group>
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} material={mat}>
          <cylinderGeometry args={[t.r, t.r, t.h, 48]} />
        </mesh>
      ))}
    </group>
  );
};

// ─── GROUND GLOW COMPONENT ──────────────────────────────────────────────────
const GroundGlow: React.FC<{ time: number }> = ({ time }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: groundGlowVS, fragmentShader: groundGlowFS,
  }), []);
  mat.uniforms.uTime.value = time;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} material={mat}>
      <planeGeometry args={[120, 120]} />
    </mesh>
  );
};

// ─── GOD-RAY COMPONENT ──────────────────────────────────────────────────────
const GodRay: React.FC = () => (
  <group>
    <mesh position={[0, TH + 0.5, 0]}>
      <sphereGeometry args={[0.6, 8, 8]} />
      <meshBasicMaterial color={0xFFD060} transparent opacity={0.4} />
    </mesh>
    <mesh position={[0, TH + 0.5, 0]}>
      <sphereGeometry args={[1.5, 8, 8]} />
      <meshBasicMaterial color={0xFFD060} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  </group>
);

// ─── PARTICLES COMPONENT (3-tier, exact landing page) ───────────────────────
const LandingParticles: React.FC<{ time: number }> = ({ time }) => {
  const embersRef = useRef<THREE.Points>(null);
  const firefliesRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);

  const EC = 150, FC = 80, DC = 250;

  const { emberData, fireflyData, dustData } = useMemo(() => {
    const rand = mulberry32(7777);

    // Embers
    const eP = new Float32Array(EC * 3), eSp = new Float32Array(EC), ePh = new Float32Array(EC), eCl = new Float32Array(EC * 3);
    for (let i = 0; i < EC; i++) {
      const a = rand() * Math.PI * 2, r = 2 + rand() * 6;
      eP[i * 3] = Math.cos(a) * r; eP[i * 3 + 1] = rand() * TH * 1.3 - 2; eP[i * 3 + 2] = Math.sin(a) * r;
      eSp[i] = 0.08 + rand() * 0.12; ePh[i] = rand() * Math.PI * 2;
      const w = 0.85 + rand() * 0.15;
      eCl[i * 3] = w; eCl[i * 3 + 1] = w * 0.5 + rand() * 0.2; eCl[i * 3 + 2] = 0.05 + rand() * 0.15;
    }

    // Fireflies
    const fP = new Float32Array(FC * 3), fPh = new Float32Array(FC), fCl = new Float32Array(FC * 3);
    for (let i = 0; i < FC; i++) {
      const a = rand() * Math.PI * 2, r = 8 + rand() * 18;
      fP[i * 3] = Math.cos(a) * r; fP[i * 3 + 1] = rand() * TH * 1.6 - 4; fP[i * 3 + 2] = Math.sin(a) * r;
      fPh[i] = rand() * Math.PI * 2;
      const cc = rand();
      if (cc < 0.4) { fCl[i * 3] = 0.45 + rand() * 0.15; fCl[i * 3 + 1] = 0.12 + rand() * 0.08; fCl[i * 3 + 2] = 0.65 + rand() * 0.15; }
      else if (cc < 0.75) { fCl[i * 3] = 0.1 + rand() * 0.1; fCl[i * 3 + 1] = 0.55 + rand() * 0.2; fCl[i * 3 + 2] = 0.6 + rand() * 0.15; }
      else { fCl[i * 3] = 0.85 + rand() * 0.1; fCl[i * 3 + 1] = 0.65 + rand() * 0.15; fCl[i * 3 + 2] = 0.15 + rand() * 0.1; }
    }

    // Cosmic dust
    const dP = new Float32Array(DC * 3), dPh = new Float32Array(DC), dCl = new Float32Array(DC * 3);
    for (let i = 0; i < DC; i++) {
      const a = rand() * Math.PI * 2, r = 25 + rand() * 60;
      const elev = rand() * Math.PI * 0.6;
      dP[i * 3] = Math.cos(a) * r * Math.sin(elev);
      dP[i * 3 + 1] = Math.cos(elev) * r * 0.6 + rand() * TH * 0.5;
      dP[i * 3 + 2] = Math.sin(a) * r * Math.sin(elev);
      dPh[i] = rand() * Math.PI * 2;
      const dc = rand();
      if (dc < 0.35) { dCl[i * 3] = 0.35; dCl[i * 3 + 1] = 0.2; dCl[i * 3 + 2] = 0.55; }
      else if (dc < 0.6) { dCl[i * 3] = 0.15; dCl[i * 3 + 1] = 0.4; dCl[i * 3 + 2] = 0.45; }
      else if (dc < 0.8) { dCl[i * 3] = 0.55; dCl[i * 3 + 1] = 0.45; dCl[i * 3 + 2] = 0.2; }
      else { dCl[i * 3] = 0.45; dCl[i * 3 + 1] = 0.42; dCl[i * 3 + 2] = 0.5; }
    }

    return {
      emberData: { pos: eP, speed: eSp, phase: ePh, color: eCl },
      fireflyData: { pos: fP, phase: fPh, color: fCl },
      dustData: { pos: dP, phase: dPh, color: dCl },
    };
  }, []);

  // Update particle positions each frame (deterministic from time)
  useEffect(() => {
    const t = time;

    // Embers
    if (embersRef.current) {
      const ea = (embersRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      // Reset to initial positions and apply deterministic offset
      const rand = mulberry32(7777);
      for (let i = 0; i < EC; i++) {
        const a = rand() * Math.PI * 2, r = 2 + rand() * 6;
        const baseX = Math.cos(a) * r;
        const baseY = rand() * TH * 1.3 - 2;
        const baseZ = Math.sin(a) * r;
        const sp = 0.08 + rand() * 0.12;
        const ph = rand() * Math.PI * 2;
        rand(); // skip warmR
        rand(); // skip green
        rand(); // skip blue

        const yOff = (t * sp * 0.96) % (TH * 1.4 + 3);
        ea[i * 3] = baseX + Math.sin(t * 0.7 + ph) * 0.36 * Math.min(t, 6);
        ea[i * 3 + 1] = ((baseY + yOff + 3) % (TH * 1.4 + 3)) - 3;
        ea[i * 3 + 2] = baseZ + Math.cos(t * 0.5 + ph * 1.3) * 0.36 * Math.min(t, 6);
      }
      embersRef.current.geometry.attributes.position.needsUpdate = true;
      embersRef.current.material.opacity = 0.4 + 0.15 * Math.sin(t * 0.3);
    }

    // Fireflies
    if (firefliesRef.current) {
      const fa = (firefliesRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      // Reset RNG to firefly seed position
      const rand2 = mulberry32(7777);
      for (let i = 0; i < EC; i++) { rand2(); rand2(); rand2(); rand2(); rand2(); rand2(); rand2(); }
      for (let i = 0; i < FC; i++) {
        const a = rand2() * Math.PI * 2, r = 8 + rand2() * 18;
        const baseX = Math.cos(a) * r;
        const baseY = rand2() * TH * 1.6 - 4;
        const baseZ = Math.sin(a) * r;
        const ph = rand2() * Math.PI * 2;
        rand2(); // skip color choice
        if (i < FC) { rand2(); rand2(); rand2(); } // skip color values

        fa[i * 3] = baseX + Math.sin(t * 0.3 + ph) * 0.48 * Math.min(t, 10);
        fa[i * 3 + 1] = ((baseY + t * 0.12 + 5) % (TH * 1.8 + 5)) - 5;
        fa[i * 3 + 2] = baseZ + Math.sin(t * 0.25 + ph * 0.8) * 0.48 * Math.min(t, 10);
      }
      firefliesRef.current.geometry.attributes.position.needsUpdate = true;
      firefliesRef.current.material.opacity = 0.2 + 0.2 * Math.sin(t * 0.4);
    }

    // Cosmic dust
    if (dustRef.current) {
      const da = (dustRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < DC; i++) {
        da[i * 3] = dustData.pos[i * 3] + Math.sin(t * 0.08 + dustData.phase[i]) * 0.18 * Math.min(t, 20);
        da[i * 3 + 1] = dustData.pos[i * 3 + 1] + Math.cos(t * 0.06 + dustData.phase[i] * 1.4) * 0.12 * Math.min(t, 20);
        da[i * 3 + 2] = dustData.pos[i * 3 + 2] + Math.sin(t * 0.07 + dustData.phase[i] * 0.9) * 0.18 * Math.min(t, 20);
      }
      dustRef.current.geometry.attributes.position.needsUpdate = true;
      dustRef.current.material.opacity = 0.18 + 0.1 * Math.sin(t * 0.2);
    }
  }, [time, emberData, fireflyData, dustData]);

  return (
    <group>
      <points ref={embersRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[emberData.pos.slice(), 3]} />
          <bufferAttribute attach="attributes-color" args={[emberData.color, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <points ref={firefliesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fireflyData.pos.slice(), 3]} />
          <bufferAttribute attach="attributes-color" args={[fireflyData.color, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.5} vertexColors transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustData.pos.slice(), 3]} />
          <bufferAttribute attach="attributes-color" args={[dustData.color, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
};

// ─── MAIN SCENE ─────────────────────────────────────────────────────────────
/**
 * PitchBackground — Exact replica of the landing page tower animation.
 * Same aurora skybox, warm golden lighting, pastel block shader, marble
 * pedestal, 3-tier particles, god-ray, and cinematic spin-in camera.
 * 20 seconds at 30fps, 1920x1080 landscape.
 */
export const PitchBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const time = frame / fps;
  const cam = getCameraPosition(time);

  const handleCreated = useCallback((state: { camera: THREE.Camera }) => {
    cameraRef.current = state.camera as THREE.PerspectiveCamera;
  }, []);

  // Update camera
  const camera = cameraRef.current;
  if (camera) {
    camera.position.set(...cam.pos);
    camera.lookAt(new THREE.Vector3(...cam.lookAt));
    camera.updateProjectionMatrix();
  }

  // Beacon light pulsing
  const beaconIntensity = 2.5 + Math.sin(time * 0.7) * 0.8;

  return (
    <AbsoluteFill style={{ backgroundColor: "#050710" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 52, near: 0.5, far: 1200, position: cam.pos }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.7,
        }}
        onCreated={handleCreated}
      >
        {/* ─── Lighting (exact landing page) ── */}
        <ambientLight color={0xD4C4A0} intensity={0.20} />
        <hemisphereLight args={[0x3a2850, 0x8A5820, 0.35]} />
        <directionalLight position={[12, 40, 8]} intensity={0.35} color={0xD0D8F0} />
        {/* Base uplight */}
        <pointLight position={[0, 1, 0]} intensity={3} color={0xFFB040} distance={55} decay={1.2} />
        {/* Beacon (spire) */}
        <pointLight position={[0, TH - 2, 0]} intensity={beaconIntensity} color={0xFFD700} distance={60} decay={1.0} />
        {/* Mid-tower */}
        <pointLight position={[0, TH * 0.5, 0]} intensity={2} color={0xFFA030} distance={45} decay={1.2} />
        {/* Abyss */}
        <pointLight position={[0, -4, 0]} intensity={2} color={0x6040B0} distance={20} decay={1.5} />

        {/* ─── Environment ── */}
        <AuroraSkybox time={time} />
        <GroundGlow time={time} />
        <GodRay />

        {/* ─── Tower ── */}
        <TowerBlocks time={time} cameraPos={cam.pos} />
        <MarblePedestal time={time} />

        {/* ─── Particles ── */}
        <LandingParticles time={time} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
