/**
 * 3D 拓扑曲面同步视图（自绘 Canvas，零依赖）。
 * - 棋盘网格清晰映射到参数曲面（加粗格线 + 半透明木色，背面结构可见）；
 * - 棋子为立体双凸围棋子：贴合曲面切平面，带厚度、受光渐变与高光；
 * - 棋子按 displayBoard（与 2D 同一数据源）映射到曲面格点，半径按局部格距自适应；
 * - 拖拽旋转（yaw/pitch），滚轮缩放，空闲 3 秒后缓慢自转；
 * - 2D 悬停棋子时，3D 中对应棋子金色发光联动；
 * - 仅作可视化：落子仍在 2D 视图进行。
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Cell, TopologyId } from '../core/types';
import { EMPTY, vid } from '../core/types';
import { surfacePoint, SURFACE_INFO, type Vec3 } from '../render3d/surfaces';
import { CAMERA_DIST, project, rotate } from '../render3d/project';

export interface Board3DProps {
  topologyId: TopologyId;
  n: number;
  board: Cell[];
  lastMove: { color: 'black' | 'white'; vertex: number | null } | null;
  /** 终局协商中的标死预览（可选，用于与 2D 视图同步标死） */
  dead?: readonly number[];
  /** 2D 视图当前悬停的格点（可选，3D 中对应棋子发光联动） */
  highlightVertex?: number | null;
}

interface GridData {
  /** 归一化后的格点三维坐标（长度 n*n，与 vertexId 一一对应） */
  pts: Vec3[];
  /** 每个格点的棋子基准半径（世界坐标）：局部相邻格距最小值 × 0.44 */
  stoneR: Float64Array;
  /** 每个格点的单位切向量（沿棋盘 x 方向） */
  tan1: Vec3[];
  /** 每个格点的单位切向量（沿棋盘 y 方向） */
  tan2: Vec3[];
  /** 每个格点的单位法向量 */
  norm: Vec3[];
}

/** 归一化曲面半径，让所有拓扑在固定相机下视角大小一致。 */
const TARGET_RADIUS = 1.7;

function buildGrid(topologyId: TopologyId, n: number): GridData {
  const raw: Vec3[] = new Array(n * n);
  let maxR = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = surfacePoint(topologyId, x / (n - 1), y / (n - 1));
      raw[vid(x, y, n)] = p;
      const r = Math.hypot(p.x, p.y, p.z);
      if (r > maxR) maxR = r;
    }
  }
  const k = maxR > 0 ? TARGET_RADIUS / maxR : 1;
  const pts = raw.map((p) => ({ x: p.x * k, y: p.y * k, z: p.z * k }));
  // 棋子半径按「每个格点的局部格距」计算：两个参数方向格距的几何平均 × 0.44。
  // 曲面棋格可能高度拉伸（莫比乌斯带沿带方向格距远大于跨带方向），
  // 几何平均在「棋子不溢出窄格」与「清晰可读」之间取得平衡，
  // 使棋子直径 ≈ 0.88 倍当地等效格距，视觉上与 2D 棋盘比例一致。
  const stoneR = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = pts[vid(x, y, n)];
      let du = 0;
      let cu = 0;
      let dv = 0;
      let cv = 0;
      const acc = (xx: number, yy: number, isU: boolean) => {
        if (xx < 0 || xx >= n || yy < 0 || yy >= n) return;
        const q = pts[vid(xx, yy, n)];
        const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        if (isU) {
          du += d;
          cu++;
        } else {
          dv += d;
          cv++;
        }
      };
      acc(x + 1, y, true);
      acc(x - 1, y, true);
      acc(x, y + 1, false);
      acc(x, y - 1, false);
      du = cu > 0 ? du / cu : 0;
      dv = cv > 0 ? dv / cv : 0;
      const eff = du > 0 && dv > 0 ? Math.sqrt(du * dv) : Math.max(du, dv, 0.1);
      stoneR[vid(x, y, n)] = eff * 0.44;
    }
  }
  // 切向量与法向量（中心差分；用于把棋子画成贴合曲面的立体双凸子）
  const tan1: Vec3[] = new Array(n * n);
  const tan2: Vec3[] = new Array(n * n);
  const norm: Vec3[] = new Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = vid(x, y, n);
      const xm = pts[vid(Math.max(x - 1, 0), y, n)];
      const xp = pts[vid(Math.min(x + 1, n - 1), y, n)];
      const ym = pts[vid(x, Math.max(y - 1, 0), n)];
      const yp = pts[vid(x, Math.min(y + 1, n - 1), n)];
      const tx = { x: xp.x - xm.x, y: xp.y - xm.y, z: xp.z - xm.z };
      const ty = { x: yp.x - ym.x, y: yp.y - ym.y, z: yp.z - ym.z };
      const l1 = Math.hypot(tx.x, tx.y, tx.z) || 1;
      const l2 = Math.hypot(ty.x, ty.y, ty.z) || 1;
      tan1[i] = { x: tx.x / l1, y: tx.y / l1, z: tx.z / l1 };
      tan2[i] = { x: ty.x / l2, y: ty.y / l2, z: ty.z / l2 };
      // 法线 = tx × ty
      const cx = tx.y * ty.z - tx.z * ty.y;
      const cy = tx.z * ty.x - tx.x * ty.z;
      const cz = tx.x * ty.y - tx.y * ty.x;
      const lc = Math.hypot(cx, cy, cz);
      norm[i] = lc > 1e-9 ? { x: cx / lc, y: cy / lc, z: cz / lc } : { x: 0, y: 1, z: 0 };
    }
  }
  return { pts, stoneR, tan1, tan2, norm };
}

const AUTO_ROTATE_DELAY_MS = 3000;
const AUTO_ROTATE_SPEED = 0.15; // rad/s
const PITCH_LIMIT = 1.45;

export function Board3D(props: Board3DProps) {
  const { topologyId, n } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const viewRef = useRef({ yaw: 0.7, pitch: 0.45, fovScale: 0.9, lastInteract: 0, dragging: false, width: 300, height: 300 });

  const grid = useMemo(() => buildGrid(topologyId, n), [topologyId, n]);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  // 尺寸自适应（devicePixelRatio + ResizeObserver）
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(container.clientWidth, 50);
      const h = Math.max(container.clientHeight, 50);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewRef.current.width = w;
      viewRef.current.height = h;
    };
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // 渲染循环（常驻；交互与自转都只改 viewRef）
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let lastTs = performance.now();

    const draw = (ts: number) => {
      const view = viewRef.current;
      const dt = Math.min((ts - lastTs) / 1000, 0.1);
      lastTs = ts;
      if (!view.dragging && ts - view.lastInteract > AUTO_ROTATE_DELAY_MS) {
        view.yaw += dt * AUTO_ROTATE_SPEED;
      }

      const { width: w, height: h } = view;
      const { board, lastMove, dead, highlightVertex } = propsRef.current;
      const { pts, stoneR, tan1, tan2, norm } = gridRef.current;
      const count = pts.length;
      const fov = Math.min(w, h) * view.fovScale;

      ctx.clearRect(0, 0, w, h);

      // 旋转 + 投影全部格点
      const px = new Float64Array(count);
      const py = new Float64Array(count);
      const pz = new Float64Array(count); // 点到相机的距离（越大越远）
      for (let i = 0; i < count; i++) {
        const r = rotate(pts[i], view.yaw, view.pitch);
        const p = project(r, w, h, fov);
        px[i] = p.x;
        py[i] = p.y;
        pz[i] = Math.max(CAMERA_DIST - r.z, 0.05);
      }

      const nSide = propsRef.current.n;
      // 网格四边形：按平均相机距离从远到近
      const quads: { d: number; i: number }[] = [];
      for (let y = 0; y < nSide - 1; y++) {
        for (let x = 0; x < nSide - 1; x++) {
          const i00 = vid(x, y, nSide);
          const i10 = i00 + 1;
          const i01 = i00 + nSide;
          const i11 = i01 + 1;
          quads.push({ d: (pz[i00] + pz[i10] + pz[i01] + pz[i11]) / 4, i: i00 });
        }
      }
      quads.sort((a, b) => b.d - a.d); // 距离越大越远 -> 远的先画（画家算法）
      ctx.lineWidth = 1.3;
      for (const q of quads) {
        const i00 = q.i;
        const i10 = i00 + 1;
        const i01 = i00 + nSide;
        const i11 = i01 + 1;
        ctx.beginPath();
        ctx.moveTo(px[i00], py[i00]);
        ctx.lineTo(px[i10], py[i10]);
        ctx.lineTo(px[i11], py[i11]);
        ctx.lineTo(px[i01], py[i01]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(222,176,92,0.55)'; // 半透明木色，背面结构可见
        ctx.fill();
        ctx.strokeStyle = 'rgba(70,50,28,0.85)'; // 加深的棋盘格线，读得出平面网格映射
        ctx.stroke();
      }

      // 棋子：按深度排序，远的先画
      const lastVertex = lastMove?.vertex ?? null;
      const deadSet = dead && dead.length > 0 ? new Set(dead) : null;
      const highlight =
        highlightVertex !== null && highlightVertex !== undefined && board[highlightVertex] !== EMPTY
          ? highlightVertex
          : null;
      const stones: number[] = [];
      for (let i = 0; i < count; i++) {
        if (board[i] !== EMPTY) stones.push(i);
      }
      stones.sort((a, b) => pz[b] - pz[a]);
      const SEG = 18;
      for (const i of stones) {
        const cell = board[i];
        const sr = stoneR[i];
        const sc = fov / pz[i];
        // 法线翻转朝向相机（背面棋子也展示受光盖面，保证可读性）
        let nv = norm[i];
        if (rotate(nv, view.yaw, view.pitch).z < 0) nv = { x: -nv.x, y: -nv.y, z: -nv.z };
        const c3 = pts[i];
        const thick = sr * 0.55; // 双凸子厚度
        const top3 = { x: c3.x + nv.x * thick, y: c3.y + nv.y * thick, z: c3.z + nv.z * thick };
        const pc = project(rotate(c3, view.yaw, view.pitch), w, h, fov);
        const pt = project(rotate(top3, view.yaw, view.pitch), w, h, fov);
        // 切平面半径向量 -> 屏幕空间（透视缩放在棋子尺度上近似线性）
        const r1 = rotate(tan1[i], view.yaw, view.pitch);
        const r2 = rotate(tan2[i], view.yaw, view.pitch);
        const v1x = r1.x * sr * sc;
        const v1y = -r1.y * sr * sc;
        const v2x = r2.x * sr * sc;
        const v2y = -r2.y * sr * sc;
        const r = Math.max((Math.hypot(v1x, v1y) + Math.hypot(v2x, v2y)) / 2, 0.8);

        // 棋身（赤道侧面，深色底）
        ctx.beginPath();
        for (let s = 0; s <= SEG; s++) {
          const a = (s / SEG) * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const sx = pc.x + v1x * ca + v2x * sa;
          const sy = pc.y + v1y * ca + v2y * sa;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = cell === 1 ? '#141414' : '#d9d9d9';
        ctx.fill();

        // 棋盖（沿法线抬升的受光面，左上→右下线性渐变模拟光照）
        const g = ctx.createLinearGradient(pt.x - r, pt.y - r, pt.x + r, pt.y + r);
        if (cell === 1) {
          g.addColorStop(0, '#7d7d7d');
          g.addColorStop(1, '#101010');
        } else {
          g.addColorStop(0, '#ffffff');
          g.addColorStop(1, '#c4c4c4');
        }
        ctx.beginPath();
        for (let s = 0; s <= SEG; s++) {
          const a = (s / SEG) * Math.PI * 2;
          const ca = Math.cos(a) * 0.94;
          const sa = Math.sin(a) * 0.94;
          const sx = pt.x + v1x * ca + v2x * sa;
          const sy = pt.y + v1y * ca + v2y * sa;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(r * 0.06, 0.7);
        ctx.strokeStyle = cell === 1 ? '#000' : '#888';
        ctx.stroke();

        // 高光点（立体感来源）
        ctx.beginPath();
        ctx.ellipse(pt.x - r * 0.28, pt.y - r * 0.32, r * 0.26, r * 0.16, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = cell === 1 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.75)';
        ctx.fill();

        // 覆盖标记（发光/标死/最后一手）以棋盖中心为基准
        const cx = pt.x;
        const cy = pt.y;
        if (i === highlight) {
          // 2D 悬停联动：金色光晕让对应棋子「发亮」
          ctx.save();
          ctx.shadowColor = '#ffd54a';
          ctx.shadowBlur = r * 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(r * 0.2, 2);
          ctx.strokeStyle = '#ffe082';
          ctx.stroke();
          ctx.restore();
        }
        if (deadSet?.has(i)) {
          const k = r * 0.55;
          ctx.beginPath();
          ctx.moveTo(cx - k, cy - k);
          ctx.lineTo(cx + k, cy + k);
          ctx.moveTo(cx - k, cy + k);
          ctx.lineTo(cx + k, cy - k);
          ctx.lineWidth = Math.max(r * 0.16, 1.5);
          ctx.strokeStyle = '#c62828';
          ctx.stroke();
        }
        if (i === lastVertex) {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(r * 0.14, 1.5);
          ctx.strokeStyle = '#c62828';
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 滚轮缩放（调整视角大小）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = viewRef.current;
      const k = e.deltaY > 0 ? 0.92 : 1.087;
      view.fovScale = Math.min(1.8, Math.max(0.45, view.fovScale * k));
      view.lastInteract = performance.now();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // 拖拽旋转
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      viewRef.current.dragging = true;
      viewRef.current.lastInteract = performance.now();
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const view = viewRef.current;
      if (!view.dragging) return;
      view.yaw += (e.clientX - lastX) * 0.006;
      view.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, view.pitch + (e.clientY - lastY) * 0.006));
      view.lastInteract = performance.now();
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      viewRef.current.dragging = false;
      viewRef.current.lastInteract = performance.now();
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const info = SURFACE_INFO[topologyId];
  return (
    <div className="board3d" ref={containerRef}>
      <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none', cursor: 'grab' }} aria-label="3D 曲面视图" />
      <div className="board3d-info">
        <strong>{info.name}</strong>
        <span>{info.desc}</span>
      </div>
    </div>
  );
}
