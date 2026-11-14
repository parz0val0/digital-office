import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// drei <Html> 在楼层切换（整层卸载）时会对已脱离的节点再次 removeChild，抛出无害的 NotFoundError。
// 这里做一次守卫：节点已经不在该父节点下时直接忽略（常见的 React 19 + 叠层 DOM 的兼容处理）。
const _removeChild = Node.prototype.removeChild
Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
  if (child.parentNode !== this) return child
  return _removeChild.call(this, child) as T
}

createRoot(document.getElementById('root')!).render(
  // 不用 StrictMode：drei <Html> 在开发式双挂载下会因为复用同一个 DOM 节点而偶尔丢失内容（楼层标牌消失）
  <App />,
)
