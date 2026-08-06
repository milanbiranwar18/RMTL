import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Mic, Eye, EyeOff, LogIn, Mail, Key, Loader2 } from 'lucide-react';

export default function LoginEnhanced() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Login method: 'password', 'otp', 'google'
  const [loginMethod, setLoginMethod] = useState('password');
  
  // Password login state
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  
  // OTP login state
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [countdown, setCountdown] = useState(0);
  
  // Common state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Password login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/login', form);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // OTP login - send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await client.post('/auth/otp/send', {
        email: otpEmail,
        purpose: 'login'
      });
      setOtpSent(true);
      setSuccess(res.data.message);
      setCountdown(res.data.expires_in_minutes * 60); // Convert to seconds
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // OTP login - verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/auth/otp/verify', {
        email: otpEmail,
        otp_code: otpCode,
        purpose: 'login'
      });
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = () => {
    // This will be implemented using Google's OAuth library
    // For now, show a message
    setError('Google Sign-In will be configured in the next step. Please use password or OTP login.');
  };

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Send Reset Password OTP
  const handleSendForgotOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await client.post('/auth/otp/send', {
        email: forgotEmail,
        purpose: 'reset_password'
      });
      setForgotSent(true);
      setSuccess(res.data.message);
      setCountdown(res.data.expires_in_minutes * 60);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset OTP');
    } finally {
      setLoading(false);
    }
  };

  // Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await client.post('/auth/reset-password', {
        email: forgotEmail,
        otp_code: forgotOtp,
        new_password: newPassword
      });
      setSuccess(res.data.message || 'Password reset successfully! Please sign in with your new password.');
      setLoginMethod('password');
      setForm({ email: forgotEmail, password: '' });
      setForgotSent(false);
      setForgotOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Reset OTP form
  const resetOTPForm = () => {
    setOtpSent(false);
    setOtpCode('');
    setCountdown(0);
    setError('');
    setSuccess('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: "'Inter', sans-serif",
      padding: '1rem'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.10) 0%, transparent 60%)'
      }} />

      <div style={{
        width: '100%', maxWidth: '480px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '2.5rem',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            marginBottom: '1rem',
            boxShadow: '0 0 30px rgba(99,102,241,0.4)'
          }}>
            <Mic size={28} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
            RM<span style={{ color: '#818cf8' }}>Vox</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Sign in to your account
          </p>
        </div>

        {/* Login Method Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '12px',
          padding: '0.25rem'
        }}>
          <button
            onClick={() => setLoginMethod('password')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginMethod === 'password' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Key size={16} />
            Password
          </button>
          <button
            onClick={() => setLoginMethod('otp')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: loginMethod === 'otp' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Mail size={16} />
            OTP
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '0.75rem 1rem',
            color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '10px', padding: '0.75rem 1rem',
            color: '#86efac', fontSize: '0.875rem', marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        {/* Password Login Form */}
        {loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500 }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('forgot');
                    setForgotEmail(form.email);
                    setError('');
                    setSuccess('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', padding: '0.75rem 1rem', paddingRight: '2.75rem',
                    color: 'white', fontSize: '0.9rem', outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                  padding: 0, display: 'flex'
                }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px', padding: '0.85rem',
                color: 'white', fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" />Signing in...</>
              ) : (
                <><LogIn size={18} />Sign In</>
              )}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {loginMethod === 'forgot' && !forgotSent && (
          <form onSubmit={handleSendForgotOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Account Email Address
              </label>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px', padding: '0.85rem',
                color: 'white', fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" />Sending OTP...</>
              ) : (
                <><Mail size={18} />Send Reset OTP</>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setError(''); setSuccess(''); }}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '0.75rem', color: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem', cursor: 'pointer'
              }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {loginMethod === 'forgot' && forgotSent && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                6-Digit Reset OTP Code
              </label>
              <input
                type="text"
                required
                value={forgotOtp}
                onChange={e => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '1.5rem', outline: 'none',
                  textAlign: 'center', letterSpacing: '0.5rem'
                }}
              />
            </div>

            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || forgotOtp.length !== 6 || !newPassword}
              style={{
                marginTop: '0.5rem',
                background: (loading || forgotOtp.length !== 6 || !newPassword) ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px', padding: '0.85rem',
                color: 'white', fontSize: '0.95rem', fontWeight: 600,
                cursor: (loading || forgotOtp.length !== 6 || !newPassword) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Reset Password'}
            </button>

            <button
              type="button"
              onClick={() => { setForgotSent(false); setForgotOtp(''); setError(''); }}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '0.75rem', color: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem', cursor: 'pointer'
              }}
            >
              Change Email
            </button>
          </form>
        )}

        {/* OTP Login Form */}
        {loginMethod === 'otp' && !otpSent && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={otpEmail}
                onChange={e => setOtpEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '0.9rem', outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px', padding: '0.85rem',
                color: 'white', fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" />Sending OTP...</>
              ) : (
                <><Mail size={18} />Send OTP</>
              )}
            </button>

            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
              We'll send a 6-digit code to your email
            </p>
          </form>
        )}

        {/* OTP Verification Form */}
        {loginMethod === 'otp' && otpSent && (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
                Enter OTP Code
              </label>
              <input
                type="text"
                required
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px', padding: '0.75rem 1rem',
                  color: 'white', fontSize: '1.5rem', outline: 'none',
                  transition: 'border-color 0.2s',
                  textAlign: 'center',
                  letterSpacing: '0.5rem'
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              {countdown > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'center' }}>
                  Code expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              style={{
                marginTop: '0.5rem',
                background: (loading || otpCode.length !== 6) ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '10px', padding: '0.85rem',
                color: 'white', fontSize: '0.95rem', fontWeight: 600,
                cursor: (loading || otpCode.length !== 6) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: (loading || otpCode.length !== 6) ? 'none' : '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" />Verifying...</>
              ) : (
                <><LogIn size={18} />Verify & Sign In</>
              )}
            </button>

            <button
              type="button"
              onClick={resetOTPForm}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '0.75rem',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Use different email
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '2rem 0'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          style={{
            width: '100%',
            background: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '0.85rem',
            color: '#1f2937',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.959H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.041l3.007-2.334z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.959L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginTop: '1.5rem' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
