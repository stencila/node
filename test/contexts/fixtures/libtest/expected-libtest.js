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

  const func1$1 = {
    "type": "function",
    "name": "func1",
    "methods": {
      "func1()": {
        "type": "method",
        "signature": "func1()"
      }
    },
    "source": {
      "type": "text",
      "lang": "js",
      "data": "// A function without a JSDoc string\n\nexport default function func1 () {}\n"
    }
  };
  func1$1.body = func1;
  const func2$1 = {
    "type": "function",
    "name": "func2",
    "methods": {
      "func2()": {
        "type": "method",
        "signature": "func2()",
        "description": "A function with a repeatable parameter\n and this JsDoc string"
      }
    },
    "source": {
      "type": "text",
      "lang": "js",
      "data": "/**\n * A function with a repeatable parameter\n * and this JsDoc string\n */\nexport default function func2 (a, ...b) {\n  return [a].concat(...b)\n}\n"
    }
  };
  func2$1.body = func2;
  const func3$1 = {
    "type": "function",
    "name": "func3",
    "methods": {
      "func3(a: string): string": {
        "type": "method",
        "signature": "func3(a: string): string",
        "description": "A function with overloads",
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
        "type": "method",
        "signature": "func3(a: number): number",
        "description": "A function with overloads",
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
    },
    "source": {
      "type": "text",
      "lang": "js",
      "data": "/**\n * A function with overloads\n *\n * @param {string} a\n * @return {string}\n */\n\n/**\n * A function with overloads\n *\n * @param {number} a\n * @return {number}\n */\n\nexport default function func3 (a) {\n  return\n}\n"
    }
  };
  func3$1.body = func3;

  exports.func1 = func1$1;
  exports.func2 = func2$1;
  exports.func3 = func3$1;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
