import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import {
  DefaultRedirect,
  LoginRoute,
  RequireAuth,
} from './components/AuthRouteGuards'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { AlumnosPage } from './pages/AlumnosPage'
import { DashboardPage } from './pages/Dashboard'
import { CursoAlumnosPage } from './pages/CursoAlumnosPage'
import { AsistenciasCursoPage } from './pages/AsistenciasCursoPage'
import { AsistenciaDiaPage } from './pages/AsistenciaDiaPage'
import { PasarAsistencia } from './pages/PasarAsistencia'
import { AlumnoFichaPage } from './pages/AlumnoFichaPage'
import { NuevoAlumno } from './pages/NuevoAlumno'
import { EditarAlumno } from './pages/EditarAlumno'
import { BuscarAlumnosPage } from './pages/BuscarAlumnosPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="cursos/:cursoId/alumnos" element={<CursoAlumnosPage />} />
              <Route path="cursos/:cursoId/asistencia" element={<PasarAsistencia />} />
              <Route path="cursos/:cursoId/asistencias" element={<AsistenciasCursoPage />} />
              <Route path="cursos/:cursoId/asistencias/:fecha" element={<AsistenciaDiaPage />} />
              <Route path="alumnos" element={<AlumnosPage />} />
              <Route path="alumnos/nuevo" element={<NuevoAlumno />} />
              <Route path="alumnos/buscar" element={<BuscarAlumnosPage />} />
              <Route path="alumnos/:alumnoId/editar" element={<EditarAlumno />} />
              <Route path="alumnos/:alumnoId" element={<AlumnoFichaPage />} />
            </Route>
          </Route>
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
