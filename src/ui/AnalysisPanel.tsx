/** 局势辅助面板（提案 §5）：只展示可确定计算的局部信息与明确标注的启发式。 */
import type { AnalysisResult } from '../analysis/types';
import { displayCoord } from '../core/types';

export interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  loading: boolean;
  showInfluence: boolean;
  n: number;
}

export function AnalysisPanel(props: AnalysisPanelProps) {
  const a = props.analysis;
  return (
    <div className="card">
      <h2>局势辅助</h2>
      {!a && <div className="note">{props.loading ? '计算中…' : '暂无数据'}</div>}
      {a && (
        <>
          <div className="status-line">
            势力图（启发式）：
            {a.influence.converged
              ? `已收敛（${a.influence.iterations} 次迭代）`
              : `近似未完全收敛（${a.influence.iterations} 次，残差 ${a.influence.residual.toExponential(1)}）`}
            {!props.showInfluence && '（未显示，可在对局面板开启）'}
          </div>
          {a.heuristicMargin !== null ? (
            <div className="status-line">
              参考估值（势力折算差，非终局预测）：
              {a.heuristicMargin > 0 ? `黑 +${a.heuristicMargin.toFixed(1)}` : `白 +${(-a.heuristicMargin).toFixed(1)}`}
            </div>
          ) : (
            <div className="status-line warn">尚不适合判断领先。</div>
          )}
          {a.atariGroups.length > 0 && (
            <div className="status-line">
              叫吃：
              {a.atariGroups.map((g, i) => (
                <span key={i} style={{ marginRight: 8 }}>
                  {g.color === 'black' ? '黑' : '白'}串 {displayCoord(g.stones[0], props.n)}
                  {g.stones.length > 1 ? ` 等 ${g.stones.length} 子` : ''}（仅 {displayCoord(g.liberties[0], props.n)} 一气）
                </span>
              ))}
            </div>
          )}
          {a.twoLibertyGroups.length > 0 && (
            <div className="status-line note">二气警示：{a.twoLibertyGroups.length} 串（不等于必死）</div>
          )}
          {a.captureMoves.length > 0 && (
            <div className="status-line">
              一手提子点：
              {a.captureMoves.slice(0, 8).map((m) => (
                <span key={m.vertex} style={{ marginRight: 8 }}>
                  {displayCoord(m.vertex, props.n)}（提 {m.captures}）
                </span>
              ))}
              {a.captureMoves.length > 8 && `…共 ${a.captureMoves.length} 处`}
            </div>
          )}
          <ul className="tight">
            {a.warnings.map((w, i) => (
              <li key={i} className="warn">{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
