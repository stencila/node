(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.local = {})));
}(this, (function (exports) { 'use strict';

  // A function without a JSDoc string

  function func1 () {}

  /**
   * A function with a repeatable parameter
   * and this JsDoc string
   */
  function func2 (a, ...b) {
    return [a].concat(...b)
  }

  const FUNCS = {
    "func1": {
      "type": "func",
      "name": "func1"
    },
    "func2": {
      "type": "func",
      "description": "A function with a repeatable parameter\n and this JsDoc string",
      "name": "func2",
      "params": [
        {
          "name": "a"
        },
        {
          "name": "b",
          "repeats": true
        }
      ]
    }
  };

  exports.FUNCS = FUNCS;
  exports.func1 = func1;
  exports.func2 = func2;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
