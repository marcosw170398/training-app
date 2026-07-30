import Dexie from 'dexie'
import { db } from '../db'
import type { Id, SessionPhoto } from '../schema'
import { newId } from '@/lib/id'
import { reduzirImagem } from '@/lib/image'

export async function addSessionPhoto(input: {
  profileId: Id
  sessionId: Id
  dateKey: string
  file: File | Blob
}): Promise<SessionPhoto> {
  const reduzida = await reduzirImagem(input.file)

  const foto: SessionPhoto = {
    id: newId(),
    profileId: input.profileId,
    sessionId: input.sessionId,
    dateKey: input.dateKey,
    blob: reduzida.blob,
    width: reduzida.width,
    height: reduzida.height,
    createdAt: Date.now(),
  }
  await db.sessionPhotos.add(foto)
  return foto
}

export function listPhotosOfSession(sessionId: Id): Promise<SessionPhoto[]> {
  return db.sessionPhotos.where('sessionId').equals(sessionId).sortBy('createdAt')
}

/** Fotos de um intervalo de dias — alimenta o calendário. */
export function listPhotosBetween(
  profileId: Id,
  fromDateKey: string,
  toDateKey: string,
): Promise<SessionPhoto[]> {
  return db.sessionPhotos
    .where('[profileId+dateKey]')
    .between([profileId, fromDateKey], [profileId, toDateKey], true, true)
    .toArray()
}

export async function deletePhoto(id: Id): Promise<void> {
  await db.sessionPhotos.delete(id)
}

/** Quanto as fotos ocupam — mostrado nos ajustes, já que a cota é do navegador. */
export async function photosFootprint(profileId: Id): Promise<{ count: number; bytes: number }> {
  const fotos = await db.sessionPhotos
    .where('[profileId+dateKey]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .toArray()
  return {
    count: fotos.length,
    bytes: fotos.reduce((soma, foto) => soma + foto.blob.size, 0),
  }
}
