import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import AgentNew from './pages/AgentNew';
import CallHistory from './pages/CallHistory';
import Workflows from './pages/Workflows';
import WorkflowBuilder from './pages/WorkflowBuilder';
import AgentSettings from './pages/AgentSettings';
import Analytics from './pages/Analytics';
import Integrations from './pages/Integrations';
import UsageCosts from './pages/UsageCosts';
import Landing from './pages/Landing';
import Login from './pages/LoginEnhanced';  // Using enhanced login with OTP and OAuth
import Register from './pages/Register';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protect routes — redirect to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />

      {/* Protected routes wrapped in Layout */}
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/new" element={<AgentNew />} />
              <Route path="/agents/:agentId/settings" element={<AgentSettings />} />
              <Route path="/calls" element={<CallHistory />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/workflows/new" element={<WorkflowBuilder />} />
              <Route path="/workflows/:workflowId" element={<WorkflowBuilder />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/usage" element={<UsageCosts />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
