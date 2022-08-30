import { extend } from '@vue/shared'

type Dep = Set<any>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export type EffectScheduler = (...args: any[]) => any

export let activeEffect: ReactiveEffect | undefined

export function track(target, key) {
  if (!activeEffect) return

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

class ReactiveEffect<T = any> {
  private _fn: () => T
  active: boolean = true
  deps: Dep[] = []
  parent: ReactiveEffect | undefined = undefined
  onStop?: () => void

  constructor(fn, public scheduler?: EffectScheduler, onStop?) {
    this._fn = fn
    this.scheduler = scheduler
    this.onStop = onStop
  }

  run() {
    if (!this.active) {
      return this._fn()
    }

    let parent: ReactiveEffect | undefined = activeEffect
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }

    try {
      this.parent = activeEffect
      activeEffect = this
      return this._fn()
    } finally {
      activeEffect = this.parent
      this.parent = undefined
    }
  }

  stop() {
    if (this.active) {
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

export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn)

  if (options) {
    extend(_effect, options)
  }

  if (!options || !options.lazy) {
    _effect.run()
  }

  const runner: any = _effect.run.bind(_effect)
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
