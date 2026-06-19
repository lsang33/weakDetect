import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MobileShell } from './components/layout/MobileShell'
import { DashboardPage } from './pages/DashboardPage'
import { MistakeLogPage } from './pages/MistakeLogPage'
import { MistakeListPage } from './pages/MistakeListPage'
import { MistakeDetailPage } from './pages/MistakeDetailPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ReviewPlanPage } from './pages/ReviewPlanPage'
import { BatchAnalysisPage } from './pages/BatchAnalysisPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter basename="/weakDetect">
      <Routes>
        <Route element={<MobileShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/log" element={<MistakeLogPage />} />
          <Route path="/mistakes" element={<MistakeListPage />} />
          <Route path="/mistakes/:id" element={<MistakeDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/review" element={<ReviewPlanPage />} />
          <Route path="/batch" element={<BatchAnalysisPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
