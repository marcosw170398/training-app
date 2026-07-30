import { useEffect, useRef, useState } from 'react'
import type { Id } from '@/db/schema'
import { addSessionPhoto } from '@/db/repositories/photos.repo'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'

/**
 * Oferecida ao encerrar o treino.
 *
 * A foto é opcional de propósito: sem ela o dia continua marcado como treinado
 * no calendário. `capture="environment"` faz o celular abrir a câmera direto,
 * em vez da galeria.
 */
export function SessionPhotoSheet({
  open,
  profileId,
  sessionId,
  dateKey,
  onDone,
}: {
  open: boolean
  profileId: Id
  sessionId: Id
  dateKey: string
  /** Chamada tanto ao salvar quanto ao pular. */
  onDone: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // O objectURL segura memória até ser revogado.
  useEffect(() => {
    if (!arquivo) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(arquivo)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const salvar = async () => {
    if (!arquivo) return
    setSalvando(true)
    setErro(null)
    try {
      await addSessionPhoto({ profileId, sessionId, dateKey, file: arquivo })
      onDone()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar a foto.')
      setSalvando(false)
    }
  }

  return (
    <Sheet open={open} title="Treino concluído" onClose={onDone}>
      <p className="mb-4 text-sm text-muted">
        Quer registrar uma foto de hoje? Ela fica só neste celular e aparece no calendário. Sem
        foto, o dia continua marcado como treinado.
      </p>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Prévia da foto do treino"
          className="mb-4 max-h-72 w-full rounded-xl object-cover"
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) setArquivo(file)
          event.target.value = ''
        }}
      />

      <div className="space-y-2 pb-2">
        {arquivo ? (
          <>
            <Button full size="lg" variant="primary" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar foto'}
            </Button>
            <Button full onClick={() => setArquivo(null)} disabled={salvando}>
              Escolher outra
            </Button>
          </>
        ) : (
          <Button full size="lg" variant="primary" onClick={() => inputRef.current?.click()}>
            Tirar foto
          </Button>
        )}
        <Button full variant="ghost" onClick={onDone} disabled={salvando}>
          Agora não
        </Button>
        {erro ? <p className="text-sm text-danger">{erro}</p> : null}
      </div>
    </Sheet>
  )
}
