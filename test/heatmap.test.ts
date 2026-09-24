import assert from "node:assert/strict";
import test from "node:test";
import { renderNoteHeatmap } from "../public/heatmap.js";

test("heatmap counts latest published-note dates without inventing dates", () => {
  const result = renderNoteHeatmap([
    { date: "2026-09-21", updated: "2026-09-22" },
    { date: "2026-09-22" },
    { date: "2026-09-23" },
    {},
    { date: "2026-09-24" },
  ], new Date(2026, 8, 23));

  assert.match(result, /Tue (?:[·░▒█] )*▒/);
  assert.match(result, /Wed (?:[·░▒█] )*░/);
  assert.match(result, /2 active day\(s\) · 1 note\(s\) without date\/updated/);
  assert.match(result, /not its edit history/);
});
