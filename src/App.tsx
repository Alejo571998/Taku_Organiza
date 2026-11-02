import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import RequireAuth from './components/auth/RequireAuth'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './routes/LoginPage'
import RecoverPage from './routes/RecoverPage'
import DashboardView from './routes/DashboardView'
import MonthView from './routes/MonthView'
import WeekView from './routes/WeekView'
import DayView from './routes/DayView'
import ExpensesView from './routes/ExpensesView'
import FinanzasView from './routes/FinanzasView'
import HabitosView from './routes/HabitosView'
import TabListView from './routes/TabListView'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar" element={<RecoverPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            {/* La raíz pasa a ser el resumen. Día, Semana, Mes y las pestañas
                quedan exactamente como estaban: el resumen las mira, no las
                reemplaza. */}
            <Route path="/" element={<DashboardView />} />
            <Route path="/mes" element={<MonthView />} />
            <Route path="/semana" element={<WeekView />} />
            <Route path="/dia" element={<DayView />} />
            <Route path="/finanzas" element={<FinanzasView />} />
            <Route path="/habitos" element={<HabitosView />} />
            <Route path="/gastos" element={<ExpensesView />} />
            <Route path="/pestana/:tabId" element={<TabListView />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
