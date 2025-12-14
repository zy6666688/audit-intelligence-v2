/* Vue 3 全局类型声明 */

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 修复 uni-app 的 Vue 3 类型导出问题
declare module 'vue' {
  export * from '@vue/runtime-core'
  export * from '@vue/runtime-dom'
  export * from '@vue/reactivity'
  
  // uni-app 使用 createSSRApp
  export function createSSRApp(...args: any[]): any
}

// Vue Router 类型扩展
declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    keepAlive?: boolean;
  }
}
