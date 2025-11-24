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
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('Auth check failed:', response.status, response.statusText);
        setUser(null);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Auth check result:', data.user ? 'Logged in' : 'Not logged in');
      setUser(data.user);
    } catch (error) {
      console.error('Error checking auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if we just returned from OAuth (auth=success in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth');
    
    if (authSuccess === 'success') {
      // Remove the auth parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Wait a moment for the cookie to be set, then check auth
      setTimeout(() => {
        checkAuth();
      }, 100);
    } else {
      checkAuth();
    }
    
    // Listen for storage events (when user logs in from another tab)
    const handleStorageChange = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check auth when window regains focus (after OAuth redirect)
    const handleFocus = () => {
      checkAuth();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
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

