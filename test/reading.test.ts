import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function reader(horizontal = false) {
  const handlers = new Map<string, (event: any) => void>();
  const windowHandlers = new Map<string, Array<() => void>>();
  const attributes = new Map<string, string>();
  const variables = new Map<string, string>();
  let captured: number | null = null;
  let blurred = false;
  let headerHeight = 80;
  const track = {
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    setPointerCapture: (id: number) => { captured = id; },
    releasePointerCapture: () => { captured = null; },
    blur() { blurred = true; },
  };
  const progress = {
    innerHTML: "", hidden: false,
    style: { setProperty: (name: string, value: string) => variables.set(name, value) },
    querySelector: (selector: string) => selector === ".reading-progress-track" ? track : { textContent: "" },
  };
  const window = {
    scrollY: 0,
    innerHeight: 800,
    matchMedia: () => ({ matches: horizontal }),
    addEventListener(name: string, handler: () => void) {
      windowHandlers.set(name, [...windowHandlers.get(name) ?? [], handler]);
    },
    scrollTo(_x: number, y: number) {
      this.scrollY = y;
      windowHandlers.get("scroll")?.forEach((handler) => handler());
    },
  };
  const article = {
    getBoundingClientRect: () => ({ top: 200 - window.scrollY, bottom: 2200 - window.scrollY }),
    querySelectorAll: () => [],
  };
  const source = (await readFile(new URL("../public/main.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/, "");
  vm.runInNewContext(source, {
    window,
    document: {
      querySelector: (selector: string) => selector === "main > article" ? article
        : selector === ".site-header" ? { getBoundingClientRect: () => ({ height: headerHeight }) } : null,
      querySelectorAll: () => [],
      createElement: () => progress,
      addEventListener() {},
      body: { append() {} },
      documentElement: { style: { setProperty: (name: string, value: string) => variables.set(name, value) } },
    },
    requestAnimationFrame: (callback: () => void) => callback(),
  });
  return {
    window, attributes, variables,
    get captured() { return captured; },
    get blurred() { return blurred; },
    event(name: string, overrides: Record<string, unknown> = {}) {
      handlers.get(name)!({
        pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 20,
        preventDefault() {}, ...overrides,
      });
    },
    resizeHeader(height: number) {
      headerHeight = height;
      windowHandlers.get("resize")?.forEach((handler) => handler());
    },
  };
}

test("vertical progress dragging captures the pointer and clamps to the article", async () => {
  const current = await reader();
  current.event("pointerdown");
  assert.equal(current.captured, 1);
  assert.equal(current.blurred, true);
  assert.equal(current.window.scrollY, 120);
  current.event("pointermove", { clientY: 70 });
  assert.equal(current.window.scrollY, 760);
  assert.equal(current.attributes.get("aria-valuenow"), "50");
  current.event("pointerup", { clientY: 300 });
  assert.equal(current.window.scrollY, 1400);
  assert.equal(current.captured, null);
  current.event("pointermove");
  assert.equal(current.window.scrollY, 1400);
});

test("horizontal progress uses the touch pointer's X coordinate", async () => {
  const current = await reader(true);
  current.event("pointerdown", { pointerType: "touch", clientX: 110 });
  assert.equal(current.window.scrollY, 760);
  assert.equal(current.attributes.get("aria-orientation"), "horizontal");
  current.event("pointermove", { clientX: -50 });
  assert.equal(current.window.scrollY, 120);
  current.event("pointerup", { clientX: 500 });
  assert.equal(current.window.scrollY, 1400);
});

test("cancelled, lost and unrelated pointers cannot continue seeking", async () => {
  for (const stop of ["pointercancel", "lostpointercapture"]) {
    const current = await reader();
    current.event("pointerdown", { button: 2 });
    assert.equal(current.captured, null);
    current.event("pointerdown");
    current.event("pointermove", { pointerId: 2, clientY: 70 });
    assert.equal(current.window.scrollY, 120);
    current.event(stop);
    current.event("pointermove", { clientY: 70 });
    assert.equal(current.window.scrollY, 120);
  }
});

test("keyboard seeking and progress account for the resized sticky header", async () => {
  const current = await reader();
  current.resizeHeader(128);
  assert.equal(current.variables.get("--reading-header-height"), "128px");
  current.event("keydown", { key: "Home" });
  assert.equal(current.window.scrollY, 72);
  current.event("keydown", { key: "End" });
  assert.equal(current.window.scrollY, 1400);
  assert.equal(current.attributes.get("aria-valuenow"), "100");
});
