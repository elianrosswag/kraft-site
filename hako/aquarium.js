// HAKO · planted aquarium scene (Kit 01 in a 40 cm cube).
// Stones are the real printed models; plants are grown procedurally on top of them.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from './vendor/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';

// ---------- seeded random ----------
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const pick = a => a[Math.floor(rnd() * a.length)];

// ---------- tank dimensions (1 unit = 100 mm) ----------
const HALF = 2, GLASS = 0.05, FLOOR = GLASS, G = FLOOR + 0.15, WATER = 3.72, TOP = 4.0;

// ---------- canvas textures ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

function leafTexture(kind) {
  const W = 128, H = 256, [c, g] = canvas(W, H);
  const path = new Path2D();
  if (kind === 'round') {
    // Monte Carlo / pennywort: round with a small notch at the stalk
    path.ellipse(W / 2, H / 2, W * .46, H * .23, 0, 0, Math.PI * 2);
  } else {
    const wmax = kind === 'blade' ? .30 : kind === 'buce' ? .44 : kind === 'crypt' ? .36 : .40;
    const bulge = kind === 'buce' ? .45 : kind === 'crypt' ? .42 : .38;
    path.moveTo(W / 2, H - 2);
    path.bezierCurveTo(W / 2 + W * wmax * 1.2, H * (1 - bulge * .6), W / 2 + W * wmax, H * (bulge * .5), W / 2, 2);
    path.bezierCurveTo(W / 2 - W * wmax, H * (bulge * .5), W / 2 - W * wmax * 1.2, H * (1 - bulge * .6), W / 2, H - 2);
  }
  g.save(); g.clip(path);
  const gr = g.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, '#b9b9b9'); gr.addColorStop(.5, '#e9e9e9'); gr.addColorStop(1, '#f6f6f6');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // edge darkening
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke(path);
  // veins
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = kind === 'round' ? 2 : 3;
  if (kind === 'round') {
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .36; g.beginPath(); g.moveTo(W / 2, H / 2 + H * .2); g.lineTo(W / 2 + Math.cos(a) * W * .5, H / 2 + H * .2 + Math.sin(a) * H * .42); g.stroke(); }
  } else {
    g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 6); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,.28)';
    for (let y = H * .9; y > 20; y -= kind === 'buce' ? 22 : 16) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * W * .18, y - 18, W / 2 + s * W * .4, y - 40); g.stroke(); } }
  }
  // cell texture / speckle
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rr(.03, .09)})`; g.fillRect(rnd() * W, rnd() * H, rr(1, 3), rr(1, 3)); }
  g.restore();
  const t = tex(c); t.generateMipmaps = true; return t;
}

function mossTexture() {
  // Christmas-moss style frond: a feathery triangular branch system
  const S = 256, [c, g] = canvas(S, S);
  g.lineCap = 'round';
  function branch(x, y, a, len, w, depth) {
    const steps = Math.max(4, Math.floor(len / 5));
    let px = x, py = y;
    for (let i = 0; i < steps; i++) {
      const t = i / steps; const nx = px + Math.cos(a) * len / steps, ny = py + Math.sin(a) * len / steps;
      const l = 205 + rnd() * 50;
      g.strokeStyle = `rgba(${l},${l},${l},${.95 - t * .2})`; g.lineWidth = w * (1 - t * .6);
      g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
      // leaflets
      for (const s of [-1, 1]) {
        const la = a + s * rr(.7, 1.1), ll = rr(3, 6) * (1 - t * .5);
        g.lineWidth = rr(1, 1.8); g.strokeStyle = `rgba(${l},${l},${l},.8)`;
        g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(la) * ll, ny + Math.sin(la) * ll); g.stroke();
      }
      if (depth > 0 && i % 2 === 1 && t < .85) {
        const s = i % 4 === 1 ? 1 : -1;
        branch(nx, ny, a + s * rr(.8, 1.05), len * (1 - t) * .55, w * .7, depth - 1);
      }
      px = nx; py = ny; a += rr(-.08, .08);
    }
  }
  branch(S / 2, S - 8, -Math.PI / 2, S * .9, 3.2, 2);
  return tex(c);
}

function soilTexture() {
  const S = 512, [c, g] = canvas(S, S);
  g.fillStyle = '#1d1915'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14000; i++) {
    const r = rr(1, 3.2), x = rnd() * S, y = rnd() * S, l = rr(20, 62);
    g.fillStyle = `rgb(${l + 8},${l},${l - 6})`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(255,240,220,.08)'; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .45, 0, 6.283); g.fill();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
}

function blobTexture() {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.6, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return tex(c, false);
}

// ---------- shader patch: caustics, sway, soft translucency ----------
const U = { uTime: { value: 0 } };
const CAUSTIC = /* glsl */`
float hakoCaustic(vec2 p, float t){
  p = mod(p * 2.4, 6.2831853) - 250.0;
  vec2 i = p; float c = 1.0; float inten = .005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}`;
function patch(mat, { sway = false, caustic = .9, glow = 0 } = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying vec3 vWP; ${sway ? 'attribute vec3 aSway;' : ''}`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wp = modelMatrix * mvPosition;
        ${sway ? `
          float hh = max(wp.y - aSway.y, 0.0);
          float k = aSway.x * hh * hh;
          wp.x += k * (sin(uTime * .8 + aSway.z + wp.y * 1.7) * .6 + sin(uTime * 1.9 + aSway.z * 3.0) * .15);
          wp.z += k * cos(uTime * .63 + aSway.z * 1.3 + wp.y * 1.2) * .45;
        ` : ''}
        vWP = wp.xyz;
        mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying vec3 vWP; ${CAUSTIC}`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float up = clamp(dot(normal, upV) * .7 + .3, 0.0, 1.0);
          float cs = hakoCaustic(vWP.xz + vWP.y * .15, uTime * .35) ;
          float depthFade = smoothstep(-0.2, ${WATER.toFixed(2)}, vWP.y) * .6 + .4;
          outgoingLight += diffuseColor.rgb * cs * up * depthFade * ${caustic.toFixed(2)};
          outgoingLight += diffuseColor.rgb * ${glow.toFixed(2)};
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `hako-${sway}-${caustic}-${glow}`;
  return mat;
}

// ---------- heightmap of the stone layout (rendered from above) ----------
function heightmap(renderer, objects, N = 256) {
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying float vy; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vy = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vy; void main(){ gl_FragColor = vec4(vy, 0.0, 0.0, 1.0); }',
    side: THREE.DoubleSide
  });
  objects.forEach(o => { o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) { const c = new THREE.Mesh(m.geometry, mat); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); sc.add(c); } }); });
  const cam = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, .1, 30);
  cam.position.set(0, 20, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType });
  const buf = new Float32Array(N * N * 4);
  try {
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, N, N, buf);
  } catch (e) { /* no float targets: plants still grow on the soil */ }
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); rt.dispose(); mat.dispose();
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = Math.max(G, buf[i * 4] || 0);
  const cell = 2 * HALF / N;
  const toW = (c, r) => [-HALF + (c + .5) * cell, HALF - (r + .5) * cell];
  const toC = (x, z) => [Math.round((x + HALF) / cell - .5), Math.round((HALF - z) / cell - .5)];
  const at = (c, r) => h[Math.min(N - 1, Math.max(0, r)) * N + Math.min(N - 1, Math.max(0, c))];
  const sample = (x, z) => { const [c, r] = toC(x, z); return at(c, r); };
  const slope = (c, r) => Math.hypot(at(c + 1, r) - at(c - 1, r), at(c, r + 1) - at(c, r - 1)) / (2 * cell);
  return { N, h, cell, toW, toC, at, sample, slope };
}

function findSockets(hm) {
  const { N, at, cell } = hm, R = Math.round(.32 / cell), hole = new Uint8Array(N * N);
  const dirs = [...Array(12)].map((_, i) => [Math.cos(i / 12 * 6.283), Math.sin(i / 12 * 6.283)]);
  for (let r = 2; r < N - 2; r += 1) for (let c = 2; c < N - 2; c += 1) {
    const h0 = at(c, r); if (h0 < G + .05) continue;
    let ringMin = 1e9;
    for (const [dx, dy] of dirs) { let m = -1e9; for (let s = 2; s <= R; s++) m = Math.max(m, at(Math.round(c + dx * s), Math.round(r + dy * s))); ringMin = Math.min(ringMin, m); }
    if (ringMin - h0 > .12) hole[r * N + c] = 1;
  }
  // flood-fill clusters
  const seen = new Uint8Array(N * N), out = [];
  for (let i = 0; i < N * N; i++) {
    if (!hole[i] || seen[i]) continue;
    const st = [i]; seen[i] = 1; let sx = 0, sy = 0, n = 0, top = -1e9;
    while (st.length) {
      const j = st.pop(), c = j % N, r = (j / N) | 0; sx += c; sy += r; n++;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (r + dr) * N + c + dc; if (hole[k] && !seen[k]) { seen[k] = 1; st.push(k); } }
    }
    if (n * cell * cell < .03) continue; // too small to be a pod socket
    const cc = Math.round(sx / n), cr = Math.round(sy / n);
    for (let a = 0; a < 6.283; a += .5) top = Math.max(top, at(Math.round(cc + Math.cos(a) * R * .9), Math.round(cr + Math.sin(a) * R * .9)));
    const [x, z] = hm.toW(cc, cr);
    out.push({ x, z, floor: at(cc, cr), rim: top, r: Math.sqrt(n * cell * cell / Math.PI) });
  }
  return out;
}

// ---------- geometry helpers ----------
function leafGeo(w, l, bend, segs = 4) {
  const g = new THREE.PlaneGeometry(w, l, 1, segs); g.translate(0, l / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / l; p.setZ(i, -bend * t * t * l); p.setX(i, p.getX(i) * (1 - .15 * t)); }
  g.computeVertexNormals(); return g;
}
function bladeGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 1, 6); g.translate(0, .5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i); p.setX(i, p.getX(i) * (1 - t * .92)); p.setZ(i, -.28 * t * t); }
  g.computeVertexNormals(); return g;
}

class Batch {
  constructor(geo, mat, max) { this.geo = geo; this.mat = mat; this.max = max; this.m = []; this.c = []; this.s = []; }
  add(pos, quat, scale, color, sway = [0, 0, 0]) { if (this.m.length >= this.max) return; this.m.push(new THREE.Matrix4().compose(pos, quat, scale)); this.c.push(color); this.s.push(sway); }
  build() {
    const n = this.m.length, mesh = new THREE.InstancedMesh(this.geo, this.mat, Math.max(n, 1));
    const sw = new Float32Array(Math.max(n, 1) * 3);
    this.m.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, this.c[i]); sw.set(this.s[i], i * 3); });
    mesh.count = n; this.geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sw, 3));
    mesh.frustumCulled = false; mesh.receiveShadow = true; return mesh;
  }
}

const e = new THREE.Euler(), q = new THREE.Quaternion(), V = (x, y, z) => new THREE.Vector3(x, y, z);
const quat = (yaw, pitch, roll = 0) => q.clone().setFromEuler(e.set(pitch, yaw, roll, 'YXZ'));
const col = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);

// ---------- scene ----------
export function initAquarium(stage, { reduce = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.touchAction = 'pan-y';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), .04).texture;

  const cam = new THREE.PerspectiveCamera(24, 1, .1, 80);
  const ctl = new OrbitControls(cam, renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';
  ctl.enableDamping = true; ctl.dampingFactor = .06; ctl.enableZoom = false; ctl.enablePan = false;
  ctl.minPolarAngle = 1.02; ctl.maxPolarAngle = 1.58; ctl.minAzimuthAngle = -1.0; ctl.maxAzimuthAngle = 1.0;
  ctl.autoRotate = !reduce; ctl.autoRotateSpeed = .35;

  const VIEWS = {
    tank: { t: V(0, 1.95, 0), d: 13.2 },
    close: { t: V(.25, 1.2, .3), d: 6.4 }
  };
  let view = 'tank', dist = VIEWS.tank.d;
  ctl.target.copy(VIEWS.tank.t);
  cam.position.set(Math.sin(.32) * dist, 1.95 + dist * .22, Math.cos(.32) * dist);

  // light: a single pendant above the tank plus the room
  scene.add(new THREE.HemisphereLight(0xeef3ea, 0x2a2620, .4));
  const sun = new THREE.DirectionalLight(0xfffaf0, 3.0); sun.position.set(.8, 9, 1.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 2, far: 14 });
  scene.add(sun);
  const front = new THREE.DirectionalLight(0xffffff, .6); front.position.set(1, 3, 8); scene.add(front);

  // floor shadow under the tank
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .002; scene.add(blob);

  // substrate: tiles of aquasoil in a dark printed tray
  const soil = soilTexture();
  const trayM = patch(new THREE.MeshStandardMaterial({ color: 0x2a2c29, roughness: .92 }), { caustic: .25 });
  const soilM = patch(new THREE.MeshStandardMaterial({ color: 0x8a7f72, map: soil, roughness: 1 }), { caustic: .45 });
  const sub = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF - .02, G - FLOOR, 2 * HALF - .02), [trayM, trayM, soilM, trayM, trayM, trayM]);
  sub.position.y = (G + FLOOR) / 2; sub.receiveShadow = true; scene.add(sub);
  // faint tile seams on the front edge
  const seamM = new THREE.MeshBasicMaterial({ color: 0x121312 });
  for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.012, G - FLOOR, .005), seamM); s.position.set(i * .5, (G + FLOOR) / 2, HALF - .005); scene.add(s); }

  // glass + water (drawn after everything inside)
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xd9ebe4, roughness: .04, metalness: 0, transparent: true, opacity: .045, envMapIntensity: 1.4, depthWrite: false, side: THREE.FrontSide });
  const tank = new THREE.Group(); tank.renderOrder = 10; scene.add(tank);
  const panes = [
    [V(0, TOP / 2, HALF), V(2 * HALF, TOP, GLASS)], [V(0, TOP / 2, -HALF), V(2 * HALF, TOP, GLASS)],
    [V(HALF, TOP / 2, 0), V(GLASS, TOP, 2 * HALF)], [V(-HALF, TOP / 2, 0), V(GLASS, TOP, 2 * HALF)],
    [V(0, GLASS / 2, 0), V(2 * HALF, GLASS, 2 * HALF)]
  ];
  for (const [p, s] of panes) { const m = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), glassM); m.position.copy(p); m.renderOrder = 10; tank.add(m); }
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, TOP), new THREE.MeshBasicMaterial({ color: 0x0e0f0e }));
  backing.position.set(0, TOP / 2, -HALF - GLASS); scene.add(backing);
  // green glass edges, as on low-iron rimless tanks
  const edgeM = new THREE.MeshBasicMaterial({ color: 0x8fb5a6, transparent: true, opacity: .55, depthWrite: false });
  const ed = (x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), edgeM); m.position.set(x, y, z); m.renderOrder = 11; tank.add(m); };
  const t2 = .02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ed(sx * HALF, TOP / 2, sz * HALF, t2 * 2, TOP, t2 * 2);
  for (const sz of [-1, 1]) { ed(0, TOP, sz * HALF, 2 * HALF, t2, t2 * 2.5); ed(0, .01, sz * HALF, 2 * HALF, t2, t2 * 2.5); }
  for (const sx of [-1, 1]) { ed(sx * HALF, TOP, 0, t2 * 2.5, t2, 2 * HALF); ed(sx * HALF, .01, 0, t2 * 2.5, t2, 2 * HALF); }
  // water: tinted volume faces + a moving surface
  const waterM = new THREE.MeshBasicMaterial({ color: 0x7fc4ad, transparent: true, opacity: .035, depthWrite: false, side: THREE.FrontSide });
  const wv = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF - .06, WATER - FLOOR, 2 * HALF - .06), waterM);
  wv.position.y = (WATER + FLOOR) / 2; wv.renderOrder = 9; scene.add(wv);
  const surfM = new THREE.MeshPhysicalMaterial({ color: 0xbfe0d4, roughness: .08, transparent: true, opacity: .16, envMapIntensity: 2.0, depthWrite: false, side: THREE.DoubleSide });
  const surfG = new THREE.PlaneGeometry(2 * HALF - .06, 2 * HALF - .06, 40, 40); surfG.rotateX(-Math.PI / 2);
  const surf = new THREE.Mesh(surfG, surfM); surf.position.y = WATER; surf.renderOrder = 12; scene.add(surf);
  const surfBase = surfG.attributes.position.array.slice();

  // floating specks
  const PN = 260, pp = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) pp.set([rr(-1.9, 1.9), rr(G + .1, WATER - .1), rr(-1.9, 1.9)], i * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const specks = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf4f7ee, size: .018, transparent: true, opacity: .55, depthWrite: false }));
  specks.renderOrder = 8; scene.add(specks);

  // ---------- stones ----------
  const stoneM = patch(new THREE.MeshStandardMaterial({ color: 0x262824, roughness: .9, flatShading: true, envMapIntensity: .3 }), { caustic: .55 });
  const LAYOUT = [
    { k: 'mountain', x: -.75, z: -.6, ry: 0 },
    { k: 'cliff', x: 1.0, z: -1.0, ry: Math.PI / 2 },
    { k: 'ledge', x: .5, z: .2, ry: 0 },
    { k: 'boulder', x: -1.5, z: .85, ry: 0 },
    { k: 'boulder', x: 1.5, z: .45, ry: Math.PI }
  ];
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  const get = k => cache[k] || (cache[k] = loader.loadAsync('models/' + k + '.glb'));

  let ready = false;
  const done = Promise.all(LAYOUT.map(L => get(L.k))).then(gls => {
    const stones = [];
    LAYOUT.forEach((L, i) => {
      const o = gls[i].scene.clone(true);
      o.traverse(m => { if (m.isMesh) { m.material = stoneM; m.castShadow = true; m.receiveShadow = true; } });
      const wrap = new THREE.Group(); wrap.add(o); wrap.rotation.y = L.ry;
      wrap.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(wrap), c = b.getCenter(new THREE.Vector3());
      o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b.min.y;
      if (L.ry) { const v = V(-c.x, -b.min.y, -c.z).applyAxisAngle(V(0, 1, 0), -L.ry); o.position.set(v.x, v.y, v.z); }
      wrap.position.set(L.x, G, L.z); scene.add(wrap); stones.push(wrap);
    });
    grow(stones);
    ready = true; stage.classList.add('ready');
  });

  // ---------- planting ----------
  function grow(stones) {
    const hm = heightmap(renderer, stones);
    const sockets = findSockets(hm);

    const plantM = (map, glow, extra = {}) => patch(new THREE.MeshStandardMaterial({ map, alphaTest: .42, side: THREE.DoubleSide, roughness: .55, envMapIntensity: .5, ...extra }), { sway: true, caustic: .55, glow });
    const T = { lance: leafTexture('lance'), round: leafTexture('round'), blade: leafTexture('blade'), buce: leafTexture('buce'), crypt: leafTexture('crypt'), moss: mossTexture() };

    const mossB = new Batch((() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .45, 0); return g; })(), plantM(T.moss, .05, { roughness: .9 }), 16000);
    const carpetB = new Batch((() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })(), plantM(T.round, .06), 24000);
    const stemLeafB = new Batch(leafGeo(1, 1, .25), plantM(T.lance, .07), 26000);
    const stemB = new Batch(new THREE.CylinderGeometry(.5, .5, 1, 5, 1).translate(0, .5, 0), plantM(null, .05, { color: 0xffffff }), 6000);
    const bladeB = new Batch(bladeGeo(), plantM(T.blade, .06), 5000);
    const buceB = new Batch(leafGeo(1, 1, .35), plantM(T.buce, .06, { roughness: .35, envMapIntensity: .9 }), 800);
    const cryptB = new Batch(leafGeo(1, 1, .5), plantM(T.crypt, .08), 800);

    const occupied = (x, z, pad = 0) => { for (const [dx, dz] of [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]]) if (hm.sample(x + dx, z + dz) > G + .03) return true; return false; };
    const inside = (x, z, m = .08) => Math.abs(x) < HALF - m && Math.abs(z) < HALF - m;

    // --- carpet (Monte Carlo): front and mid ground, patchy towards the back
    const carpetCol = () => col(rr(.23, .3), rr(.55, .8), rr(.17, .3));
    for (let i = 0; i < 60000 && carpetB.m.length < carpetB.max; i++) {
      const x = rr(-1.93, 1.93), z = rr(-1.6, 1.93);
      if (occupied(x, z, .02)) continue;
      const n = .5 + .5 * Math.sin(x * 2.3 + 1.2) * Math.cos(z * 1.7 - .4) + .25 * Math.sin(x * 5.1 - z * 4.3);
      const backFade = THREE.MathUtils.smoothstep(z, -1.6, -.4);
      if (rnd() > (.35 + .65 * n) * (.25 + .75 * backFade)) continue;
      const lift = rr(.004, .05) * (1.2 - .4 * backFade);
      const s = rr(.032, .052);
      carpetB.add(V(x, G + lift, z), quat(rr(0, 6.28), rr(-.5, .5), rr(-.5, .5)), V(s, 1, s * 1.1), carpetCol(), [.0, G, rr(0, 6)]);
    }

    // --- moss: on every upward face of the stones, thickest in hollows and along the base
    const mossCol = () => col(rr(.2, .27), rr(.45, .7), rr(.1, .2));
    const N = hm.N;
    let tries = 0;
    while (mossB.m.length < mossB.max - 20 && tries++ < 400000) {
      const c = 2 + Math.floor(rnd() * (N - 4)), r = 2 + Math.floor(rnd() * (N - 4));
      const h = hm.at(c, r), [x, z] = hm.toW(c, r);
      if (!inside(x, z)) continue;
      const sl = hm.slope(c, r);
      let w = 0;
      if (h > G + .03) {
        if (sl > 2.2) continue;
        const nb = (hm.at(c + 4, r) + hm.at(c - 4, r) + hm.at(c, r + 4) + hm.at(c, r - 4)) / 4;
        const concave = THREE.MathUtils.clamp((nb - h) * 18, 0, 1);
        w = .35 + .65 * concave;
        if (sockets.some(s => Math.hypot(s.x - x, s.z - z) < s.r * 1.05)) continue;
      } else {
        // base of the stones: a moss skirt where rock meets soil
        let near = 0; for (const [dc, dr] of [[5, 0], [-5, 0], [0, 5], [0, -5], [3, 3], [-3, -3], [3, -3], [-3, 3]]) if (hm.at(c + dc, r + dr) > G + .08) near++;
        w = near ? .7 : 0;
      }
      if (rnd() > w) continue;
      // a clump of fronds
      const k = 5 + Math.floor(rnd() * 6), base = mossCol();
      for (let j = 0; j < k; j++) {
        const ox = x + rr(-.035, .035), oz = z + rr(-.035, .035);
        const s = rr(.06, .12), cc = base.clone().offsetHSL(rr(-.01, .01), 0, rr(-.05, .05));
        mossB.add(V(ox, hm.sample(ox, oz) - .01, oz), quat(rr(0, 6.28), rr(.55, 1.35), rr(-.3, .3)), V(s, s, s), cc, [.0, 0, 0]);
      }
    }

    // --- stem plants (Rotala) in the back corners, reaching for the light
    function stem(bx, bz, H, tint) {
      let p = V(bx, hm.sample(bx, bz) - .02, bz);
      let dir = V(rr(-.12, .12), 1, rr(-.08, .02)).normalize();
      const baseY = p.y, internode = .065;
      const steps = Math.floor(H / internode);
      let rot = rr(0, 6.28);
      for (let i = 0; i < steps; i++) {
        const t = i / steps, seg = internode * (1 - .45 * t);
        const next = p.clone().addScaledVector(dir, seg);
        if (next.y > WATER - .06) break;
        const sq = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
        stemB.add(p.clone(), sq, V(.012, seg, .012), col(.22 + tint * .5, .35, .32 + t * .1), [.06, baseY, bz * 3 + bx]);
        // opposite pair of leaves, decussate
        rot += Math.PI / 2;
        const tip = t > .82;
        const L = (tip ? rr(.06, .1) : rr(.11, .17)) * (1 - t * .25), W = L * rr(.26, .34);
        for (const s of [0, Math.PI]) {
          const c = tip ? col(rr(.06, .12) + tint, rr(.35, .55), rr(.34, .44)) : col(rr(.22, .3) + tint * .3, rr(.5, .75), rr(.16, .27) + t * .1);
          stemLeafB.add(next.clone(), quat(rot + s, (tip ? .35 : rr(.75, 1.15)), rr(-.2, .2)), V(W, L, W), c, [.06, baseY, bz * 3 + bx]);
        }
        dir.x += rr(-.03, .03); dir.z += rr(-.03, .03); dir.normalize();
        p = next;
      }
    }
    const stemBunch = (cx, cz, n, rad, hmin, hmax, tint) => { for (let i = 0; i < n; i++) { const a = rr(0, 6.28), d = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!inside(x, z, .12) || occupied(x, z, .03)) continue; stem(x, z, rr(hmin, hmax), tint); } };
    stemBunch(-1.6, -1.6, 46, .4, 2.9, 3.7, 0);         // green Rotala, back left
    stemBunch(1.62, -1.55, 38, .36, 2.6, 3.6, .0);         // back right
    stemBunch(.2, -1.65, 26, .34, 1.8, 2.8, -.02);        // between, shorter, warmer tips

    // --- hairgrass (Eleocharis) tufts in the mid ground
    const tuft = (cx, cz, n, rad, hmax) => {
      for (let i = 0; i < n; i++) {
        const a = rr(0, 6.28), d = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!inside(x, z) || occupied(x, z, .02)) continue;
        const L = rr(.25, hmax) * (1 - .5 * d / rad), y = hm.sample(x, z);
        bladeB.add(V(x, y - .01, z), quat(rr(0, 6.28), rr(.05, .45) + d / rad * .35), V(rr(.012, .018), L, 1), col(rr(.22, .28), rr(.45, .7), rr(.2, .32)), [.18, y, rr(0, 6)]);
      }
    };
    tuft(-.15, -.35, 260, .32, .85); tuft(1.55, -.55, 200, .3, .9); tuft(-1.2, .25, 160, .28, .6); tuft(1.1, 1.05, 120, .22, .45); tuft(-.6, -1.55, 240, .35, 1.0);

    // --- pods: Bucephalandra and Cryptocoryne rooted in the stone sockets
    sockets.forEach((s, i) => {
      const y = Math.min(s.rim - .06, s.floor + .3);
      if (i % 2 === 0) {
        for (let j = 0; j < 14; j++) {
          const a = j / 14 * 6.28 + rr(-.2, .2), d = rr(0, s.r * .5), L = rr(.16, .26);
          buceB.add(V(s.x + Math.cos(a) * d, y, s.z + Math.sin(a) * d), quat(-a + Math.PI / 2, rr(.5, 1.1), rr(-.2, .2)), V(L * .42, L, L * .42), col(rr(.3, .38), rr(.25, .45), rr(.16, .26)), [.05, y, rr(0, 6)]);
        }
      } else {
        for (let j = 0; j < 11; j++) {
          const a = j / 11 * 6.28 + rr(-.25, .25), L = rr(.28, .44);
          cryptB.add(V(s.x + rr(-.03, .03), y, s.z + rr(-.03, .03)), quat(-a + Math.PI / 2, rr(.25, .75), rr(-.2, .2)), V(L * .3, L, L * .3), col(rr(.12, .2), rr(.3, .5), rr(.22, .32)), [.08, y, rr(0, 6)]);
        }
      }
    });

    [mossB, carpetB, stemB, stemLeafB, bladeB, buceB, cryptB].forEach(b => scene.add(b.build()));
    stage.dataset.sockets = sockets.length;
  }

  // ---------- controls ----------
  const buttons = stage.parentElement.querySelectorAll('[data-view]');
  buttons.forEach(b => b.addEventListener('click', () => {
    view = b.dataset.view; buttons.forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
  renderer.domElement.addEventListener('pointerdown', () => { ctl.autoRotate = false; clearTimeout(stage.__ar); });
  renderer.domElement.addEventListener('pointerup', () => { if (!reduce) stage.__ar = setTimeout(() => ctl.autoRotate = true, 3000); });

  function resize() {
    const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false);
    cam.aspect = r.width / r.height;
    cam.fov = cam.aspect < 1 ? 30 : 24; cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  let visible = true; new IntersectionObserver(es => visible = es[0].isIntersecting, { rootMargin: '100px' }).observe(stage);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), .05);
    if (!visible || !ready) return;
    U.uTime.value += reduce ? 0 : dt;
    const tgt = VIEWS[view], narrow = cam.aspect < 1 ? 1.12 : 1;
    ctl.target.lerp(tgt.t, Math.min(1, dt * 3));
    dist += (tgt.d * narrow - dist) * Math.min(1, dt * 3);
    const off = cam.position.clone().sub(ctl.target); off.setLength(dist); cam.position.copy(ctl.target).add(off);
    // swing back and forth instead of spinning all the way round
    const az = ctl.getAzimuthalAngle(); if (az > .7) ctl.autoRotateSpeed = -Math.abs(ctl.autoRotateSpeed); if (az < -.7) ctl.autoRotateSpeed = Math.abs(ctl.autoRotateSpeed);
    // water surface ripple
    const a = surfG.attributes.position, t = U.uTime.value;
    for (let i = 0; i < a.count; i++) { const x = surfBase[i * 3], z = surfBase[i * 3 + 2]; a.array[i * 3 + 1] = .012 * Math.sin(x * 3.1 + t * 1.3) * Math.cos(z * 2.7 - t * 1.1) + .006 * Math.sin((x + z) * 7 + t * 2.2); }
    a.needsUpdate = true; surfG.computeVertexNormals();
    const P = pg.attributes.position; for (let i = 0; i < PN; i++) { let y = P.array[i * 3 + 1] + dt * .03 * (1 + (i % 3)); if (y > WATER - .05) y = G + .1; P.array[i * 3 + 1] = y; P.array[i * 3] += Math.sin(t * .4 + i) * dt * .02; }
    P.needsUpdate = true;
    ctl.update(); renderer.render(scene, cam);
  });
  return done;
}
