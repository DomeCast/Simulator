import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  detectSourceProjection,
  directionToEquirectUV,
  directionToFisheyeUV,
  formatMeshNumber,
  isDirectionAboveHorizon,
  warpMeshTypeForProjection,
} from './equirect'
import {
  buildWarpMesh,
  expandGridBounds,
  getExportGridBounds,
  getUsableRayGridBounds,
  pathLengthIntensity,
  rayPathLength,
  sanitizeMeshFilename,
  scaleGridBounds,
  serializeWarpMesh,
  tightenGridBounds,
  WARP_MESH_COLUMNS,
  WARP_MESH_ROWS,
  WARP_MESH_TYPE,
} from './warpMesh'
import type { SimulationParameters } from './types'

const parameters: SimulationParameters = {
  domeDiameter: 10,
  springlineHeight: 0,
  horizonLift: 0,
  sourceFov: 360,
  domeInteriorColor: '#11053b',
  mirrorDiameter: 1.3,
  mirrorHeight: 1.15,
  mirrorPitch: 0,
  projectorDistance: 0.51,
  projectorHeight: 1.15,
  projectorPitch: 0,
  lensShiftVertical: 0,
  lensShiftHorizontal: 0,
  projectorFov: 54,
  aspectRatio: '16:9',
  gridColumns: 32,
  gridRows: 18,
}

describe('equirectangular mapping', () => {
  it('maps the dome front to the panorama centre on the horizon', () => {
    const front = directionToEquirectUV(new Vector3(0, 1, 0))
    const back = directionToEquirectUV(new Vector3(0, -1, 0))
    expect(front.v).toBeCloseTo(0.5)
    expect(back.v).toBeCloseTo(0.5)
    expect(front.u).toBeCloseTo(0.5)
    expect(Math.min(back.u, 1 - back.u)).toBeCloseTo(0)
  })

  it('maps zenith to the top of the image so the dome uses the upper half', () => {
    const zenith = directionToEquirectUV(new Vector3(0, 0, 1))
    const horizon = directionToEquirectUV(new Vector3(0, 1, 0))
    expect(zenith.v).toBeCloseTo(1)
    expect(horizon.v).toBeCloseTo(0.5)
    expect(zenith.v).toBeGreaterThan(horizon.v)
  })

  it('starts equirectangular sources upright without user pitch', () => {
    const zenith = directionToEquirectUV(new Vector3(0, 0, 1))
    const manualPitch = directionToEquirectUV(new Vector3(0, 0, 1), {
      yaw: 0,
      pitch: 180,
      roll: 0,
    })

    // A user pitch of 180 now moves away from the default, rather than into it.
    expect(zenith.v).toBeCloseTo(1)
    expect(manualPitch.v).toBeCloseTo(0)
  })

  it('rotates longitude when yaw is applied', () => {
    const baseline = directionToEquirectUV(new Vector3(0, 1, 0))
    const yawed = directionToEquirectUV(new Vector3(0, 1, 0), {
      yaw: 90,
      pitch: 0,
      roll: 0,
    })
    expect(yawed.u).not.toBeCloseTo(baseline.u)
    expect(yawed.v).toBeCloseTo(baseline.v, 3)
  })

  it('samples mirrored in longitude so the reflected image reads correctly', () => {
    const domeRight = directionToEquirectUV(new Vector3(1, 0, 0))
    const domeLeft = directionToEquirectUV(new Vector3(-1, 0, 0))

    expect(domeRight.u).toBeCloseTo(0.75)
    expect(domeLeft.u).toBeCloseTo(0.25)
  })
})

describe('lifted source horizon', () => {
  const atElevation = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return new Vector3(0, Math.cos(radians), Math.sin(radians))
  }

  it('maps the configured elevation to the source horizon', () => {
    const uv = directionToEquirectUV(
      atElevation(30),
      { yaw: 0, pitch: 0, roll: 0 },
      30,
    )
    expect(uv.u).toBeCloseTo(0.5)
    expect(uv.v).toBeCloseTo(0.5)
  })

  it('stretches the remaining dome cap while keeping the zenith fixed', () => {
    const midpoint = directionToEquirectUV(
      atElevation(60),
      { yaw: 0, pitch: 0, roll: 0 },
      30,
    )
    const zenith = directionToEquirectUV(
      atElevation(90),
      { yaw: 0, pitch: 0, roll: 0 },
      30,
    )
    expect(midpoint.v).toBeCloseTo(0.75)
    expect(zenith.v).toBeCloseTo(1)
  })

  it('identifies dome directions below the lifted horizon', () => {
    expect(isDirectionAboveHorizon(atElevation(29), 30)).toBe(false)
    expect(isDirectionAboveHorizon(atElevation(30), 30)).toBe(true)
  })
})

describe('source field of view', () => {
  it('keeps full equirect width at 360°', () => {
    const right = directionToEquirectUV(new Vector3(1, 0, 0), undefined, 0, 360)
    expect(right.u).toBeCloseTo(0.75)
  })

  it('stretches a 180° equirect crop across the full dome azimuth', () => {
    const right = directionToEquirectUV(new Vector3(1, 0, 0), undefined, 0, 180)
    // Dome +X (90°) maps to the right edge of a 180° source.
    expect(right.u).toBeCloseTo(0)
  })

  it('zooms fisheye in when source FOV is narrower than 180°', () => {
    const horizon = directionToFisheyeUV(new Vector3(0, 1, 0), undefined, 0, 90)
    // polar π/2 with FOV π/2 → radius 1 (outside the mid-edge circle).
    expect(horizon.v).toBeCloseTo(-0.5)
  })
})

describe('source projection detection', () => {
  it('treats square images as fisheye and 2:1 as equirectangular', () => {
    expect(detectSourceProjection(2048, 2048)).toBe('fisheye')
    expect(detectSourceProjection(4096, 2048)).toBe('equirectangular')
    expect(detectSourceProjection(1920, 1080)).toBeNull()
  })

  it('maps Bourke mesh types for each projection', () => {
    expect(warpMeshTypeForProjection('fisheye')).toBe(2)
    expect(warpMeshTypeForProjection('equirectangular')).toBe(4)
  })
})

describe('fisheye mapping', () => {
  it('places zenith at the image centre', () => {
    const uv = directionToFisheyeUV(new Vector3(0, 0, 1))
    expect(uv.u).toBeCloseTo(0.5)
    expect(uv.v).toBeCloseTo(0.5)
  })

  it('places the dome front on the bottom mid-edge at the horizon', () => {
    const uv = directionToFisheyeUV(new Vector3(0, 1, 0))
    expect(uv.u).toBeCloseTo(0.5)
    expect(uv.v).toBeCloseTo(0)
  })

  it('starts with the front at the bottom so a 180° yaw is not the default', () => {
    const front = directionToFisheyeUV(new Vector3(0, 1, 0))
    const yawed = directionToFisheyeUV(new Vector3(0, 1, 0), {
      yaw: 180,
      pitch: 0,
      roll: 0,
    })
    expect(front.v).toBeCloseTo(0)
    expect(yawed.v).toBeCloseTo(1)
  })

  it('samples mirrored in azimuth so the reflected image reads correctly', () => {
    const domeRight = directionToFisheyeUV(new Vector3(1, 0, 0))
    const domeLeft = directionToFisheyeUV(new Vector3(-1, 0, 0))

    expect(domeRight.u).toBeCloseTo(1)
    expect(domeLeft.u).toBeCloseTo(0)
  })
})

describe('usable mesh bounds', () => {
  it('derives a bounding box from mapped rays only', () => {
    const mesh = buildWarpMesh(parameters)
    expect(mesh.bounds).not.toBeNull()
    expect(mesh.bounds!.maxColumn).toBeGreaterThan(mesh.bounds!.minColumn)
    expect(mesh.bounds!.maxRow).toBeGreaterThan(mesh.bounds!.minRow)
  })

  it('scales bounds between grid resolutions', () => {
    const mesh = buildWarpMesh(parameters)
    const scaled = scaleGridBounds(mesh.bounds!, 100, 60, 64, 36)
    expect(scaled.minColumn).toBeGreaterThanOrEqual(0)
    expect(scaled.maxColumn).toBeLessThan(64)
    expect(expandGridBounds(scaled, 64, 36).minColumn).toBeGreaterThanOrEqual(0)
  })
})

describe('warp mesh export', () => {
  it('writes a cropped rectangular Bourke mesh header and node count', () => {
    const mesh = buildWarpMesh(parameters)
    const text = serializeWarpMesh(mesh)
    const lines = text.trimEnd().split('\n')

    expect(mesh.type).toBe(WARP_MESH_TYPE)
    expect(mesh.nodes).toHaveLength(mesh.columns * mesh.rows)
    expect(mesh.columns).toBeGreaterThan(0)
    expect(mesh.rows).toBeGreaterThan(0)
    expect(mesh.columns * mesh.rows).toBeLessThan(WARP_MESH_COLUMNS * WARP_MESH_ROWS)
    expect(lines[0]).toBe('4')
    expect(lines[1]).toBe(`${mesh.columns} ${mesh.rows}`)
    expect(lines).toHaveLength(2 + mesh.columns * mesh.rows)
  })

  it('tags fisheye exports as Bourke type 2', () => {
    const mesh = buildWarpMesh(parameters, { sourceProjection: 'fisheye' })
    expect(mesh.type).toBe(2)
    expect(serializeWarpMesh(mesh).split('\n')[0]).toBe('2')
  })

  it('excludes projector nodes below a lifted source horizon', () => {
    const baseline = buildWarpMesh(parameters)
    const lifted = buildWarpMesh({ ...parameters, horizonLift: 30 })
    const baselineMapped = baseline.nodes.filter((node) => node.intensity >= 0)
    const liftedMapped = lifted.nodes.filter((node) => node.intensity >= 0)

    expect(liftedMapped.length).toBeLessThan(baselineMapped.length)
  })

  it('emits a regular projector grid in row-major order', () => {
    const mesh = buildWarpMesh(parameters)
    const aspect = 16 / 9
    const first = mesh.nodes[0]
    const last = mesh.nodes[mesh.nodes.length - 1]
    const second = mesh.nodes[1]

    expect(first.y).toBeLessThanOrEqual(last.y)
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBeCloseTo(first.y)
    expect(first.x).toBeGreaterThanOrEqual(-aspect)
    expect(last.x).toBeLessThanOrEqual(aspect)
  })

  it('masks invalid projector nodes with negative intensity', () => {
    const mesh = buildWarpMesh({
      ...parameters,
      projectorFov: 10,
      projectorDistance: 3.5,
    })
    expect(mesh.nodes.some((node) => node.intensity < 0)).toBe(true)
    expect(
      mesh.nodes.every(
        (node) =>
          (node.intensity > 0 && node.intensity <= 1 && node.u >= 0 && node.u <= 1)
          || node.intensity === -1,
      ),
    ).toBe(true)
  })

  it('sets intensity from normalised projector-to-dome path length', () => {
    const mesh = buildWarpMesh(parameters)
    const mapped = mesh.nodes.filter((node) => node.intensity > 0)
    expect(mapped.length).toBeGreaterThan(1)
    expect(Math.max(...mapped.map((node) => node.intensity))).toBeCloseTo(1)
    expect(Math.min(...mapped.map((node) => node.intensity))).toBeLessThan(1)
  })

  it('computes path length along mirror reflection', () => {
    const ray = {
      column: 0,
      row: 0,
      origin: new Vector3(0, -1.5, 1.15),
      direction: new Vector3(0, 1, 0),
      mirrorHit: new Vector3(0, -0.5, 1.5),
      domeHit: new Vector3(0, 4, 2),
      reflectedDirection: new Vector3(0, 1, 0.2),
      status: 'valid' as const,
    }
    expect(rayPathLength(ray)).toBeCloseTo(ray.origin.distanceTo(ray.mirrorHit!) + ray.mirrorHit!.distanceTo(ray.domeHit!))
    expect(pathLengthIntensity(8, 10)).toBeCloseTo(0.8)
    expect(pathLengthIntensity(10, 10)).toBeCloseTo(1)
  })

  it('can include chassis-occluded rays in the mesh', () => {
    const excluded = buildWarpMesh(parameters, { includeOccluded: false })
    const included = buildWarpMesh(parameters, { includeOccluded: true })
    const excludedLive = excluded.nodes.filter((node) => node.intensity > 0)
    const includedLive = included.nodes.filter((node) => node.intensity > 0)

    expect(includedLive.length).toBeGreaterThanOrEqual(excludedLive.length)
  })

  it('produces finite deterministic output for a fixed setup', () => {
    const first = serializeWarpMesh(buildWarpMesh(parameters))
    const second = serializeWarpMesh(buildWarpMesh(parameters))
    expect(first).toBe(second)
    expect(first.split('\n').slice(2, -1).every((line) => {
      const values = line.split('\t').map(Number)
      return values.length === 5 && values.every(Number.isFinite)
    })).toBe(true)
  })

  it('formats numbers without negative zero', () => {
    expect(formatMeshNumber(-0)).toBe('0')
    expect(formatMeshNumber(1.7777777)).toBe('1.77778')
  })

  it('sanitises download filenames', () => {
    expect(sanitizeMeshFilename('Hall A')).toBe('hall_a.data')
    expect(sanitizeMeshFilename('   ')).toBe('domecast_equirect.data')
  })

  it('returns null bounds when no rays are usable', () => {
    expect(getUsableRayGridBounds([], false)).toBeNull()
    expect(getExportGridBounds([], false)).toBeNull()
  })

  it('removes outer rows and columns that contain no mapped cells', () => {
    const usable = new Set(['2:1', '3:2'])
    const tightened = tightenGridBounds(
      { minColumn: 0, maxColumn: 3, minRow: 0, maxRow: 2 },
      usable,
    )
    expect(tightened).toEqual({ minColumn: 2, maxColumn: 3, minRow: 1, maxRow: 2 })
  })

  it('keeps internal empty rows needed for grid adjacency', () => {
    const usable = new Set(['1:0', '1:2'])
    const tightened = tightenGridBounds(
      { minColumn: 1, maxColumn: 1, minRow: 0, maxRow: 2 },
      usable,
    )
    expect(tightened).toEqual({ minColumn: 1, maxColumn: 1, minRow: 0, maxRow: 2 })
  })
})
