// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login    from './pages/Login';
import Home     from './pages/Home';
import Mealcheck from './pages/Mealcheck';
import Report   from './pages/Report';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/login" replace />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/home"      element={<Home />} />
        <Route path="/mealcheck" element={<Mealcheck />} />
        <Route path="/report"    element={<Report />} />
      </Routes>
    </BrowserRouter>
  );
}
