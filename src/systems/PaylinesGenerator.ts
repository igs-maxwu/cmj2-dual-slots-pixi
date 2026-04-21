/**
 * Generates N paylines using the reference demo's LCG algorithm (seed=12345).
 * Boundary clamping matches Dual Slot 3.html exactly:
 *   r < 0  → r = 1  (not Math.max(0, r))
 *   r >= ROWS → r = ROWS-2  (not Math.min(ROWS-1, r))
 */
export function generatePaylines(rows: number, cols: number, count: number): number[][] {
  let seed = 12345;
  const rand = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const lines: number[][] = [];
  for (let i = 0; i < count; i++) {
    let r = Math.floor(rand() * rows);
    const line = [r];
    for (let c = 1; c < cols; c++) {
      const move = Math.floor(rand() * 3) - 1;
      r += move;
      if (r < 0)     r = 1;
      if (r >= rows) r = rows - 2;
      line.push(r);
    }
    lines.push(line);
  }
  return lines;
}
