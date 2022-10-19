import {
  isReadonly,
  reactive,
  ReactiveFlags,
  reactiveMap,
  readonly,
  readonlyMap,
  Target
} from './reactive'
import { track, trigger, ITERATE_KEY } from './effect'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import { isObject, hasOwn, isSymbol, isArray } from '@vue/shared'
import { warn } from './warning'

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .filter((key) => key !== 'arguments' && key !== 'caller')
    .map((key) => (Symbol as any)[key])
    .filter(isSymbol)
)

const get = createGetter()
const readonlyGet = createGetter(true)

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    const isExistInReactiveMap = () =>
      key === ReactiveFlags.RAW && receiver === reactiveMap.get(target)

    const isExistInReadonlyMap = () =>
      key === ReactiveFlags.RAW && receiver === readonlyMap.get(target)

    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow
    } else if (isExistInReactiveMap() || isExistInReadonlyMap()) {
      return target
    }

    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      // 在触发 get 的时候进行依赖收集
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return res
    }

    if (isObject(res)) {
      // 把内部所有的是 object 的值都用 reactive 包裹，变成响应式对象
      // 如果说这个 res 值是一个对象的话，那么我们需要把获取到的 res 也转换成 reactive
      // res 等于 target[key]
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

const set = createSetter()

function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    // 获取旧值
    let oldValue = (target as any)[key]

    if (isReadonly(oldValue)) {
      return false
    }

    const result = Reflect.set(target, key, value, receiver)

    // 在触发 set 的时候进行触发依赖
    trigger(target, TriggerOpTypes.SET, key, value, oldValue)

    return result
  }
}

function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target)
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target)
    }
    return true
  }
}
