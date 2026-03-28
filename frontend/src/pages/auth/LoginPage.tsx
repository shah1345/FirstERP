import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@batterypos.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-red-50 rounded-full opacity-60" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-red-100 rounded-full opacity-40" />
        {/* Lightning SVGs */}
        <svg className="absolute top-20 right-20 opacity-10" width="120" height="200" viewBox="0 0 24 24" fill="#dc2626">
          <path d="M13 2L4.5 13.5H11L9 22l10.5-12.5H13L13 2z"/>
        </svg>
        <svg className="absolute bottom-20 left-20 opacity-10" width="80" height="140" viewBox="0 0 24 24" fill="#dc2626">
          <path d="M13 2L4.5 13.5H11L9 22l10.5-12.5H13L13 2z"/>
        </svg>
      </div>

      <div className="w-full max-w-md px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header bar */}
          <div className="bg-red-600 px-8 py-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)' }}
            />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white bg-opacity-20 rounded-2xl mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <path d="M13 2L4.5 13.5H11L9 22l10.5-12.5H13L13 2z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
                POWERCELL POS
              </h1>
              <p className="text-red-200 text-sm mt-1">Battery Wholesale Management System</p>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 mb-6">Sign in to your account to continue</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="power-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="power-input"
                  placeholder="admin@batterypos.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="power-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="power-input"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-power w-full justify-center py-3 text-base"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2L4.5 13.5H11L9 22l10.5-12.5H13L13 2z"/>
                    </svg>
                    Power On — Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">Default credentials</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="font-semibold text-gray-600">Admin</p>
                  <p className="text-gray-400">admin@batterypos.com</p>
                  <p className="text-gray-400">admin123</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="font-semibold text-gray-600">Employee</p>
                  <p className="text-gray-400">employee@batterypos.com</p>
                  <p className="text-gray-400">admin123</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          PowerCell POS v1.0 · Battery Wholesale Management
        </p>
      </div>
    </div>
  );
}
