import { setupPlatformEvaluator } from "../services/evaluator";

describe("setupPlatformEvaluator", () => {
  it("returns true when Function constructor works", () => {
    expect(setupPlatformEvaluator()).toBe(true);
  });

  it("sets Platform.shim.eval to call cipher code", () => {
    const Platform = require("youtubei.js").Platform;
    setupPlatformEvaluator();

    expect(typeof (Platform.shim as any).eval).toBe("function");

    const result = (Platform.shim as any).eval(
      { output: "return { result: a + b }" },
      { a: 2, b: 3 }
    );
    expect(result).toEqual({ result: 5 });
  });

  it("throws when cipher code is invalid", () => {
    const Platform = require("youtubei.js").Platform;
    setupPlatformEvaluator();

    expect(() => {
      (Platform.shim as any).eval({ output: "invalid syntax !!!" }, {});
    }).toThrow();
  });
});
