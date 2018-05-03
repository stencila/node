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

  /**
   * A function with overloads
   *
   * @param {string} a
   * @return {string}
   */

  /**
   * A function with overloads
   *
   * @param {number} a
   * @return {number}
   */

  function func3 (a) {
    return
  }

  const type = 'library';
        const name = 'libtest';
        let funcs = {};
  funcs['func1'] = {
    "type": "function",
    "name": "func1",
    "methods": {
      "func1()": {
        "signature": "func1()"
      }
    }
  };
  funcs['func1'].body = func1;
  funcs['func2'] = {
    "type": "function",
    "name": "func2",
    "description": "A function with a repeatable parameter\n and this JsDoc string",
    "methods": {
      "func2()": {
        "signature": "func2()"
      }
    }
  };
  funcs['func2'].body = func2;
  funcs['func3'] = {
    "type": "function",
    "name": "func3",
    "description": "A function with overloads",
    "methods": {
      "func3(a: string): string": {
        "signature": "func3(a: string): string",
        "params": [
          {
            "name": "a",
            "type": "string"
          }
        ],
        "return": {
          "type": "string"
        }
      },
      "func3(a: number): number": {
        "description": "A function with overloads",
        "signature": "func3(a: number): number",
        "params": [
          {
            "name": "a",
            "type": "number"
          }
        ],
        "return": {
          "type": "number"
        }
      }
    }
  };
  funcs['func3'].body = func3;

  exports.type = type;
  exports.name = name;
  exports.funcs = funcs;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
