// Waypoint graph for Dermaga Meridian (data only — no three.js). North is -z
// (Meridian spawn), south is +z (Arunika spawn). Sites: A west (-20,-15), B east
// (20,-15). Three north-south lanes: A (x -23), Mid (x 0), B (x 23). Bots walk
// node to node; A* finds the shortest route on this small graph.
export const NODES = [
  [0, 20], [-5, 20], [5, 20], // 0-2 Arunika spawn
  [-23, 16], [-23, 4], [-23, -4], // 3-5 Lane A
  [-18, -10], [-20, -15], [-26, -19], [-14, -19], // 6-9 Site A entry/centre/holds
  [0, 14], [-2, 4], [2, -4], [0, -11], // 10-13 Mid (slalom through the mid doors)
  [-10, -15], [10, -15], // 14-15 Mid-to-site gaps
  [23, 16], [23, 4], [23, -4], // 16-18 Lane B
  [18, -10], [20, -15], [26, -19], [14, -19], // 19-22 Site B entry/centre/holds
  [0, -20], [-5, -20], [5, -20], // 23-25 Meridian spawn
  [-8, 8], [8, 8], // 26-27 cross connectors (gaps in the x = -12 / +12 dividers)
  [0, -8], // 28 Mid hold
];

const EDGES = [
  [1, 2, 10], [0, 26], [0, 27], // 0-2
  [4], [3, 5, 26], [4, 6], // 3-5
  [5, 7, 14], [6, 8, 9], [7], [7, 14], // 6-9
  [0, 11], [10, 12, 26, 27], [11, 13, 28], [12, 14, 15, 28], // 10-13
  [13, 7, 9], [13, 20, 22], // 14-15
  [17, 27], [16, 18, 27], [17, 19], // 16-18
  [18, 20, 15], [19, 21, 22], [20], [20, 15], // 19-22
  [24, 25, 13], [23, 14], [23, 15], // 23-25
  [1, 4, 11], [2, 17, 11], // 26-27
  [12, 13], // 28
];

export function nearestNode(x, z) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < NODES.length; i += 1) {
    const dx = NODES[i][0] - x;
    const dz = NODES[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function heuristic(a, b) {
  return Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
}

// A* over the graph. Returns node ids from start to goal (inclusive), or [].
export function findPath(start, goal) {
  if (start === goal) return [start];
  const open = [start];
  const cameFrom = new Array(NODES.length).fill(-1);
  const gScore = new Array(NODES.length).fill(Infinity);
  const fScore = new Array(NODES.length).fill(Infinity);
  gScore[start] = 0;
  fScore[start] = heuristic(start, goal);
  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]] < fScore[open[bestIndex]]) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];
    if (current === goal) {
      const path = [current];
      let node = current;
      while (cameFrom[node] !== -1) { node = cameFrom[node]; path.unshift(node); }
      return path;
    }
    for (const next of EDGES[current]) {
      const tentative = gScore[current] + heuristic(current, next);
      if (tentative < gScore[next]) {
        cameFrom[next] = current;
        gScore[next] = tentative;
        fScore[next] = tentative + heuristic(next, goal);
        if (!open.includes(next)) open.push(next);
      }
    }
  }
  return [];
}

// Attack routes (Arunika, from the south spawn). The carrier always walks with
// the biggest group; weights are picked per round in bots.js.
export const ATTACK_ROUTES = {
  rushA: { weight: 0.3, path: [3, 4, 5, 6, 7] },
  rushB: { weight: 0.3, path: [16, 17, 18, 19, 20] },
  splitA: { weight: 0.125, path: [3, 4, 5, 6, 7] },
  splitB: { weight: 0.125, path: [16, 17, 18, 19, 20] },
  midA: { weight: 0.075, path: [10, 11, 12, 13, 14, 7] },
  midB: { weight: 0.075, path: [10, 11, 12, 13, 15, 20] },
};

// Defence holds (Meridian): 2 on A, 2 on B, 1 on Mid.
export const DEFENCE_POSTS = { A: [8, 9], B: [21, 22], MID: [28] };

export const SPAWN_NODES = { arunika: [0, 1, 2], meridian: [23, 24, 25] };
export const SITE_NODES = { A: 7, B: 20 };
export const SITE_CENTERS = { A: [-20, -15], B: [20, -15] };
