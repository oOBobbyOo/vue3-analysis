type Dep = Set<any>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

let activeEffect

export function track(target, key) {
  let depsMap = targetMap.get(key)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
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

class ReactiveEffect {
  private _fn: any
  private deps: any = []
  private active: boolean = true
  public onStop: () => void

  constructor(fn, public scheduler?: Function, onStop?) {
    this._fn = fn
    this.scheduler = scheduler
    this.onStop = onStop
  }

  run() {
    activeEffect = this
    return this._fn()
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
  effect.deps.forEach((dep: any) => {
    dep.delete(effect)
  })
}

export function effect(fn, options: any = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler)
  _effect.onStop = options.onStop

  _effect.run()

  const runner: any = _effect.run.bind(_effect)
  runner.effect = _effect

  return runner
}

export function stop(runner) {
  runner.effect.stop()
}
