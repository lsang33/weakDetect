import { Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MobileShell } from './components/layout/MobileShell'
import { DashboardPage } from './pages/DashboardPage'
import { MistakeLogPage } from './pages/MistakeLogPage'
import { MistakeListPage } from './pages/MistakeListPage'
import { MistakeDetailPage } from './pages/MistakeDetailPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { PracticePage } from './pages/PracticePage'
import { BatchAnalysisPage } from './pages/BatchAnalysisPage'
import { SettingsPage } from './pages/SettingsPage'

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 14, color: '#dc2626', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>App Crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#fef2f2', padding: 12, borderRadius: 8, maxHeight: '80vh', overflow: 'auto' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/weakDetect">
        <Routes>
          <Route element={<MobileShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/log" element={<MistakeLogPage />} />
            <Route path="/mistakes" element={<MistakeListPage />} />
            <Route path="/mistakes/:id" element={<MistakeDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/review" element={<PracticePage />} />
            <Route path="/batch" element={<BatchAnalysisPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
