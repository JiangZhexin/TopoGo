/** 全局错误边界：渲染异常时展示错误信息而不是白屏。 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    console.error('[TopoGo] render crash:', error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', maxWidth: 900, margin: '40px auto' }}>
          <h2 style={{ color: '#c62828' }}>界面发生错误（对局数据已自动保存，刷新可恢复）</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fbe9e7', padding: 12, borderRadius: 8 }}>
            {String(this.state.error.stack || this.state.error.message)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '6px 14px' }}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
