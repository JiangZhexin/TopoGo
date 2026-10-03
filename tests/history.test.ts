/** 历史与终局协商交互测试（提案 §9.4）。 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import {
  confirmScore,
  goTo,
  pass,
  redo,
  resumePlay,
  toggleDeadGroup,
  tryPlay,
  undo,
  type GameState,
} from '../src/core/rules';
import { KeyCounter, boardKey } from '../src/core/history';
import { EMPTY } from '../src/core/types';
import { at } from './fixtures/builder';

function must(r: { ok: boolean; state?: GameState }): GameState {
  if (!r.ok || !r.state) throw new Error('expected ok');
  return r.state;
}

function playSequence(): GameState {
  let s = createGame({ topologyId: 'torus' });
  s = must(tryPlay(s, at(3, 3))); // B
  s = must(tryPlay(s, at(15, 15))); // W
  s = must(tryPlay(s, at(4, 3))); // B
  return s;
}

describe('终局协商流程', () => {
  it('双停着 -> 标死 -> 黑确认 -> 修改标死 -> 确认失效 -> 同 revision 双确认 -> finished', () => {
    let s = playSequence();
    s = must(pass(s)); // W pass（三手后轮到白）
    s = must(pass(s)); // B pass -> scoring
    expect(s.phase).toBe('scoring');
    expect(s.scoring!.nextToPlay).toBe('white'); // 第一次停着的玩家
    const rev0 = s.scoring!.revision;

    // 标死白棋 (15,15)
    s = must(toggleDeadGroup(s, at(15, 15)));
    expect(s.scoring!.dead).toEqual([at(15, 15)]);
    expect(s.scoring!.revision).toBe(rev0 + 1);

    // 黑确认当前版本
    s = must(confirmScore(s, 'black'));
    expect(s.scoring!.confirmations.black).toBe(s.scoring!.revision);
    expect(s.phase).toBe('scoring'); // 只有一方确认不结算

    // 白改标死 -> 双方确认被清除
    s = must(toggleDeadGroup(s, at(15, 15)));
    expect(s.scoring!.dead).toEqual([]);
    expect(s.scoring!.confirmations).toEqual({ black: null, white: null });

    // 双方确认同一 revision -> finished
    s = must(confirmScore(s, 'white'));
    s = must(confirmScore(s, 'black'));
    expect(s.phase).toBe('finished');
    expect(s.result).not.toBeNull();
    expect(s.result!.type).toBe('score');
    expect(s.result!.breakdown!.total).toBe(361);
  });

  it('恢复对弈：死子回来、nextToPlay 沿用、PSK 历史保留、连续停着归零', () => {
    let s = playSequence();
    const keysBefore = s.positionKeys.length;
    s = must(pass(s));
    s = must(pass(s));
    expect(s.phase).toBe('scoring');
    s = must(toggleDeadGroup(s, at(15, 15)));
    s = must(resumePlay(s));
    expect(s.phase).toBe('playing');
    expect(s.board[at(15, 15)]).not.toBe(EMPTY); // 预览中的死子没有被永久移除
    expect(s.toPlay).toBe('white');
    expect(s.consecutivePasses).toBe(0);
    expect(s.scoring).toBeNull();
    expect(s.positionKeys.length).toBe(keysBefore + 2); // 两次停着的历史仍在
  });

  it('未达成一致不允许强行判胜：只有一方确认时无 result', () => {
    let s = playSequence();
    s = must(pass(s));
    s = must(pass(s));
    s = must(confirmScore(s, 'black'));
    expect(s.result).toBeNull();
    expect(s.phase).toBe('scoring');
  });
});

describe('悔棋与复盘', () => {
  it('悔棋到历史节点后继续，丢弃 redo 尾部且不受废弃局面键影响', () => {
    let s = playSequence();
    expect(s.moves.length).toBe(3);
    s = must(undo(s)); // 回到第 2 手后
    expect(s.historyCursor).toBe(2);
    expect(s.board[at(4, 3)]).toBe(EMPTY);
    expect(s.toPlay).toBe('black');
    // 复盘前进/后退
    s = must(redo(s));
    expect(s.historyCursor).toBe(3);
    expect(s.board[at(4, 3)]).not.toBe(EMPTY);
    s = must(goTo(s, 1));
    expect(s.historyCursor).toBe(1);
    // 从此处继续：新的落子截断尾部
    s = must(tryPlay(s, at(7, 7)));
    expect(s.moves.length).toBe(2);
    expect(s.moves[1]).toMatchObject({ type: 'play', vertex: at(7, 7) });
    expect(s.positionKeys.length).toBe(3);
  });

  it('含多次停着的悔棋不删除更早仍有效的同局面键（计数语义）', () => {
    const kc = new KeyCounter();
    const s = createGame({ topologyId: 'plane' });
    const emptyKey = boardKey(s.board, s.topologyVersion, s.n);
    kc.add(emptyKey); // 初始
    kc.add(emptyKey); // 第一次停着后
    kc.remove(emptyKey); // 悔掉这次停着
    expect(kc.has(emptyKey)).toBe(true); // 更早的同一键仍有效
    kc.remove(emptyKey);
    expect(kc.has(emptyKey)).toBe(false);
  });

  it('停着产生重复局面键，positionKeys 原样记录', () => {
    let s = createGame({ topologyId: 'plane' });
    s = must(pass(s));
    expect(s.positionKeys[1]).toBe(s.positionKeys[0]);
    expect(s.consecutivePasses).toBe(1);
  });
});
