import { ReactiveEffect } from './effect'

export type Dep = Set<ReactiveEffect>

// 存储所有的 effect 对象
export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  return dep
}
