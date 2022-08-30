import { extend } from '@vue/shared'
import { EffectScope, recordEffectScope } from './effectScope'

type Dep = Set<any>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export type EffectScheduler = (...args: any[]) => any

export let activeEffect: ReactiveEffect | undefined

export function track(target, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(key)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Set()))
    }
    if (!dep.has(activeEffect!)) {
      dep.add(activeEffect!)
      activeEffect!.deps.push(dep)
    }
  }
}

export function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // NOTE: never been tracked
    return
  }
  const dep = depsMap.get(key)
  if (!dep) return
  for (const effect of dep) {
    if (effect.scheduler) {
      effect.scheduler()
    } else {
      effect.run()
    }
  }
}

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
    // this.fn = fn
    // this.scheduler = scheduler

    // this.onStop = onStop

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

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}
