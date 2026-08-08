// Traces the real logo PNG into an SVG path.
//
// The mark is one connected shape with no holes — the counter opens to the
// outside through the G's mouth — so a single boundary trace is enough.
//
//   alpha mask -> Moore-neighbour contour -> Douglas-Peucker -> SVG path
//
// This replaces four rounds of me estimating the arm's angle by eye.

import fs from "node:fs";
import zlib from "node:zlib";

const FILE = process.argv[2];
const OUT = process.argv[3] || "traced.svg";

// ── decode ──────────────────────────────────────────────────────────────
const buf = fs.readFileSync(FILE);
let pos = 8, W = 0, H = 0, colour = 6;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const t = buf.toString("ascii", pos + 4, pos + 8);
  const d = buf.subarray(pos + 8, pos + 8 + len);
  if (t === "IHDR") { W = d.readUInt32BE(0); H = d.readUInt32BE(4); colour = d[9]; }
  else if (t === "IDAT") idat.push(d);
  else if (t === "IEND") break;
  pos += 12 + len;
}
const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = W * CH, img = Buffer.alloc(stride * H);
let p = 0;
for (let y = 0; y < H; y++) {
  const f = raw[p++]; const row = raw.subarray(p, p + stride); p += stride;
  const o = img.subarray(y * stride, (y + 1) * stride);
  const pr = y ? img.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= CH ? o[i - CH] : 0, b = pr[i], c = i >= CH ? pr[i - CH] : 0;
    let v = row[i];
    if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    o[i] = v & 0xff;
  }
}

const solid = (x, y) =>
  x >= 0 && y >= 0 && x < W && y < H && (CH > 3 ? img[y * stride + x * CH + 3] > 128 : true);

// ── Moore-neighbour boundary trace ──────────────────────────────────────
let sx = -1, sy = -1;
outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) { sx = x; sy = y; break outer; }
if (sx < 0) { console.error("  no shape found"); process.exit(1); }

const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const contour = [];
let cx = sx, cy = sy, dir = 6; // came from "up"
const startX = sx, startY = sy;
let guard = 0;
do {
  contour.push([cx, cy]);
  let found = false;
  for (let k = 0; k < 8; k++) {
    const nd = (dir + 1 + k) % 8;
    const nx = cx + N8[nd][0], ny = cy + N8[nd][1];
    if (solid(nx, ny)) { cx = nx; cy = ny; dir = (nd + 5) % 8; found = true; break; }
  }
  if (!found) break;
} while ((cx !== startX || cy !== startY) && ++guard < 4_000_000);
console.log(`  traced boundary: ${contour.length} points`);

// ── Douglas-Peucker ─────────────────────────────────────────────────────
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let idx = 0, max = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

const EPS = Number(process.argv[4] || 3.0);
let simple = rdp(contour, EPS);
if (simple.length > 2 && simple[0][0] === simple[simple.length - 1][0] && simple[0][1] === simple[simple.length - 1][1]) simple.pop();
console.log(`  simplified: ${simple.length} vertices (epsilon ${EPS}px)`);

// ── normalise into a 64-unit box, centred, aspect preserved ─────────────
const xs = simple.map((q) => q[0]), ys = simple.map((q) => q[1]);
const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
const bw = maxX - minX, bh = maxY - minY;
const scale = 60 / Math.max(bw, bh);
const ox = (64 - bw * scale) / 2, oy = (64 - bh * scale) / 2;
const norm = simple.map(([x, y]) => [
  +((x - minX) * scale + ox).toFixed(2),
  +((y - minY) * scale + oy).toFixed(2),
]);

const d = norm.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + " Z";
fs.writeFileSync(OUT, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Gigzen">
  <title>Gigzen</title>
  <!-- Traced from the master artwork: alpha mask -> boundary -> simplified. -->
  <path d="${d}" fill="currentColor" fill-rule="evenodd"/>
</svg>
`);
console.log(`  wrote ${OUT}  (source ${bw}x${bh}px)`);
fs.writeFileSync(OUT.replace(/\.svg$/, ".json"), JSON.stringify(norm));
