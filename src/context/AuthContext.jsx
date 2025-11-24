import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiEndpoint } from '../utils/api.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch(getApiEndpoint('/api/auth/user'), {
        credentials: 'include',
      });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = () => {
    // Redirect to Google OAuth
    window.location.href = getApiEndpoint('/api/auth/google');
  };

  const logout = async () => {
    try {
      await fetch(getApiEndpoint('/api/auth/logout'), {
        credentials: 'include',
      });
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

