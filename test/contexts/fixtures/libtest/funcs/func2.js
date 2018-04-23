/**
 * A function with a repeatable parameter
 * and this JsDoc string
 */
export default function func2 (a, ...b) {
  return [a].concat(...b)
}
