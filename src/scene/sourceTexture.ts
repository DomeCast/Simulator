import {
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'
import { detectSourceProjection } from '../simulation/equirect'
import type { SourceProjection } from '../simulation/types'

/**
 * Decode a fulldome source so Chrome and Safari sample the same pixels.
 *
 * Safari ignores `UNPACK_FLIP_Y_WEBGL` on some sRGB uploads, and it applies
 * JPEG EXIF orientation to `<img>` textures while Chrome's WebGL path does
 * not. Either difference spins an equirect by 180°. This path reads the file
 * in pixel order and bakes the OpenGL Y-flip into a canvas so `v = 1` is the
 * top row in every browser.
 */
export async function createSourceTexture(file: File): Promise<{
  texture: Texture
  width: number
  height: number
  projection: SourceProjection
}> {
  const bitmap = await decodeSourceBitmap(file)
  const { width, height } = bitmap
  const projection = detectSourceProjection(width, height)
  if (!projection) {
    bitmap.close()
    throw new Error('INVALID_SOURCE_ASPECT')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context =
    canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' }) ??
    canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    throw new Error('SOURCE_CANVAS')
  }

  context.translate(0, height)
  context.scale(1, -1)
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const texture = new Texture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.wrapS =
    projection === 'equirectangular' ? RepeatWrapping : ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true

  return { texture, width, height, projection }
}

async function decodeSourceBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, {
      // Keep the stored pixel grid. EXIF rotation is a 2D tag, not part of
      // the spherical layout, and Safari/Chrome disagree on whether to honour it.
      imageOrientation: 'none',
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })
  } catch {
    return createImageBitmap(file)
  }
}
