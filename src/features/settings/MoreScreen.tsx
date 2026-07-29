import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProfileState, resetTutorial, updateProfileState } from '@/db/repositories/profiles.repo'
import { useActiveProfile } from '@/state/activeProfile'
import { downloadBackup } from '@/features/backup/exportBackup'
import { importBackup, type ImportResult } from '@/features/backup/importBackup'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { Splash } from '@/app/Splash'

export function MoreScreen() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const profileId = profile?.id
  const fileInput = useRef<HTMLInputElement>(null)

  const [pendingFile, setPendingFile] = useState<unknown>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  const state = useLiveQuery(async () => (profileId ? getProfileState(profileId) : null), [profileId])

  if (!profile || !state) return <Splash />

  const toggle = (key: 'soundEnabled' | 'vibrationEnabled' | 'keepScreenAwake' | 'restDefaultsToMax') =>
    updateProfileState(profile.id, { [key]: !state[key] })

  const onPickFile = async (file: File) => {
    try {
      setPendingFile(JSON.parse(await file.text()))
    } catch {
      setResult({
        ok: false,
        error: 'Não consegui ler o arquivo — ele não é um JSON válido.',
        warnings: [],
        counts: {
          profiles: 0,
          plans: 0,
          workouts: 0,
          exercises: 0,
          seriesTargets: 0,
          sessions: 0,
          setLogs: 0,
        },
      })
    }
  }

  const runImport = async (mode: Parameters<typeof importBackup>[1]) => {
    setBusy(true)
    const outcome = await importBackup(pendingFile, mode)
    setBusy(false)
    setPendingFile(null)
    setResult(outcome)
  }

  return (
    <Screen title="Mais" subtitle={profile.name}>
      <Card className="mb-4 flex items-center gap-3">
        <Avatar name={profile.name} color={profile.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{profile.name}</p>
          <p className="text-sm text-muted">Perfil ativo</p>
        </div>
        <Button size="sm" onClick={() => navigate('/perfis')}>
          Trocar
        </Button>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium text-muted">Durante o treino</h2>
      <Card className="space-y-1">
        <ToggleRow
          label="Som ao fim do descanso"
          checked={state.soundEnabled}
          onChange={() => toggle('soundEnabled')}
        />
        <ToggleRow
          label="Vibrar ao fim do descanso"
          hint="Não funciona no iPhone — o som cobre esse caso."
          checked={state.vibrationEnabled}
          onChange={() => toggle('vibrationEnabled')}
        />
        <ToggleRow
          label="Manter a tela acesa"
          checked={state.keepScreenAwake}
          onChange={() => toggle('keepScreenAwake')}
        />
        <ToggleRow
          label="Cronômetro usa o tempo máximo"
          hint="Numa faixa de 2–3 min, conta 3 min em vez de 2."
          checked={state.restDefaultsToMax}
          onChange={() => toggle('restDefaultsToMax')}
        />
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium text-muted">Backup</h2>
      <Card className="space-y-2">
        <p className="text-sm text-muted">
          Os dados existem só neste navegador. Exporte de vez em quando — é o que garante que um
          celular novo (ou um cache limpo) não leve o histórico junto.
        </p>
        <Button full onClick={() => downloadBackup([profile.id], profile.name.toLowerCase())}>
          Exportar {profile.name}
        </Button>
        <Button full onClick={() => downloadBackup(undefined, 'todos')}>
          Exportar todos os perfis
        </Button>
        <Button full variant="secondary" onClick={() => fileInput.current?.click()}>
          Importar arquivo JSON
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onPickFile(file)
            event.target.value = ''
          }}
        />
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium text-muted">Ajuda</h2>
      <Card>
        <Button
          full
          onClick={async () => {
            await resetTutorial(profile.id)
            navigate('/home')
          }}
        >
          Ver o tutorial novamente
        </Button>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium text-muted">Perfis</h2>
      <Card>
        <Button full onClick={() => navigate('/perfis/gerenciar')}>
          Gerenciar perfis
        </Button>
      </Card>

      <Sheet open={pendingFile !== null} title="Importar plano" onClose={() => setPendingFile(null)}>
        <p className="mb-4 text-sm text-muted">
          Onde os dados do arquivo devem entrar? Todos os ids são recriados, então importar não
          sobrescreve nada do que já existe.
        </p>
        <div className="space-y-2 pb-2">
          <Button
            full
            variant="primary"
            disabled={busy}
            onClick={() => runImport({ kind: 'merge', profileId: profile.id })}
          >
            Adicionar ao perfil {profile.name}
          </Button>
          <Button full disabled={busy} onClick={() => runImport({ kind: 'newProfiles' })}>
            Criar perfis novos a partir do arquivo
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={result !== null}
        title={result?.ok ? 'Importação concluída' : 'Não deu para importar'}
        onClose={() => setResult(null)}
      >
        {result?.ok ? (
          <ul className="mb-4 space-y-1 text-sm text-muted">
            <li>{result.counts.profiles} perfil(is)</li>
            <li>{result.counts.plans} plano(s)</li>
            <li>{result.counts.workouts} treino(s)</li>
            <li>{result.counts.exercises} exercício(s)</li>
            <li>{result.counts.seriesTargets} série(s) prescrita(s)</li>
            <li>{result.counts.setLogs} registro(s) de histórico</li>
          </ul>
        ) : (
          <p className="mb-4 text-sm text-danger">{result?.error}</p>
        )}

        {result?.warnings.length ? (
          <div className="mb-4 rounded-xl border border-rampup/40 bg-rampup/10 p-3">
            <p className="mb-1 text-sm font-medium text-rampup">Avisos</p>
            <ul className="space-y-1 text-xs text-muted">
              {result.warnings.slice(0, 8).map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button full variant="primary" className="mb-2" onClick={() => setResult(null)}>
          Fechar
        </Button>
      </Sheet>
    </Screen>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-xl py-3 text-left active:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      <span
        className={[
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 size-5 rounded-full bg-white transition-all',
            checked ? 'left-6' : 'left-1',
          ].join(' ')}
        />
      </span>
    </button>
  )
}
