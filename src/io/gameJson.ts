/**
 * 权威棋谱 JSON（提案 §8）：带 schemaVersion，包含拓扑版本、规则、
 * komi、完整行动序列、historyCursor、终局协商与结果。
 * 导入时由内核重放落子/停着，重建 PSK；不信任文件自称的结果。
 */
import { createGame } from '../core/state';
import {
  confirmScore,
  pass,
  resign,
  toggleDeadGroup,
  tryPlay,
  undo,
  type GameState,
  type Move,
  type ScoringState,
} from '../core/rules';
import { ALL_TOPOLOGIES, RULESET_ID, TOPOLOGY_VERSION, type Color, type TopologyId } from '../core/types';

export const GAME_SCHEMA_VERSION = 1;
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_MOVES = 10000;

interface GameFile {
  schemaVersion: number;
  topologyId: TopologyId;
  topologyVersion: string;
  n: number;
  ruleset: string;
  komi: number;
  moves: Move[];
  historyCursor: number;
  phase: GameState['phase'];
  scoring: ScoringState | null;
  result: GameState['result'];
}

export function exportGame(state: GameState): string {
  const file: GameFile = {
    schemaVersion: GAME_SCHEMA_VERSION,
    topologyId: state.topologyId,
    topologyVersion: state.topologyVersion,
    n: state.n,
    ruleset: state.ruleset,
    komi: state.komi,
    moves: state.moves,
    historyCursor: state.historyCursor,
    phase: state.phase,
    scoring: state.scoring,
    result: state.result,
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function isColor(x: unknown): x is Color {
  return x === 'black' || x === 'white';
}

/** 校验 + 内核重放重建。任何非法着法、未知版本或不一致元数据都会被拒绝。 */
export function importGame(jsonText: string): ImportResult {
  if (jsonText.length > MAX_FILE_BYTES) return { ok: false, error: '文件超过大小限制' };
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: '不是合法的 JSON 文件' };
  }
  const f = raw as Partial<GameFile>;
  if (f.schemaVersion !== GAME_SCHEMA_VERSION) return { ok: false, error: `不支持的 schemaVersion: ${String(f.schemaVersion)}` };
  if (!ALL_TOPOLOGIES.includes(f.topologyId as TopologyId)) return { ok: false, error: `未知拓扑: ${String(f.topologyId)}` };
  if (f.topologyVersion !== TOPOLOGY_VERSION) return { ok: false, error: `不支持的拓扑版本: ${String(f.topologyVersion)}` };
  if (f.ruleset !== RULESET_ID) return { ok: false, error: `不支持的规则: ${String(f.ruleset)}` };
  const n = f.n;
  if (!Number.isInteger(n) || n! < 3 || n! > 25) return { ok: false, error: `非法棋盘规模: ${String(n)}` };
  if (typeof f.komi !== 'number' || !Number.isFinite(f.komi) || Math.abs(f.komi) > 200) {
    return { ok: false, error: '非法贴目' };
  }
  if (!Array.isArray(f.moves) || f.moves.length > MAX_MOVES) return { ok: false, error: '行动序列非法或过长' };

  // 重放行动序列（内核逐步校验合法性，PSK 自然重建）
  let state = createGame({ topologyId: f.topologyId as TopologyId, n: n!, komi: f.komi });
  const n2 = n! * n!;
  for (let i = 0; i < f.moves.length; i++) {
    const m = f.moves[i] as Partial<Move>;
    if (!isColor(m.color)) return { ok: false, error: `第 ${i + 1} 手颜色非法` };
    if (m.type === 'play') {
      if (!Number.isInteger(m.vertex) || (m.vertex as number) < 0 || (m.vertex as number) >= n2) {
        return { ok: false, error: `第 ${i + 1} 手落点越界` };
      }
      const r = tryPlay(state, m.vertex as number);
      if (!r.ok) return { ok: false, error: `第 ${i + 1} 手非法: ${r.error.message}` };
      state = r.state;
    } else if (m.type === 'pass') {
      const r = pass(state);
      if (!r.ok) return { ok: false, error: `第 ${i + 1} 手停着非法: ${r.error.message}` };
      state = r.state;
    } else if (m.type === 'resign') {
      const r = resign(state, m.color);
      if (!r.ok) return { ok: false, error: `第 ${i + 1} 手认输非法` };
      state = r.state;
      if (i !== f.moves.length - 1) return { ok: false, error: '认输后仍存在后续着手' };
    } else {
      return { ok: false, error: `第 ${i + 1} 手类型未知` };
    }
  }

  // historyCursor：跳到复盘位置（重放已到序列末尾，向前回退即可）
  const cursor = f.historyCursor;
  if (!Number.isInteger(cursor) || cursor! < 0 || cursor! > f.moves.length) {
    return { ok: false, error: 'historyCursor 越界' };
  }
  while (state.historyCursor > cursor!) {
    if (state.phase !== 'playing') break;
    const r = undo(state);
    if (!r.ok) break;
    state = r.state;
  }
  if (state.historyCursor !== cursor && state.phase === 'playing') {
    return { ok: false, error: '无法恢复到指定的 historyCursor' };
  }

  // 终局协商元数据：按规则路径重建（双停着由重放自然进入 scoring）
  if (f.phase === 'scoring' || (f.phase === 'finished' && f.result?.type === 'score')) {
    if (state.phase !== 'scoring') {
      return { ok: false, error: '协商/结算元数据与重放阶段不一致' };
    }
    const sc = f.scoring;
    if (!sc || !Array.isArray(sc.dead)) return { ok: false, error: '协商数据缺失' };
    for (const v of sc.dead) {
      if (!Number.isInteger(v) || v < 0 || v >= n2) return { ok: false, error: '死子标记越界' };
    }
    // 重放标死（通过 toggle 路径保证 revision/confirmations 语义一致）
    const want = new Set(sc.dead);
    const current = new Set(state.scoring!.dead);
    for (const v of new Set([...want, ...current])) {
      if (want.has(v) !== current.has(v)) {
        if (state.scoring!.snapshotBoard[v] === 0) {
          return { ok: false, error: '死子标记位于空点' };
        }
        const r = toggleDeadGroup(state, v);
        if (!r.ok) return { ok: false, error: '死子标记无法应用' };
        state = r.state;
      }
    }
    if (f.phase === 'finished') {
      const c = sc.confirmations;
      if (!c || c.black !== sc.revision || c.white !== sc.revision) {
        return { ok: false, error: '已结算对局的确认记录不一致' };
      }
      let r = confirmScore(state, 'black');
      if (!r.ok) return { ok: false, error: '确认结算失败' };
      state = r.state;
      r = confirmScore(state, 'white');
      if (!r.ok) return { ok: false, error: '确认结算失败' };
      state = r.state;
      // 结果由内核独立算出；与文件自称不一致则拒绝
      const claimed = f.result;
      if (!claimed || claimed.winner !== state.result?.winner || claimed.margin !== state.result?.margin) {
        return { ok: false, error: '文件自称的胜负与内核重算不一致' };
      }
    }
  } else if (f.phase === 'finished' && f.result?.type === 'resign') {
    if (state.phase !== 'finished') return { ok: false, error: '认输结局与重放阶段不一致' };
  } else if (f.phase !== 'playing') {
    return { ok: false, error: `非法阶段: ${String(f.phase)}` };
  }

  return { ok: true, state };
}
