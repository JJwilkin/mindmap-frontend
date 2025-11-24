import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      background: 'rgba(15, 15, 20, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          fontSize: '22px',
          fontWeight: '100',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          letterSpacing: '4px',
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <span>ASTRL</span>
        </div>
      </div>

      <div>
        {user ? (
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '24px',
                padding: '6px 12px 6px 6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: 'white',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            >
              <img
                src={user.profilePicture || 'https://via.placeholder.com/32'}
                alt={user.displayName}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
              <span>{user.displayName}</span>
              <svg
                style={{
                  width: '16px',
                  height: '16px',
                  transition: 'transform 0.2s',
                  transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                minWidth: '200px',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#ffffff',
                    marginBottom: '4px',
                  }}>
                    {user.displayName}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#999',
                  }}>
                    {user.email}
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#ff6b6b',
                    fontWeight: '500',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 107, 107, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={login}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              color: '#1a1a1a',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </header>
  );
};

export default Header;

