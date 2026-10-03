// QA 独立核验脚本（一次性，不入库可删）：
// 1) klein 8 字浸入的翻转闭合 P(u=1,v)=P(u=0,1-v)，且同 v 不闭合（排除恒真）
// 2) 画家算法方向：两个解析点验证「先远后近、近大远小」与排序方向一致
const KLEIN_A = 1.5;
function kleinPoint(u, v) {
  const theta = 2 * Math.PI * u;
  const phi = 2 * Math.PI * v;
  const w = KLEIN_A + Math.cos(theta / 2) * Math.sin(phi) - Math.sin(theta / 2) * Math.sin(2 * phi);
  return {
    x: w * Math.cos(theta),
    y: w * Math.sin(theta),
    z: Math.sin(theta / 2) * Math.sin(phi) + Math.cos(theta / 2) * Math.sin(2 * phi),
  };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

let ok = true;
for (const v of [0, 0.17, 0.5, 0.83, 1]) {
  const dFlip = dist(kleinPoint(1, v), kleinPoint(0, 1 - v));
  const dSame = dist(kleinPoint(1, v), kleinPoint(0, v));
  console.log(`v=${v}: flip-close d=${dFlip.toExponential(2)}  same-v d=${dSame.toExponential(2)}`);
  if (dFlip > 1e-9) { ok = false; console.log('  FAIL: 翻转闭合不成立'); }
}
// 同 v 在 v=0.25 处必须明显不闭合，否则测试可能是恒真
const dSame25 = dist(kleinPoint(1, 0.25), kleinPoint(0, 0.25));
if (dSame25 < 1e-3) { ok = false; console.log('FAIL: v=0.25 同 v 也闭合，翻转断言无区分度'); }
console.log(`v=0.25 same-v distance = ${dSame25.toFixed(4)} (应显著>0，证明翻转断言有区分度)`);

// --- 画家算法 / 缩放方向 ---
const CAMERA_DIST = 4.5;
function rotate(v, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp };
}
// 两个解析点：A 在相机侧 (+z)，B 在远侧 (-z)
const yaw = 0.7, pitch = 0.45; // 与 Board3D 初始视角一致
const A = rotate({ x: 0, y: 0, z: 1.0 }, yaw, pitch);
const B = rotate({ x: 0, y: 0, z: -1.0 }, yaw, pitch);
const pzA = Math.max(CAMERA_DIST - A.z, 0.05); // Board3D 的 pz：相机距离
const pzB = Math.max(CAMERA_DIST - B.z, 0.05);
const fov = 500, stoneR = 0.2;
const rA = (stoneR * fov) / pzA, rB = (stoneR * fov) / pzB;
console.log(`A(近): rotZ=${A.z.toFixed(3)} pz=${pzA.toFixed(3)} 半径=${rA.toFixed(2)}`);
console.log(`B(远): rotZ=${B.z.toFixed(3)} pz=${pzB.toFixed(3)} 半径=${rB.toFixed(2)}`);
// 排序 stones.sort((a,b)=>pz[b]-pz[a]) => pz 大(远) 的先画
const order = [ 'A', 'B' ].sort((a, b) => (a === 'A' ? pzA : pzB) < (b === 'A' ? pzA : pzB) ? 1 : -1);
console.log(`绘制顺序(先->后): ${order.join(' -> ')} (远的必须先画)`);
if (!(pzB > pzA)) { ok = false; console.log('FAIL: 远点相机距离应更大'); }
if (!(rA > rB)) { ok = false; console.log('FAIL: 近大远小不成立'); }
if (order[0] !== 'B') { ok = false; console.log('FAIL: 排序方向错误，远点未先画'); }

console.log(ok ? 'ALL QA CHECKS PASS' : 'QA CHECKS FAILED');
process.exit(ok ? 0 : 1);
