import { Context } from '../context/context'
import { toLiquidValue, toValue } from '../util'

export function isTruthy (val: any, ctx: Context): boolean {
  return !isFalsy(val, ctx)
}

export function isFalsy (val: any, ctx: Context): boolean {
  val = toLiquidValue(toValue(val))

  if (ctx.opts.jsTruthy) {
    return !val
  } else {
    return val === false || undefined === val || val === null
  }
}
