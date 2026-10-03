/**
 * 2D 展开视图（提案 §6.1/§6.2）。
 * - 361 个主落点一一对应 canonical vertexId；幽灵副本映射到同一 vertexId；
 * - 接缝箭头解释粘合方向（同轴同色；翻转接缝两侧箭头反向）；
 * - 悬停显示跨缝邻点高亮与棋串气；势力图以启发式叠加层呈现。
 */
import { useMemo, useState } from 'react';
import type { GameState } from '../core/rules';
import { getTopologySpec } from '../core/topology';
import { getGroup, getLiberties } from '../core/groups';
import { EMPTY, xy, type TopologyId } from '../core/types';
import type { InfluenceResult } from '../analysis/types';

const S = 30; // 格子边长(px)
const M = 34; // 棋盘外边距
const G = 2; // 幽灵带宽度(格)

export interface BoardProps {
  state: GameState;
  showSeams: boolean;
  showGhosts: boolean;
  showLiberties: boolean;
  influence: InfluenceResult | null;
  showInfluence: boolean;
  onIntersection: (v: number) => void;
}

function starPoints(n: number): [number, number][] {
  if (n === 19) {
    const p = [3, 9, 15];
    return p.flatMap((x) => p.map((y) => [x, y] as [number, number]));
  }
  if (n === 13) {
    const p = [3, 6, 9];
    return p.flatMap((x) => p.map((y) => [x, y] as [number, number]));
  }
  if (n === 9) {
    const p = [2, 4, 6];
    return p.flatMap((x) => p.map((y) => [x, y] as [number, number]));
  }
  return [];
}

/** 幽灵格 (gx,gy) -> canonical vertexId；越界两轴时返回 null（不画角落）。 */
function ghostVertex(gx: number, gy: number, topology: TopologyId, n: number): number | null {
  let x = gx;
  let y = gy;
  if (x >= 0 && x < n && y >= 0 && y < n) return y * n + x;
  const flipX = topology === 'mobius' || topology === 'klein' || topology === 'projective';
  const wrapX = topology !== 'plane';
  const wrapY = topology === 'torus' || topology === 'klein' || topology === 'projective';
  const flipY = topology === 'projective';
  if (!wrapX && (x < 0 || x >= n)) return null;
  if (!wrapY && (y < 0 || y >= n)) return null;
  if ((x < 0 || x >= n) && (y < 0 || y >= n)) {
    if (topology !== 'torus') return null; // 翻转曲面角落幽灵映射歧义，不画
  }
  // 先归一 y（仅当 x 在界内或 y 轴周期），再归一 x；torus 两轴直接取模
  if (topology === 'torus') {
    x = ((x % n) + n) % n;
    y = ((y % n) + n) % n;
    return y * n + x;
  }
  // x 越界（y 在界内）：翻转行号
  if (x < 0) {
    const my = flipX ? n - 1 - y : y;
    x = n + x; // -1 -> n-1, -2 -> n-2
    y = my;
  } else if (x >= n) {
    const my = flipX ? n - 1 - y : y;
    x = x - n;
    y = my;
  }
  // y 越界（此时 x 已归一）：翻转列号
  if (y < 0) {
    const mx = flipY ? n - 1 - x : x;
    y = n + y;
    x = mx;
  } else if (y >= n) {
    const mx = flipY ? n - 1 - x : x;
    y = y - n;
    x = mx;
  }
  return y * n + x;
}

function px(x: number): number {
  return M + x * S;
}
function py(y: number): number {
  return M + y * S;
}

export function Board2D(props: BoardProps) {
  const { state, onIntersection } = props;
  const n = state.n;
  const spec = getTopologySpec(state.topologyId, n);
  const [hover, setHover] = useState<number | null>(null);

  const wrapX = state.topologyId !== 'plane';
  const wrapY = state.topologyId === 'torus' || state.topologyId === 'klein' || state.topologyId === 'projective';

  const x0 = props.showGhosts && wrapX ? -G : 0;
  const x1 = props.showGhosts && wrapX ? n - 1 + G : n - 1;
  const y0 = props.showGhosts && wrapY ? -G : 0;
  const y1 = props.showGhosts && wrapY ? n - 1 + G : n - 1;
  const width = M * 2 + (x1 - x0) * S;
  const height = M * 2 + (y1 - y0) * S;
  const ox = -x0 * S; // 幽灵带导致的原点偏移
  const oy = -y0 * S;
  const gx = (x: number) => ox + px(x);
  const gy = (y: number) => oy + py(y);

  const deadSet = useMemo(
    () => new Set(state.scoring?.dead ?? []),
    [state.scoring],
  );

  // 悬停棋串的气（含跨缝，天然去重）
  const hoverLiberties = useMemo(() => {
    if (hover === null || !props.showLiberties) return null;
    if (state.board[hover] === EMPTY) return null;
    const g = getGroup(state.board, spec.adjacency, hover);
    return getLiberties(state.board, spec.adjacency, g);
  }, [hover, props.showLiberties, state.board, spec.adjacency]);

  // 悬停点的跨缝邻点（网格距离 > 1 者）
  const seamNeighbors = useMemo(() => {
    if (hover === null || !props.showSeams) return [];
    const h = xy(hover, n);
    return spec.adjacency[hover].filter((u) => {
      const c = xy(u, n);
      return Math.abs(c.x - h.x) > 1 || Math.abs(c.y - h.y) > 1;
    });
  }, [hover, props.showSeams, spec.adjacency, n]);

  const letters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
  const last = state.lastMove?.vertex ?? null;
  const canInteract =
    (state.phase === 'playing' || state.phase === 'scoring') && state.historyCursor === state.moves.length;

  const cells: React.ReactNode[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const v = ghostVertex(x, y, state.topologyId, n);
      if (v === null) continue;
      const isGhost = x < 0 || x >= n || y < 0 || y >= n;
      const cell = state.board[v];
      const cx = gx(x);
      const cy = gy(y);
      const key = `${x},${y}`;
      const influenceRect =
        props.showInfluence && props.influence && cell === EMPTY && !isGhost ? (
          <rect
            x={cx - S * 0.32}
            y={cy - S * 0.32}
            width={S * 0.64}
            height={S * 0.64}
            rx={3}
            fill={
              props.influence.values[v] >= 0
                ? `rgba(198,40,40,${(props.influence.values[v] * 0.55).toFixed(3)})`
                : `rgba(30,136,229,${(-props.influence.values[v] * 0.55).toFixed(3)})`
            }
            pointerEvents="none"
          />
        ) : null;
      cells.push(
        <g key={key} opacity={isGhost ? 0.35 : 1}>
          {influenceRect}
          {cell !== EMPTY && (
            <circle
              cx={cx}
              cy={cy}
              r={S * 0.44}
              fill={cell === 1 ? '#222' : '#fdfdfd'}
              stroke={cell === 1 ? '#000' : '#666'}
              strokeWidth={1}
            />
          )}
          {cell !== EMPTY && deadSet.has(v) && (
            <>
              <circle cx={cx} cy={cy} r={S * 0.44} fill="rgba(198,40,40,0.35)" pointerEvents="none" />
              <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} stroke="#c62828" strokeWidth={2} pointerEvents="none" />
              <line x1={cx - 7} y1={cy + 7} x2={cx + 7} y2={cy - 7} stroke="#c62828" strokeWidth={2} pointerEvents="none" />
            </>
          )}
          {cell === EMPTY && hover === v && canInteract && state.phase === 'playing' && !isGhost && (
            <circle
              cx={cx}
              cy={cy}
              r={S * 0.4}
              fill={state.toPlay === 'black' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.6)'}
              pointerEvents="none"
            />
          )}
          {v === last && cell !== EMPTY && (
            <circle cx={cx} cy={cy} r={4} fill={cell === 1 ? '#eee' : '#333'} pointerEvents="none" />
          )}
          {hoverLiberties?.has(v) && (
            <circle cx={cx} cy={cy} r={5} fill="none" stroke="#2e7d32" strokeWidth={2} pointerEvents="none" />
          )}
          {seamNeighbors.includes(v) && (
            <circle cx={cx} cy={cy} r={S * 0.47} fill="none" stroke="#fb8c00" strokeWidth={2.5} pointerEvents="none" />
          )}
          {canInteract && (
            <rect
              x={cx - S / 2}
              y={cy - S / 2}
              width={S}
              height={S}
              fill="transparent"
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover((h) => (h === v ? null : h))}
              onClick={() => onIntersection(v)}
              style={{ cursor: 'pointer' }}
            />
          )}
        </g>,
      );
    }
  }

  // 网格线
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    gridLines.push(
      <line key={`h${i}`} x1={gx(0)} y1={gy(i)} x2={gx(n - 1)} y2={gy(i)} stroke="var(--grid)" strokeWidth={i === 0 || i === n - 1 ? 2 : 1} />,
      <line key={`v${i}`} x1={gx(i)} y1={gy(0)} x2={gx(i)} y2={gy(n - 1)} stroke="var(--grid)" strokeWidth={i === 0 || i === n - 1 ? 2 : 1} />,
    );
  }

  // 接缝箭头：同轴同色；翻转接缝两侧箭头反向
  const seamMarks: React.ReactNode[] = [];
  if (props.showSeams) {
    const flipX = state.topologyId === 'mobius' || state.topologyId === 'klein' || state.topologyId === 'projective';
    const flipY = state.topologyId === 'projective';
    const arrow = (x: number, y: number, dir: 1 | -1, vertical: boolean, color: string, k: string) => (
      <path
        key={k}
        d={vertical ? `M ${x - 5} ${y - 4 * dir} L ${x + 5} ${y - 4 * dir} L ${x} ${y + 6 * dir} Z` : `M ${x - 4 * dir} ${y - 5} L ${x - 4 * dir} ${y + 5} L ${x + 6 * dir} ${y} Z`}
        fill={color}
        opacity={0.85}
        pointerEvents="none"
      />
    );
    if (wrapX) {
      const ys = [0, Math.floor(n / 2), n - 1];
      for (const y of ys) {
        seamMarks.push(arrow(gx(0) - S * 0.72, gy(y), 1, false, 'var(--seam-x)', `xl${y}`));
        seamMarks.push(arrow(gx(n - 1) + S * 0.72, gy(flipX ? n - 1 - y : y), -1, false, 'var(--seam-x)', `xr${y}`));
      }
    }
    if (wrapY) {
      const xs = [0, Math.floor(n / 2), n - 1];
      for (const x of xs) {
        seamMarks.push(arrow(gx(x), gy(0) - S * 0.72, 1, true, 'var(--seam-y)', `yt${x}`));
        seamMarks.push(arrow(gx(flipY ? n - 1 - x : x), gy(n - 1) + S * 0.72, -1, true, 'var(--seam-y)', `yb${x}`));
      }
    }
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }} role="img" aria-label="棋盘">
      <rect x={0} y={0} width={width} height={height} fill="var(--board-bg)" rx={6} />
      {/* 主棋盘区域底色略深，区分幽灵带 */}
      {(x0 < 0 || y0 < 0) && (
        <rect x={gx(0) - S / 2} y={gy(0) - S / 2} width={(n - 1) * S + S} height={(n - 1) * S + S} fill="rgba(255,255,255,0.18)" pointerEvents="none" />
      )}
      {gridLines}
      {starPoints(n).map(([x, y]) => (
        <circle key={`s${x},${y}`} cx={gx(x)} cy={gy(y)} r={3.5} fill="var(--grid)" pointerEvents="none" />
      ))}
      {/* 坐标 */}
      {Array.from({ length: n }, (_, i) => (
        <g key={`c${i}`} fontSize={11} fill="#4a3b2e" textAnchor="middle" pointerEvents="none">
          <text x={gx(i)} y={gy(0) - S * 0.62}>{letters[i]}</text>
          <text x={gx(0) - S * 0.66} y={gy(i) + 4}>{n - i}</text>
        </g>
      ))}
      {cells}
      {seamMarks}
    </svg>
  );
}
