import { createBrowserRouter } from 'react-router'
import { RootRedirect } from './RootRedirect'
import { RequireProfile } from './RequireProfile'
import { AppLayout } from './AppLayout'
import { ProfileSelectScreen } from '@/features/profiles/ProfileSelectScreen'
import { ProfilesManageScreen } from '@/features/profiles/ProfilesManageScreen'
import { HomeScreen } from '@/features/home/HomeScreen'
import { PlansScreen } from '@/features/plans/PlansScreen'
import { PlanEditorScreen } from '@/features/plans/PlanEditorScreen'
import { WorkoutEditorScreen } from '@/features/plans/WorkoutEditorScreen'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { MoreScreen } from '@/features/settings/MoreScreen'
import { StartSessionScreen } from '@/features/session/StartSessionScreen'
import { SessionScreen } from '@/features/session/SessionScreen'

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/perfis', element: <ProfileSelectScreen /> },
  { path: '/perfis/gerenciar', element: <ProfilesManageScreen /> },
  {
    element: <RequireProfile />,
    children: [
      // Telas com navegação inferior.
      {
        element: <AppLayout />,
        children: [
          { path: '/home', element: <HomeScreen /> },
          { path: '/planos', element: <PlansScreen /> },
          { path: '/historico', element: <HistoryScreen /> },
          { path: '/mais', element: <MoreScreen /> },
        ],
      },
      // Telas de foco: sem nav, para não competir com a tarefa em curso.
      // Carregada sob demanda: o pdf.js e o motor de OCR pesam mais que o app
      // inteiro, e quem nunca importa um PDF não deve pagar por eles.
      {
        path: '/importar',
        lazy: async () => ({
          Component: (await import('@/features/import/ImportScreen')).ImportScreen,
        }),
      },
      { path: '/planos/:planId', element: <PlanEditorScreen /> },
      { path: '/planos/:planId/t/:workoutId', element: <WorkoutEditorScreen /> },
      { path: '/treinar/:workoutId', element: <StartSessionScreen /> },
      { path: '/sessao/:sessionId', element: <SessionScreen /> },
    ],
  },
  { path: '*', element: <RootRedirect /> },
])
