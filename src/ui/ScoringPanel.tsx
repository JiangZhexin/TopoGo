/** 终局协商与结算面板（提案 §3.5 / §4）：预览、双方确认、恢复对弈、结果展示。 */
import { useMemo } from 'react';
import type { GameState } from '../core/rules';
import { scorePosition, formatResult } from '../core/scoring';
import { getTopologySpec } from '../core/topology';

export interface ScoringPanelProps {
  state: GameState;
  onConfirm: (color: 'black' | 'white') => void;
  onResume: () => void;
}

export function ScoringPanel(props: ScoringPanelProps) {
  const { state } = props;
  const sc = state.scoring;

  const preview = useMemo(() => {
    if (!sc) return null;
    const spec = getTopologySpec(state.topologyId, state.n);
    return scorePosition(sc.snapshotBoard, spec.adjacency, new Set(sc.dead), state.komi);
  }, [sc, state.topologyId, state.n, state.komi]);

  if (state.phase === 'finished' && state.result) {
    const b = state.result.breakdown;
    return (
      <div className="card">
        <h2>对局结果</h2>
        <div className="result-banner">{formatResult(state.result)}</div>
        {b && (
          <table className="score-table" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td></td><th>黑</th><th>白</th></tr>
              <tr><td>盘上石子</td><td>{b.blackStones}</td><td>{b.whiteStones}</td></tr>
              <tr><td>空地</td><td>{b.blackTerritory}</td><td>{b.whiteTerritory}</td></tr>
              <tr><td>贴目</td><td>—</td><td>{b.komi}</td></tr>
              <tr><td>中立空点</td><td colSpan={2}>{b.neutral}</td></tr>
              <tr><th>总分</th><th>{b.blackScore}</th><th>{b.whiteScore}</th></tr>
            </tbody>
          </table>
        )}
        <div className="note" style={{ marginTop: 6 }}>
          面积 = 保留石子 + 单色边界空域；提子不额外加分，确认移除的死子不重复计为俘虏。
        </div>
      </div>
    );
  }

  if (state.phase !== 'scoring' || !sc || !preview) return null;

  const rev = sc.revision;
  const confB = sc.confirmations.black === rev;
  const confW = sc.confirmations.white === rev;

  return (
    <div className="card">
      <h2>终局协商（第 {rev} 版）</h2>
      <div className="note">
        点击棋盘上的棋子可标记/取消整串死子（只改预览，不改真实历史）。
        双方确认同一版本后才结算；未达成一致时不强行判胜。
      </div>
      <table className="score-table" style={{ marginTop: 8 }}>
        <tbody>
          <tr><td></td><th>黑</th><th>白</th></tr>
          <tr><td>盘上石子（标死移除后）</td><td>{preview.blackStones}</td><td>{preview.whiteStones}</td></tr>
          <tr><td>空地</td><td>{preview.blackTerritory}</td><td>{preview.whiteTerritory}</td></tr>
          <tr><td>贴目</td><td>—</td><td>{preview.komi}</td></tr>
          <tr><td>中立空点</td><td colSpan={2}>{preview.neutral}</td></tr>
          <tr><th>预览总分</th><th>{preview.blackScore}</th><th>{preview.whiteScore}</th></tr>
        </tbody>
      </table>
      <div className="status-line" style={{ marginTop: 6 }}>
        预览差：{preview.margin > 0 ? `黑 +${preview.margin}` : preview.margin < 0 ? `白 +${-preview.margin}` : '0（和棋）'}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="primary" disabled={confB} onClick={() => props.onConfirm('black')}>
          黑方确认
        </button>
        <span className={`confirm-pill ${confB ? 'yes' : ''}`}>{confB ? '已确认' : '未确认'}</span>
      </div>
      <div className="row">
        <button className="primary" disabled={confW} onClick={() => props.onConfirm('white')}>
          白方确认
        </button>
        <span className={`confirm-pill ${confW ? 'yes' : ''}`}>{confW ? '已确认' : '未确认'}</span>
      </div>
      <div className="row" style={{ marginTop: 4 }}>
        <button onClick={props.onResume}>恢复对弈（继续实际提掉争议棋）</button>
      </div>
    </div>
  );
}
