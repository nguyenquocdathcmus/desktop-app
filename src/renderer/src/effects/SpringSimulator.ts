/**
 * Critically-damped spring simulator.
 * k=200, b=28 — tuned to match Screen Studio's cinematic feel.
 */
export interface SpringState {
  position: number
  velocity: number
}

export function springStep(
  current: number,
  target: number,
  velocity: number,
  dt: number,
  k = 200,
  b = 28
): SpringState {
  const force = -k * (current - target) - b * velocity
  const newVelocity = velocity + force * dt
  const newPosition = current + newVelocity * dt
  return { position: newPosition, velocity: newVelocity }
}

export interface Spring2DState {
  x: number
  y: number
  vx: number
  vy: number
}

export function spring2DStep(
  state: Spring2DState,
  targetX: number,
  targetY: number,
  dt: number,
  k = 200,
  b = 28
): Spring2DState {
  const sx = springStep(state.x, targetX, state.vx, dt, k, b)
  const sy = springStep(state.y, targetY, state.vy, dt, k, b)
  return { x: sx.position, y: sy.position, vx: sx.velocity, vy: sy.velocity }
}

/** Settle threshold — spring is done when delta < epsilon */
export function isSettled(state: SpringState, target: number, epsilon = 0.001): boolean {
  return Math.abs(state.position - target) < epsilon && Math.abs(state.velocity) < epsilon
}
