import type { Point } from './models';

export function joinStages(stages: Point[][]): Point[][] {
  const lines = stages.slice();
  for (let index = 1; index < lines.length; index++) {
    const previous = lines[index - 1];
    const next = lines[index];
    let shared = 0;
    while (shared < Math.min(previous.length - 1, next.length - 1)) {
      const a = previous[previous.length - 1 - shared];
      const b = next[shared];
      if (a[0] !== b[0] || a[1] !== b[1]) break;
      shared++;
    }
    // Independently routed stages can visit the same side street out and back.
    // Put their shared boundary at the junction where the paths diverge.
    const backtrack = shared - 1;
    if (backtrack > 0) {
      lines[index - 1] = previous.slice(0, -backtrack);
      lines[index] = next.slice(backtrack);
    }
  }
  return lines;
}
