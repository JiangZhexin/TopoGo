/** 复盘控制：只读浏览历史；从历史节点继续由下一次落子显式截断尾部。 */
import type { GameState } from '../core/rules';

export interface ReviewControlsProps {
  state: GameState;
  onGoTo: (cursor: number) => void;
}

export function ReviewControls(props: ReviewControlsProps) {
  const { state } = props;
  const cur = state.historyCursor;
  const total = state.moves.length;
  const reviewing = cur < total;
  if (state.phase !== 'playing') return null;
  return (
    <div>
      <div className="review-bar">
        <button disabled={cur === 0} onClick={() => props.onGoTo(0)} title="回到开局">⏮</button>
        <button disabled={cur === 0} onClick={() => props.onGoTo(cur - 1)} title="后退一手">◀</button>
        <span style={{ fontSize: 13 }}>{cur} / {total}</span>
        <button disabled={!reviewing} onClick={() => props.onGoTo(cur + 1)} title="前进一手">▶</button>
        <button disabled={!reviewing} onClick={() => props.onGoTo(total)} title="返回当前局面">⏭</button>
      </div>
      {reviewing && (
        <div className="review-hint">
          复盘模式（只读）。直接落子将从第 {cur + 1} 手“从此处继续”，并丢弃之后的 {total - cur} 手。
        </div>
      )}
    </div>
  );
}
