import { Routes, Route } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout.jsx';
import NasaSplashLoader from './components/ui/NasaSplashLoader.jsx';
import MissionHub from './pages/MissionHub.jsx';
import StudyDetailPage from './pages/StudyDetailPage.jsx';
import PsiCatalogPage from './pages/PsiCatalogPage.jsx';
import FireHazRPage from './pages/FireHazRPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <>
      <NasaSplashLoader />
      <Routes>
      <Route element={<AppLayout />}>
        {/* Main split-screen view */}
        <Route index element={<MissionHub />} />

        {/* PSI Investigation Catalog & F1 Study Telemetry */}
        <Route path="studies" element={<PsiCatalogPage />} />
        <Route path="investigations" element={<PsiCatalogPage />} />
        <Route path="study" element={<StudyDetailPage />} />
        <Route path="study/:id" element={<StudyDetailPage />} />
        <Route path="telemetry" element={<StudyDetailPage />} />
        <Route path="telemetry/:id" element={<StudyDetailPage />} />

        {/* FireHazR Lab & unified 3D Flame morphology */}
        <Route path="flame-3d" element={<FireHazRPage />} />
        <Route path="firehazr" element={<FireHazRPage />} />
        <Route path="flame" element={<FireHazRPage />} />

        {/* Matrix comparison & Earth applications */}
        <Route path="compare" element={<ComparePage />} />

        {/* Fallbacks */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  );
}
