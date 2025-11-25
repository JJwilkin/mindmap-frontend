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
  const [authReady, setAuthReady] = useState(false); // Indicates auth initialization is complete
  const [justLoggedIn, setJustLoggedIn] = useState(false); // Indicates user just completed OAuth
  const [returnUrl, setReturnUrl] = useState(null); // URL to return to after OAuth

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
    const initializeAuth = async () => {
      // Check if we just returned from OAuth with a token
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      
      if (token) {
        console.log('✓ JWT token received from OAuth');
        // Save token to localStorage
        setToken(token);
        
        // Get the stored return URL (saved before OAuth redirect)
        const storedReturnUrl = localStorage.getItem('authReturnUrl');
        localStorage.removeItem('authReturnUrl'); // Clean up
        
        // Clean up the URL (remove token param)
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Check auth with the new token
        await checkAuth();
        
        // Signal that user just logged in (triggers data refresh in components)
        setJustLoggedIn(true);
        console.log('✓ OAuth complete, triggering data refresh');
        
        // Store the return URL in state so components can handle navigation via React Router
        if (storedReturnUrl && storedReturnUrl !== '/app' && storedReturnUrl !== '/') {
          console.log('✓ Setting return URL:', storedReturnUrl);
          setReturnUrl(storedReturnUrl);
        }
      } else {
        // Check existing token
        await checkAuth();
      }
      
      // Mark auth initialization as complete
      setAuthReady(true);
    };

    initializeAuth();
    
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
    // Store the current URL so we can return after OAuth
    const currentUrl = window.location.pathname + window.location.search;
    localStorage.setItem('authReturnUrl', currentUrl);
    console.log('✓ Storing return URL:', currentUrl);
    
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

  // Clear the justLoggedIn flag (call after handling the login event)
  const clearJustLoggedIn = () => {
    setJustLoggedIn(false);
  };

  // Clear the return URL after navigation
  const clearReturnUrl = () => {
    setReturnUrl(null);
  };

  const value = {
    user,
    loading,
    authReady,      // True when initial auth check is complete
    justLoggedIn,   // True when user just completed OAuth redirect
    clearJustLoggedIn,
    returnUrl,      // URL to navigate to after OAuth (if any)
    clearReturnUrl,
    login,
    logout,
    checkAuth,
    getToken, // Expose getToken for API calls
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

