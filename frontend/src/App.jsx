import { Routes, Route } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout.jsx';
import MissionHub from './pages/MissionHub.jsx';
import StudyDetailPage from './pages/StudyDetailPage.jsx';
import Flame3DPage from './pages/Flame3DPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Main split-screen view */}
        <Route index element={<MissionHub />} />

        {/* Study Detail view */}
        <Route path="study/:id" element={<StudyDetailPage />} />

        {/* 3D Flame comparative morphology */}
        <Route path="flame-3d" element={<Flame3DPage />} />

        {/* Matrix comparison & Earth applications */}
        <Route path="compare" element={<ComparePage />} />

        {/* Fallbacks */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
