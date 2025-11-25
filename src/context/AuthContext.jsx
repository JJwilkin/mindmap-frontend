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

  // Get the auth token from localStorage
  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  // Set the auth token in localStorage
  const setToken = (token) => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  };

  const checkAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        console.log('No auth token found');
        setUser(null);
        setLoading(false);
        return;
      }

      const response = await fetch(getApiEndpoint('/api/auth/user'), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        console.warn('Auth check failed:', response.status, response.statusText);
        setToken(null); // Clear invalid token
        setUser(null);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Auth check result:', data.user ? 'Logged in' : 'Not logged in');
      
      if (!data.user) {
        setToken(null); // Clear invalid token
      }
      
      setUser(data.user);
    } catch (error) {
      console.error('Error checking auth:', error);
      setToken(null); // Clear token on error
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if we just returned from OAuth with a token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('✓ JWT token received from OAuth');
      // Save token to localStorage
      setToken(token);
      
      // Remove token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Check auth with the new token
      checkAuth();
    } else {
      // Check existing token
      checkAuth();
    }
    
    // Listen for storage events (when user logs in from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'authToken') {
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = () => {
    // Redirect to Google OAuth
    window.location.href = getApiEndpoint('/api/auth/google');
  };

  const logout = async () => {
    try {
      // Clear the token
      setToken(null);
      setUser(null);
      
      // Notify backend (optional, mainly for logging)
      await fetch(getApiEndpoint('/api/auth/logout'), {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      });
      
      console.log('✓ Logged out successfully');
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
    getToken, // Expose getToken for API calls
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

