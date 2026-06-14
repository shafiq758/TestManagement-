import { createClient } from '@/lib/supabase'

const MAX_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS]

export type UploadResult = { url: string; name: string; type: 'image' | 'video' }

export function validateFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) {
    return `File type not supported. Allowed: JPG, PNG, GIF, WebP, MP4, WebM, MOV`
  }
  if (file.size > MAX_SIZE) {
    return `File too large. Maximum size is 25MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`
  }
  return null
}

export async function uploadFile(file: File, folder: string = 'bugs'): Promise<UploadResult> {
  const error = validateFile(file)
  if (error) throw new Error(error)

  const sb = createClient()
  const ext = file.name.split('.').pop()
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error: uploadErr } = await sb.storage
    .from('attachments')
    .upload(filename, file, { contentType: file.type, upsert: false })

  if (uploadErr) throw new Error(uploadErr.message)

  const { data: { publicUrl } } = sb.storage
    .from('attachments')
    .getPublicUrl(data.path)

  return {
    url: publicUrl,
    name: file.name,
    type: ALLOWED_IMAGES.includes(file.type) ? 'image' : 'video',
  }
}

export async function uploadFiles(files: File[], folder: string = 'bugs'): Promise<UploadResult[]> {
  return Promise.all(files.map(f => uploadFile(f, folder)))
}

// v3
// v3