// The outline of a delivery area: a list of [longitude, latitude] corners, in order. Pure functions, so the rules
// can be tested without a map. The server checks the same things again before it saves.
export const MIN_CORNERS = 3;
export const MAX_CORNERS = 200;

export function validPoint([lng, lat]) {
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
}

/** A new outline with one more corner. Ignores a corner that repeats the last one (a double click). */
export function addCorner(points, point) {
  if (!validPoint(point) || points.length >= MAX_CORNERS) return points;
  const last = points[points.length - 1];
  if (last && last[0] === point[0] && last[1] === point[1]) return points;
  return [...points, point];
}

export function undoCorner(points) {
  return points.slice(0, -1);
}

/** The corners closed into a ring, as GeoJSON wants them. */
export function ring(points) {
  if (points.length === 0) return [];
  return [...points, points[0]];
}

/** Two segments cross when each one's ends lie on opposite sides of the other. Touching at a corner is not a crossing. */
function segmentsCross(a, b, c, d) {
  const orient = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

/** True when the outline crosses itself, which a delivery area cannot do. */
export function crossesItself(points) {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // these two edges share a corner
      if (segmentsCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Why an outline cannot be saved yet, or null when it can. */
export function outlineProblem(points) {
  if (points.length < MIN_CORNERS) return `Add at least ${MIN_CORNERS} corners on the map.`;
  if (!points.every(validPoint)) return 'One of the corners is outside the map.';
  if (crossesItself(points)) return 'The outline crosses itself. Undo the last corner and add it again in order.';
  return null;
}

/** The box that holds every point of every outline, as [[west, south], [east, north]], or null when there are none. */
export function boundsOf(outlines) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const outline of outlines) {
    for (const [lng, lat] of outline) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  if (!Number.isFinite(west)) return null;
  return [[west, south], [east, north]];
}

/** The middle of a box, which is where the map opens for an area. */
export function centreOf(bounds) {
  if (!bounds) return null;
  const [[w, s], [e, n]] = bounds;
  return [(w + e) / 2, (s + n) / 2];
}
