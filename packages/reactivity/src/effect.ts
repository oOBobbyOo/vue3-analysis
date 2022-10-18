import { extend, isArray } from '@vue/shared'
import { createDep, Dep } from './dep'
import { EffectScope, recordEffectScope } from './effectScope'
import { TrackOpTypes, TriggerOpTypes } from './operations'

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export type EffectScheduler = (...args: any[]) => any

export let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export class ReactiveEffect<T = any> {
  active: boolean = true
  deps: Dep[] = []
  parent: ReactiveEffect | undefined = undefined
  private deferStop?: boolean
  onStop?: () => void

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  run() {
    if (!this.active) {
      return this.fn()
    }

    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }

    try {
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true

      return this.fn()
    } finally {
      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)

      if (this.onStop) this.onStop()

      this.active = false
    }
  }
}

function cleanupEffect(effect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: any
  allowRecurse?: boolean
  onStop?: () => void
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)

  if (options) {
    extend(_effect, options)
    if (options.scope) recordEffectScope(_effect, options.scope)
  }

  if (!options || !options.lazy) {
    _effect.run()
  }

  const runner: any = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect

  return runner
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

export let shouldTrack = true
const trackStack: boolean[] = []

// 暂停
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

// 开启
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

// 重置
export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

// TODO: 依赖收集
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(key)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    trackEffects(dep)
  }
}

export function trackEffects(dep: Dep) {
  let shouldTrack = false
  shouldTrack = !dep.has(activeEffect!)
  if (shouldTrack) {
    // 用 dep 来存放所有的 effect
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

// TODO: 触发依赖
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // NOTE: never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []

  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }

  const effects: Array<any> = []
  deps.forEach((dep) => {
    // 这里解构 dep 得到的是 dep 内部存储的 effect
    if (dep) {
      effects.push(...dep)
    }
  })

  triggerEffects(createDep(effects))
}

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}
