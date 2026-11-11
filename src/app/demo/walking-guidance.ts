import { kmBetween, type Camino, type Point } from './models';

export type WalkingDirection = 'left' | 'right' | 'sharp' | 'straight' | 'finish';
interface Turn {
  kind: WalkingDirection;
  distance: number;
  position: Point;
  angle: number;
}

function bearing(a: Point, b: Point) {
  return (
    (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI
  );
}

export function walkingTrack(lines: Point[][]) {
  const points: Point[] = [],
    distances: number[] = [],
    stageOffsets: number[] = [],
    stageLengths: number[] = [];
  let travelled = 0;
  for (const line of lines) {
    let start = travelled;
    line.forEach((point, index) => {
      const previous = points.at(-1);
      if (previous) travelled += kmBetween(previous, point);
      if (!previous || point[0] !== previous[0] || point[1] !== previous[1]) {
        points.push(point);
        distances.push(travelled);
      }
      if (!index) start = travelled;
    });
    stageOffsets.push(start);
    stageLengths.push(travelled - start);
  }
  const turns: Turn[] = [];
  let left = 0,
    right = 1;
  for (let index = 1; index < points.length - 1; index++) {
    while (left < index - 1 && distances[left + 1] < distances[index] - 0.025) left++;
    right = Math.max(right, index + 1);
    while (right < points.length - 1 && distances[right] < distances[index] + 0.025) right++;
    const incoming = bearing(points[left], points[index]);
    const outgoing = bearing(points[index], points[right]);
    const angle = ((outgoing - incoming + 540) % 360) - 180;
    if (Math.abs(angle) < 45) continue;
    const turn: Turn = {
      kind: Math.abs(angle) >= 135 ? 'sharp' : angle > 0 ? 'right' : 'left',
      distance: distances[index],
      position: points[index],
      angle,
    };
    const previous = turns.at(-1);
    if (previous && turn.distance - previous.distance < 0.045) {
      if (Math.abs(turn.angle) > Math.abs(previous.angle)) turns[turns.length - 1] = turn;
    } else turns.push(turn);
  }
  return { points, distances, stageOffsets, stageLengths, turns };
}

export type WalkingTrack = ReturnType<typeof walkingTrack>;

export function trackDistance(route: Camino, track: WalkingTrack, distance: number) {
  let modelStart = 0;
  for (let index = 0; index < route.stages.length; index++) {
    const stage = route.stages[index];
    if (distance <= modelStart + stage.km || index === route.stages.length - 1) {
      return (
        (track.stageOffsets[index] ?? 0) +
        (track.stageLengths[index] ?? 0) *
          Math.max(0, Math.min(1, (distance - modelStart) / stage.km))
      );
    }
    modelStart += stage.km;
  }
  return 0;
}

export function walkingInstruction(track: WalkingTrack, current: number, end: number) {
  const remaining = Math.max(0, end - current);
  const next = track.turns.find(
    (turn) => turn.distance >= current - 0.005 && turn.distance < end - 0.03,
  );
  const turn = remaining > 0.08 ? next : undefined;
  return {
    kind: turn?.kind ?? ((remaining <= 0.08 ? 'finish' : 'straight') as WalkingDirection),
    metres: Math.max(0, (turn ? turn.distance - current : remaining) * 1000),
    position: turn?.position,
    rotation: turn ? Math.sign(turn.angle) * (turn.kind === 'sharp' ? 135 : 90) : 0,
  };
}
