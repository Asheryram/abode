/**
 * Shrink a photo before uploading it. Phone photos are often 4–8 MB; at
 * 1600px on the long side and 80% JPEG they drop to about 200 KB and still
 * look sharp on a listing page.
 */
export async function resizeImage(file: File, maxSize = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name} could not be read. Try a JPG or PNG.`)
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not process this image.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`${file.name} could not be processed.`))),
      'image/jpeg',
      quality,
    ),
  )
}
