/**
 * Force-Directed Layout Algorithm for Decenter Worry Tree
 * 
 * Arranges active nodes on the canvas to prevent overlap while maintaining
 * the structured, geometric Bauhaus aesthetic:
 * 1. Repulsion force between overlapping or crowded bounding boxes
 * 2. Spring attraction along directional connecting edges
 * 3. Left-to-right causal monotonicity constraint (children follow parents)
 * 4. Architectural lane snapping (main sequence, upper action, lower acceptance)
 * 5. Bauhaus 24px grid alignment
 */

export interface NodeLayoutItem {
  id: string;
  x: number;      // left position
  y: number;      // top position
  width: number;
  height: number;
  order: number;
  tier: 'main' | 'upper' | 'lower';
}

export interface NodeEdgeItem {
  source: string;
  target: string;
  label: { step: string; action: string };
}

export const BASE_NODE_SPECS: Record<string, { width: number; height: number; order: number; tier: 'main' | 'upper' | 'lower'; defaultY: number }> = {
  seed: { width: 460, height: 320, order: 0, tier: 'main', defaultY: 220 },
  context: { width: 460, height: 260, order: 1, tier: 'main', defaultY: 220 },
  situation: { width: 460, height: 260, order: 2, tier: 'main', defaultY: 220 },
  reframe: { width: 480, height: 320, order: 3, tier: 'main', defaultY: 220 },
  agency: { width: 420, height: 260, order: 4, tier: 'main', defaultY: 220 },
  // NO Branch (Lower Tier)
  emotional_freedom: { width: 480, height: 300, order: 5, tier: 'lower', defaultY: 500 },
  grounding: { width: 460, height: 440, order: 6, tier: 'lower', defaultY: 480 },
  // YES Branch (Upper Tier)
  w1: { width: 460, height: 280, order: 5, tier: 'upper', defaultY: 60 },
  w2: { width: 460, height: 280, order: 6, tier: 'upper', defaultY: 60 },
  w3: { width: 420, height: 260, order: 7, tier: 'upper', defaultY: 60 },
  final_scheduled: { width: 460, height: 460, order: 8, tier: 'lower', defaultY: 460 },
  // Terminal Closure Node
  closure: { width: 520, height: 360, order: 9, tier: 'main', defaultY: 220 },
};

const GRID_SIZE = 24; // 24px Bauhaus millimeter grid
const MIN_HORIZONTAL_GAP = 264; // Guaranteed breathing space between cards
const MIN_VERTICAL_GAP = 60;

/**
 * Runs a force-directed relaxation pass on the active nodes.
 * Preserves Bauhaus geometric structure and left-to-right directionality.
 */
export function runForceDirectedLayout(
  activeNodeIds: string[],
  currentPositions?: Record<string, { x: number; y: number }>,
  customTierOverrides?: Record<string, 'main' | 'upper' | 'lower'>
): Record<string, { x: number; y: number; width: number; height: number }> {
  // Sort active nodes by their logical order
  const nodes: NodeLayoutItem[] = activeNodeIds
    .filter((id) => BASE_NODE_SPECS[id])
    .map((id) => {
      const spec = BASE_NODE_SPECS[id];
      const tier = customTierOverrides?.[id] || spec.tier;
      const initialPos = currentPositions?.[id];
      
      // Default X fallback based on order
      const initialX = initialPos?.x !== undefined 
        ? initialPos.x 
        : 100 + spec.order * (460 + MIN_HORIZONTAL_GAP);
      const initialY = initialPos?.y !== undefined 
        ? initialPos.y 
        : spec.defaultY;

      return {
        id,
        x: initialX,
        y: initialY,
        width: spec.width,
        height: spec.height,
        order: spec.order,
        tier,
      };
    })
    .sort((a, b) => a.order - b.order);

  if (nodes.length === 0) return {};

  const iterations = 40;
  const damping = 0.85;

  // Velocity buffers
  const vx: Record<string, number> = {};
  const vy: Record<string, number> = {};
  nodes.forEach((n) => {
    vx[n.id] = 0;
    vy[n.id] = 0;
  });

  // Force-directed relaxation loop
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Repulsion forces between all pairs of nodes to eliminate bounding box overlaps
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const centerAx = nodeA.x + nodeA.width / 2;
        const centerAy = nodeA.y + nodeA.height / 2;
        const centerBx = nodeB.x + nodeB.width / 2;
        const centerBy = nodeB.y + nodeB.height / 2;

        const dx = centerBx - centerAx;
        const dy = centerBy - centerAy;

        const reqDistX = (nodeA.width + nodeB.width) / 2 + MIN_HORIZONTAL_GAP;
        const reqDistY = (nodeA.height + nodeB.height) / 2 + MIN_VERTICAL_GAP;

        // Check if nodes are in proximity
        if (Math.abs(dx) < reqDistX && Math.abs(dy) < reqDistY) {
          const overlapX = reqDistX - Math.abs(dx);
          const overlapY = reqDistY - Math.abs(dy);

          // Strong repulsion along the axis of minimum displacement
          const forceX = (overlapX / reqDistX) * 18;
          const forceY = (overlapY / reqDistY) * 12;

          const signX = dx >= 0 ? 1 : -1;
          const signY = dy >= 0 ? 1 : -1;

          vx[nodeB.id] += forceX * signX;
          vx[nodeA.id] -= forceX * signX;

          // Only repel vertically if they belong to different tiers or need vertical separation
          if (nodeA.tier !== nodeB.tier) {
            vy[nodeB.id] += forceY * signY;
            vy[nodeA.id] -= forceY * signY;
          }
        }
      }
    }

    // 2. Hierarchical lane anchor forces (keeps Bauhaus architectural alignment)
    for (const node of nodes) {
      let targetY = BASE_NODE_SPECS[node.id]?.defaultY ?? 220;
      if (node.tier === 'upper') targetY = 60;
      if (node.tier === 'lower') targetY = 480;

      const dyLane = targetY - node.y;
      vy[node.id] += dyLane * 0.15; // Spring toward architectural lane
    }

    // 3. Left-to-right monotonic order constraint
    // Child node must never sit to the left of its predecessor in the chain
    for (let i = 0; i < nodes.length - 1; i++) {
      const prev = nodes[i];
      const next = nodes[i + 1];

      // If they are sequential along the same path, maintain minimum spacing
      const minLeftForNext = prev.x + prev.width + MIN_HORIZONTAL_GAP;
      if (next.x < minLeftForNext) {
        const pushDelta = minLeftForNext - next.x;
        vx[next.id] += pushDelta * 0.4;
      }
    }

    // 4. Root node anchor: Seed node stays grounded around left=100
    if (nodes[0]?.id === 'seed') {
      const anchorDelta = 100 - nodes[0].x;
      vx['seed'] += anchorDelta * 0.25;
    }

    // 5. Update positions with damping
    for (const node of nodes) {
      node.x += vx[node.id];
      node.y += vy[node.id];

      vx[node.id] *= damping;
      vy[node.id] *= damping;

      // Prevent negative canvas coordinates
      if (node.x < 60) node.x = 60;
      if (node.y < 40) node.y = 40;
    }
  }

  // Final pass: Snap to clean 24px Bauhaus grid
  const result: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const node of nodes) {
    const snappedX = Math.round(node.x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(node.y / GRID_SIZE) * GRID_SIZE;

    result[node.id] = {
      x: Math.max(snappedX, 60),
      y: Math.max(snappedY, 40),
      width: node.width,
      height: node.height,
    };
  }

  return result;
}
