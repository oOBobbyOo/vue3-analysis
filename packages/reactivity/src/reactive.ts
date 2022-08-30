import { isObject, toRawType } from '@vue/shared'
import { track, trigger } from './effect'

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
}

export const reactiveMap = new WeakMap<Target, any>()
export const readonlyMap = new WeakMap<Target, any>()

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

export function readonly<T extends object>(target: T): T {
  return createReactiveObject(target, true, readonlyMap)
}

export function reactive(target: object) {
  if (isReadonly(target)) {
    return target
  }

  return createReactiveObject(target, false, reactiveMap)
}

function createReactiveObject(target: Target, isReadonly: boolean, proxyMap: WeakMap<Target, any>) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }

  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target
  }

  // 缓存
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 只能观察特定的值类型
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }

  // 代理
  const proxy = new Proxy(target, {
    get(target, key) {
      if (key === ReactiveFlags.IS_REACTIVE) {
        return !isReadonly
      } else if (key === ReactiveFlags.IS_READONLY) {
        return isReadonly
      }

      const res = Reflect.get(target, key)

      // TODO: 依赖收集
      track(target, key)

      // TODO: 处理对象嵌套
      if (isObject(res)) {
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    set(target, key, value) {
      const res = Reflect.set(target, key, value)

      // TODO: 触发依赖
      trigger(target, key)

      return res
    }
  })

  proxyMap.set(target, proxy)

  return proxy
}

export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}
