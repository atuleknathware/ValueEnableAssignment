import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import Calculator from './pages/Calculator';
import History from './pages/History';
import BulkProcessing from './pages/BulkProcessing';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="d-flex flex-column min-vh-100">
          <Navbar />
          <main className="flex-grow-1">
            <Routes>
              <Route path="/" element={<Calculator />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bulk"
                element={
                  <ProtectedRoute>
                    <BulkProcessing />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="bg-white border-top py-3 text-center text-muted small mt-auto">
            <div className="container">
              Benefit Illustration Module &mdash; Based on{' '}
              <code>assignment_reference_sample (1).xlsm</code>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

