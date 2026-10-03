/**
 * 规则内核：TopoGo Area v1（提案 §3）。
 *
 * - 黑先白后；每步落在空顶点；先提无气对方棋串，再查己串气；
 * - 禁止自杀；positional superko（PSK）对完整棋子分布生效，停着豁免；
 * - 两次连续停着进入终局协商；协商不修改真实行棋历史；
 * - 非法操作不改变任何状态，也不重置连续停着计数；
 * - 失败用带 errorCode 的判别联合返回，不用异常表达正常非法落子。
 */
import { getTopologySpec } from './topology';
import { getGroup, getLiberties } from './groups';
import { boardKey } from './history';
import { scorePosition, type GameResultWin } from './scoring';
import {
  EMPTY,
  RULESET_ID,
  TOPOLOGY_VERSION,
  opponent,
  stoneOf,
  type Cell,
  type Color,
  type TopologyId,
} from './types';

export type Phase = 'setup' | 'playing' | 'scoring' | 'finished';

export interface PlayMove {
  type: 'play';
  color: Color;
  vertex: number;
  captured: number[];
}
export interface PassMove {
  type: 'pass';
  color: Color;
}
export interface ResignMove {
  type: 'resign';
  color: Color;
}
export type Move = PlayMove | PassMove | ResignMove;

export interface ScoringState {
  /** 进入 scoring 时的真实棋盘快照（协商不改它） */
  snapshotBoard: Cell[];
  /** 第一次停着的玩家（恢复对弈时由其行棋） */
  nextToPlay: Color;
  /** proposedDead 预览标记 */
  dead: number[];
  revision: number;
  /** 各方已确认的 revision；标记变化后清零 */
  confirmations: { black: number | null; white: number | null };
}

export interface GameState {
  topologyId: TopologyId;
  topologyVersion: string;
  n: number;
  ruleset: string;
  komi: number;
  board: Cell[];
  toPlay: Color;
  phase: Phase;
  /** 完整行动序列（含被悔棋的 redo 尾部） */
  moves: Move[];
  /** 已应用手数；moves[0..historyCursor) 为有效历史 */
  historyCursor: number;
  /** positionKeys[i] = 第 i 手之后的局面键；[0] 为初始空盘 */
  positionKeys: string[];
  /** 各方提掉的对方石子数（过程展示用，不参与计分） */
  captures: { black: number; white: number };
  consecutivePasses: number;
  lastMove: { color: Color; vertex: number | null } | null;
  scoring: ScoringState | null;
  result: GameResultWin | null;
  stateRevision: number;
}

export type ErrorCode =
  | 'wrong-phase'
  | 'out-of-range'
  | 'occupied'
  | 'suicide'
  | 'superko'
  | 'no-undo'
  | 'no-redo'
  | 'empty-vertex';

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: { code: ErrorCode; message: string } };

function err(code: ErrorCode, message: string): ActionResult {
  return { ok: false, error: { code, message } };
}

function adjOf(state: GameState): number[][] {
  return getTopologySpec(state.topologyId, state.n).adjacency;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    board: state.board.slice(),
    moves: state.moves.slice(),
    positionKeys: state.positionKeys.slice(),
    captures: { ...state.captures },
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    scoring: state.scoring
      ? {
          ...state.scoring,
          snapshotBoard: state.scoring.snapshotBoard.slice(),
          dead: state.scoring.dead.slice(),
          confirmations: { ...state.scoring.confirmations },
        }
      : null,
    result: state.result ? { ...state.result } : null,
  };
}

/** 从空盘重放 moves[0..cursor)，重建 board/captures/lastMove/consecutivePasses/toPlay。 */
function rebuildDerived(state: GameState): void {
  const board: Cell[] = new Array(state.n * state.n).fill(EMPTY);
  const captures = { black: 0, white: 0 };
  let lastMove: GameState['lastMove'] = null;
  let consecutivePasses = 0;
  for (let i = 0; i < state.historyCursor; i++) {
    const m = state.moves[i];
    if (m.type === 'play') {
      board[m.vertex] = stoneOf(m.color);
      for (const c of m.captured) board[c] = EMPTY;
      captures[m.color] += m.captured.length;
      lastMove = { color: m.color, vertex: m.vertex };
      consecutivePasses = 0;
    } else if (m.type === 'pass') {
      lastMove = { color: m.color, vertex: null };
      consecutivePasses++;
    } else {
      lastMove = { color: m.color, vertex: null };
      consecutivePasses = 0;
    }
  }
  state.board = board;
  state.captures = captures;
  state.lastMove = lastMove;
  state.consecutivePasses = consecutivePasses;
  const last = state.moves[state.historyCursor - 1];
  state.toPlay = last ? opponent(last.color) : 'black';
  // 注意：不截断 positionKeys——redo 仍需尾部键；废弃尾部由 truncateTail 处理。
}

/** 截断 redo 尾部（从历史节点继续时显式丢弃）。 */
function truncateTail(state: GameState): void {
  state.moves = state.moves.slice(0, state.historyCursor);
  state.positionKeys = state.positionKeys.slice(0, state.historyCursor + 1);
}

/** 落子。事务顺序见提案 §3.3：任一检查失败则整步撤销。 */
export function tryPlay(state: GameState, vertex: number): ActionResult {
  if (state.phase !== 'playing') return err('wrong-phase', `当前阶段 ${state.phase} 不能落子`);
  const n2 = state.n * state.n;
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= n2) {
    return err('out-of-range', `落点 ${vertex} 超出棋盘范围`);
  }
  if (state.board[vertex] !== EMPTY) return err('occupied', '该点已有棋子');

  const adj = adjOf(state);
  const color = state.toPlay;
  const me = stoneOf(color);
  const opp = stoneOf(opponent(color));
  const board = state.board.slice();

  // 试下
  board[vertex] = me;

  // 收集相邻的不同对方棋串，提掉零气串
  const oppSeen = new Set<number>();
  const captured: number[] = [];
  for (const u of adj[vertex]) {
    if (board[u] !== opp || oppSeen.has(u)) continue;
    const g = getGroup(board, adj, u);
    for (const s of g) oppSeen.add(s);
    if (getLiberties(board, adj, g).size === 0) {
      for (const s of g) {
        board[s] = EMPTY;
        captured.push(s);
      }
    }
  }

  // 查己串气（先提子后查自杀）
  const ownGroup = getGroup(board, adj, vertex);
  if (getLiberties(board, adj, ownGroup).size === 0) {
    return err('suicide', '禁止自杀：落子后己方棋串无气');
  }

  // PSK：与当前有效历史（含初始空盘）比较
  const key = boardKey(board, state.topologyVersion, state.n);
  const validKeys = state.positionKeys.slice(0, state.historyCursor + 1);
  if (validKeys.includes(key)) {
    return err('superko', '违反 positional superko：该局面此前已出现');
  }

  // 提交
  const next = clone(state);
  truncateTail(next);
  next.board = board;
  next.moves.push({ type: 'play', color, vertex, captured: captured.sort((a, b) => a - b) });
  next.historyCursor++;
  next.positionKeys.push(key);
  next.captures[color] += captured.length;
  next.toPlay = opponent(color);
  next.consecutivePasses = 0;
  next.lastMove = { color, vertex };
  next.stateRevision++;
  return { ok: true, state: next };
}

/** 停着：永远合法（playing 阶段），不受 PSK 限制。 */
export function pass(state: GameState): ActionResult {
  if (state.phase !== 'playing') return err('wrong-phase', `当前阶段 ${state.phase} 不能停着`);
  const next = clone(state);
  truncateTail(next);
  const color = next.toPlay;
  next.moves.push({ type: 'pass', color });
  next.historyCursor++;
  // 停着产生重复局面键，按键数组原样记录（计数语义由 KeyCounter 保证）
  next.positionKeys.push(boardKey(next.board, next.topologyVersion, next.n));
  next.toPlay = opponent(color);
  next.consecutivePasses++;
  next.lastMove = { color, vertex: null };
  next.stateRevision++;

  if (next.consecutivePasses >= 2) {
    // 两次连续停着 -> 终局协商（不直接宣告胜负）
    next.phase = 'scoring';
    next.scoring = {
      snapshotBoard: next.board.slice(),
      nextToPlay: next.toPlay, // 即第一次停着的玩家
      dead: [],
      revision: 1,
      confirmations: { black: null, white: null },
    };
  }
  return { ok: true, state: next };
}

/** 认输（UI 层负责二次确认）。playing 与 scoring 阶段均可用。 */
export function resign(state: GameState, color: Color): ActionResult {
  if (state.phase !== 'playing' && state.phase !== 'scoring') {
    return err('wrong-phase', `当前阶段 ${state.phase} 不能认输`);
  }
  const next = clone(state);
  if (state.phase === 'playing') {
    truncateTail(next);
    next.moves.push({ type: 'resign', color });
    next.historyCursor++;
  }
  next.phase = 'finished';
  next.scoring = null;
  next.result = {
    type: 'resign',
    winner: opponent(color),
    margin: 0,
    breakdown: null,
  };
  next.stateRevision++;
  return { ok: true, state: next };
}

export function undo(state: GameState): ActionResult {
  if (state.phase !== 'playing') return err('wrong-phase', '仅对弈阶段可悔棋');
  if (state.historyCursor <= 0) return err('no-undo', '已在开局');
  const next = clone(state);
  next.historyCursor--;
  rebuildDerived(next);
  next.scoring = null;
  next.result = null;
  next.stateRevision++;
  return { ok: true, state: next };
}

export function redo(state: GameState): ActionResult {
  if (state.phase !== 'playing') return err('wrong-phase', '仅对弈阶段可前进复盘');
  if (state.historyCursor >= state.moves.length) return err('no-redo', '已在最新局面');
  const next = clone(state);
  next.historyCursor++;
  rebuildDerived(next);
  next.stateRevision++;
  return { ok: true, state: next };
}

/** 跳转到历史节点（复盘只读查看；从此处继续由下一次 tryPlay/pass 截断尾部实现）。 */
export function goTo(state: GameState, cursor: number): ActionResult {
  if (state.phase !== 'playing') return err('wrong-phase', '仅对弈阶段可复盘跳转');
  if (cursor < 0 || cursor > state.moves.length) return err('out-of-range', '历史游标越界');
  const next = clone(state);
  next.historyCursor = cursor;
  rebuildDerived(next);
  next.stateRevision++;
  return { ok: true, state: next };
}

/** 终局协商：切换点击处完整棋串的 proposedDead 标记（只改预览）。 */
export function toggleDeadGroup(state: GameState, vertex: number): ActionResult {
  if (state.phase !== 'scoring' || !state.scoring) return err('wrong-phase', '当前不在终局协商');
  const snap = state.scoring.snapshotBoard;
  if (!Number.isInteger(vertex) || vertex < 0 || vertex >= snap.length) {
    return err('out-of-range', `落点 ${vertex} 超出棋盘范围`);
  }
  if (snap[vertex] === EMPTY) return err('empty-vertex', '空点没有可标记的棋串');
  const adj = adjOf(state);
  const group = getGroup(snap, adj, vertex);
  const next = clone(state);
  const dead = new Set(next.scoring!.dead);
  const allDead = group.every((s) => dead.has(s));
  for (const s of group) {
    if (allDead) dead.delete(s);
    else dead.add(s);
  }
  next.scoring!.dead = [...dead].sort((a, b) => a - b);
  next.scoring!.revision++;
  next.scoring!.confirmations = { black: null, white: null }; // 标记变化清除双方确认
  next.stateRevision++;
  return { ok: true, state: next };
}

/** 一方确认当前 revision 的协商方案；双方确认同一版本后完成计分。 */
export function confirmScore(state: GameState, color: Color): ActionResult {
  if (state.phase !== 'scoring' || !state.scoring) return err('wrong-phase', '当前不在终局协商');
  const next = clone(state);
  const sc = next.scoring!;
  sc.confirmations[color] = sc.revision;
  next.stateRevision++;
  if (sc.confirmations.black === sc.revision && sc.confirmations.white === sc.revision) {
    const adj = adjOf(next);
    const breakdown = scorePosition(sc.snapshotBoard, adj, new Set(sc.dead), next.komi);
    next.phase = 'finished';
    next.result = {
      type: 'score',
      winner: breakdown.margin > 0 ? 'black' : breakdown.margin < 0 ? 'white' : null,
      margin: breakdown.margin,
      breakdown,
    };
  }
  return { ok: true, state: next };
}

/** 恢复对弈：清除标记与确认，恢复两次停着后的原棋盘与行棋方。 */
export function resumePlay(state: GameState): ActionResult {
  if (state.phase !== 'scoring' || !state.scoring) return err('wrong-phase', '当前不在终局协商');
  const next = clone(state);
  next.board = next.scoring!.snapshotBoard.slice();
  next.toPlay = next.scoring!.nextToPlay;
  next.consecutivePasses = 0;
  next.scoring = null;
  next.phase = 'playing';
  next.stateRevision++;
  return { ok: true, state: next };
}

export { RULESET_ID, TOPOLOGY_VERSION };
