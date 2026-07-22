import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('rmvox_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const login = (userData, token) => {
    localStorage.setItem('rmvox_user', JSON.stringify(userData));
    localStorage.setItem('rmvox_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('rmvox_user');
    localStorage.removeItem('rmvox_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
