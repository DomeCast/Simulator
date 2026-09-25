import { MathUtils, Vector3 } from 'three'
import type { SourceOrientation, SourceProjection } from './types'

const TWO_PI = Math.PI * 2
const HALF_PI = Math.PI / 2
/** Accept 1:1 and 2:1 with a little encoder / crop slack. */
const ASPECT_TOLERANCE = 0.05

function rotateAroundX(vector: Vector3, radians: number): void {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { y, z } = vector
  vector.y = cos * y - sin * z
  vector.z = sin * y + cos * z
}

function rotateAroundY(vector: Vector3, radians: number): void {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { x, z } = vector
  vector.x = cos * x + sin * z
  vector.z = -sin * x + cos * z
}

function rotateAroundZ(vector: Vector3, radians: number): void {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { x, y } = vector
  vector.x = cos * x - sin * y
  vector.y = sin * x + cos * y
}

function applyOrientation(
  direction: Vector3,
  orientation: SourceOrientation,
): Vector3 {
  // The convex mirror reverses handedness, so sample the source mirrored in X
  // to keep left/right correct once the beam lands on the dome.
  const rotated = direction.clone().normalize()
  rotated.x = -rotated.x
  if (
    orientation.yaw !== 0
    || orientation.pitch !== 0
    || orientation.roll !== 0
  ) {
    // Inverse of the viewer orientation: rotate the lookup direction opposite
    // the yaw/pitch/roll applied to the source.
    rotateAroundZ(rotated, -MathUtils.degToRad(orientation.yaw))
    rotateAroundX(rotated, -MathUtils.degToRad(orientation.pitch))
    rotateAroundY(rotated, -MathUtils.degToRad(orientation.roll))
  }
  return rotated
}

/**
 * Elevation of a dome direction relative to the configured source horizon, in
 * radians. Negative below the horizon, zero on it.
 */
export function horizonElevationOffset(
  direction: Vector3,
  horizonLift = 0,
): number {
  const normal = direction.clone().normalize()
  const elevation = Math.asin(MathUtils.clamp(normal.z, -1, 1))
  return elevation - MathUtils.degToRad(horizonLift)
}

/**
 * True when a dome direction lies on or above the configured source horizon.
 */
export function isDirectionAboveHorizon(
  direction: Vector3,
  horizonLift = 0,
): boolean {
  return horizonElevationOffset(direction, horizonLift) + 1e-7 >= 0
}

/**
 * Expands the source hemisphere over the dome cap above the lifted horizon.
 * Azimuth and zenith stay fixed; only elevation is remapped.
 */
function remapForHorizon(direction: Vector3, horizonLift: number): Vector3 {
  const normal = direction.clone().normalize()
  const elevation = Math.asin(MathUtils.clamp(normal.z, -1, 1))
  const lift = MathUtils.clamp(MathUtils.degToRad(horizonLift), 0, HALF_PI - 1e-4)
  const sourceElevation =
    MathUtils.clamp((elevation - lift) / (HALF_PI - lift), 0, 1) * HALF_PI
  const horizontalLength = Math.hypot(normal.x, normal.y)

  if (horizontalLength < 1e-7) return new Vector3(0, 0, 1)

  const sourceHorizontal = Math.cos(sourceElevation)
  return new Vector3(
    (normal.x / horizontalLength) * sourceHorizontal,
    (normal.y / horizontalLength) * sourceHorizontal,
    Math.sin(sourceElevation),
  )
}

/**
 * Angular span from zenith of source content that is stretched across the full
 * dome hemisphere (0–90°). Default `90` keeps a 1:1 zenith→horizon mapping.
 * Fisheye masters stop at the horizon (`≤ 90°`); equirectangular can include
 * content below the geometric horizon (`≤ 180°`) and squeeze it into the dome.
 */
export function effectiveSourceFovDegrees(
  sourceFov: number,
  projection: SourceProjection,
): number {
  const max = projection === 'fisheye' ? 90 : 180
  const value = Number.isFinite(sourceFov) ? sourceFov : 90
  return MathUtils.clamp(value, 1, max)
}

/**
 * Maps a dome polar angle (0 at zenith … π/2 at the rim) onto the configured
 * source span from zenith. Values above 90° reach below the source horizon.
 */
function sourcePolarFromDomePolar(
  domePolar: number,
  sourceFovDegrees: number,
  projection: SourceProjection,
): number {
  const span = MathUtils.degToRad(effectiveSourceFovDegrees(sourceFovDegrees, projection))
  return domePolar * (span / HALF_PI)
}

/**
 * Infers source layout from pixel aspect. `1:1` → hemispherical fisheye,
 * `2:1` → equirectangular; anything else is rejected.
 */
export function detectSourceProjection(
  width: number,
  height: number,
): SourceProjection | null {
  const ratio = width / Math.max(1, height)
  if (Math.abs(ratio - 1) <= ASPECT_TOLERANCE) return 'fisheye'
  if (Math.abs(ratio - 2) <= ASPECT_TOLERANCE) return 'equirectangular'
  return null
}

/** Paul Bourke warp-mesh type digit for a source projection. */
export function warpMeshTypeForProjection(projection: SourceProjection): number {
  return projection === 'fisheye' ? 2 : 4
}

/**
 * Converts a world-space dome direction into equirectangular UV coordinates.
 *
 * The upper half of the 2:1 image covers the hemisphere: `v = 1` is zenith
 * (top edge) and `v = 0.5` is the horizon (middle row). The image centre
 * (`u = 0.5`) faces the dome front (`+Y`). The X-mirror in `applyOrientation`
 * is undone on U so left/right still read correctly after the convex mirror.
 *
 * `sourceFov` is the zenith→content span in degrees (1–180). At 90° the dome
 * horizon samples the image horizon; larger values squeeze content from below
 * the geometric horizon into the dome, smaller values stretch a zenith cap.
 */
export function directionToEquirectUV(
  direction: Vector3,
  orientation: SourceOrientation = { yaw: 0, pitch: 0, roll: 0 },
  horizonLift = 0,
  sourceFov = 90,
): { u: number; v: number } {
  const rotated = applyOrientation(remapForHorizon(direction, horizonLift), orientation)
  const longitude = Math.atan2(rotated.x, rotated.y)
  const domePolar = Math.acos(MathUtils.clamp(rotated.z, -1, 1))
  const sourcePolar = sourcePolarFromDomePolar(
    domePolar,
    sourceFov,
    'equirectangular',
  )
  const sourceElevation = HALF_PI - sourcePolar
  const u = MathUtils.euclideanModulo(0.5 - longitude / TWO_PI, 1)
  const v = 0.5 + sourceElevation / Math.PI
  return { u, v }
}

/**
 * Angular fisheye for a square fulldome master: zenith at the image centre,
 * horizon (dome base) on the inscribed circle that touches the mid-edges.
 * Dome front (`+Y`) samples the bottom of the frame, matching the usual
 * fulldome layout so a 180° yaw is not needed at load.
 *
 * `sourceFov` is the zenith→content span in degrees (1–90). At 90° the dome
 * horizon sits on the mid-edge circle; smaller values stretch a zenith cap
 * (e.g. 80°) down to the dome rim.
 */
export function directionToFisheyeUV(
  direction: Vector3,
  orientation: SourceOrientation = { yaw: 0, pitch: 0, roll: 0 },
  horizonLift = 0,
  sourceFov = 90,
): { u: number; v: number } {
  const rotated = applyOrientation(remapForHorizon(direction, horizonLift), orientation)
  const azimuth = Math.atan2(rotated.x, rotated.y)
  const domePolar = Math.acos(MathUtils.clamp(rotated.z, -1, 1))
  const sourcePolar = sourcePolarFromDomePolar(domePolar, sourceFov, 'fisheye')
  // 180° diameter image: source polar π/2 → radius 0.5 (mid-edge of the square).
  const radius = sourcePolar / Math.PI
  const u = 0.5 - radius * Math.sin(azimuth)
  const v = 0.5 - radius * Math.cos(azimuth)
  return { u, v }
}

/** Samples a dome direction in the active source projection. */
export function directionToSourceUV(
  direction: Vector3,
  projection: SourceProjection,
  orientation: SourceOrientation = { yaw: 0, pitch: 0, roll: 0 },
  horizonLift = 0,
  sourceFov = 90,
): { u: number; v: number } {
  return projection === 'fisheye'
    ? directionToFisheyeUV(direction, orientation, horizonLift, sourceFov)
    : directionToEquirectUV(direction, orientation, horizonLift, sourceFov)
}

export function formatMeshNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Object.is(value, -0)) return '0'
  const rounded = Number(value.toPrecision(6))
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}
