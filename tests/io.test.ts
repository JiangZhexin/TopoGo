/** 棋谱 JSON 导出导入（提案 §8 / §9.4）：重放重建相同局面与结果。 */
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/core/state';
import { confirmScore, pass, toggleDeadGroup, tryPlay, type GameState } from '../src/core/rules';
import { exportGame, importGame } from '../src/io/gameJson';
import { at } from './fixtures/builder';

function must(r: { ok: boolean } & { state?: GameState }): GameState {
  if (!r.ok || !r.state) throw new Error('expected ok');
  return r.state;
}

function playedGame(): GameState {
  let s = createGame({ topologyId: 'klein', n: 19, komi: 7.5 });
  s = must(tryPlay(s, at(3, 3)));
  s = must(tryPlay(s, at(15, 15)));
  s = must(tryPlay(s, at(18, 15))); // 与 (3,3) 无关的跨缝区域落子
  return s;
}

describe('导出导入往返', () => {
  it('进行中对局：重建相同棋盘、轮次、合法着法', () => {
    const s = playedGame();
    const text = exportGame(s);
    const r = importGame(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board).toEqual(s.board);
    expect(r.state.toPlay).toBe(s.toPlay);
    expect(r.state.historyCursor).toBe(s.historyCursor);
    expect(r.state.positionKeys).toEqual(s.positionKeys);
    expect(r.state.phase).toBe('playing');
  });

  it('终局协商中对局：死子标记与 revision 语义保留', () => {
    let s = playedGame();
    s = must(pass(s));
    s = must(pass(s));
    s = must(toggleDeadGroup(s, at(15, 15)));
    const r = importGame(exportGame(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe('scoring');
    expect(r.state.scoring!.dead).toEqual([at(15, 15)]);
    expect(r.state.scoring!.confirmations).toEqual({ black: null, white: null });
  });

  it('已结算对局：内核重算结果一致才接受', () => {
    let s = playedGame();
    s = must(pass(s));
    s = must(pass(s));
    s = must(confirmScore(s, 'black'));
    s = must(confirmScore(s, 'white'));
    expect(s.phase).toBe('finished');
    const r = importGame(exportGame(s));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe('finished');
    expect(r.state.result).toEqual(s.result);
  });

  it('篡改自称胜负的棋谱被拒绝', () => {
    let s = playedGame();
    s = must(pass(s));
    s = must(pass(s));
    s = must(confirmScore(s, 'black'));
    s = must(confirmScore(s, 'white'));
    const file = JSON.parse(exportGame(s));
    file.result.margin += 100;
    file.result.winner = file.result.winner === 'black' ? 'white' : 'black';
    const r = importGame(JSON.stringify(file));
    expect(r.ok).toBe(false);
  });

  it('未知拓扑版本、非法着手、越界均被拒绝', () => {
    const s = playedGame();
    const good = JSON.parse(exportGame(s));
    const badVersion = { ...good, topologyVersion: 'topo-v999' };
    expect(importGame(JSON.stringify(badVersion)).ok).toBe(false);

    const badMove = JSON.parse(exportGame(s));
    badMove.moves = [{ type: 'play', color: 'black', vertex: 3, captured: [] }, { type: 'play', color: 'white', vertex: 3, captured: [] }];
    expect(importGame(JSON.stringify(badMove)).ok).toBe(false);

    expect(importGame('{"schemaVersion":1,').ok).toBe(false);
    expect(importGame('not json').ok).toBe(false);
  });
});
