import { reactive } from '../src/reactive'

describe('reactive', () => {
  it('reactive test', () => {
    const original = { foo: 1 }
    const observed = reactive(original)
    expect(observed).not.toBe(original)
    expect(original.foo).toBe(1)
  })
})
