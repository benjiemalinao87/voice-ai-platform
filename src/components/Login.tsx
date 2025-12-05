import { useState } from 'react';
import { LogIn, UserPlus, Bot, Sparkles, Mic, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import loginHero from '../assets/login-hero-enterprise.png';

export function Login() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-dark">
      {/* Left Side - Hero & Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-brand-dark">
        <div className="absolute inset-0 z-0">
          <img
            src={loginHero}
            alt="CHAU Voice AI Engine"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-dark/95 via-brand-dark/50 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-16 text-white h-full">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 glass rounded-xl">
                <Bot className="w-8 h-8 text-brand-cyan" />
              </div>
              <span className="text-xl font-bold tracking-wide text-white">CHAU VOICE AI</span>
            </div>
          </div>

          <div className="space-y-8 max-w-xl">
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Enterprise-Grade <br />
              <span className="text-gradient">
                Voice Intelligence
              </span>
            </h1>
            <p className="text-lg text-gray-300 leading-relaxed font-light">
              Connect with your customers on a deeper level. Our advanced voice engine powers the next generation of business communication with unmatched reliability and natural understanding.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full glass">
                <Sparkles className="w-4 h-4 text-brand-cyan" />
                <span className="text-sm font-medium">99.9% Accuracy</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full glass">
                <Mic className="w-4 h-4 text-brand-cyan" />
                <span className="text-sm font-medium">Real-time Processing</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full glass">
                <Activity className="w-4 h-4 text-brand-cyan" />
                <span className="text-sm font-medium">Enterprise Security</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 font-medium">
            © {new Date().getFullYear()} CHAU Voice AI Engine. Trusted by industry leaders.
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-white dark:bg-brand-dark border-l border-gray-100 dark:border-gray-800">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo (Visible only on mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-2xl mb-4 shadow-lg shadow-brand-primary/20">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              CHAU Voice AI
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-900/50 rounded-2xl shadow-xl dark:shadow-none p-8 border border-gray-100 dark:border-gray-800 backdrop-blur-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isLogin ? 'Welcome back' : 'Start your journey'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {isLogin
                  ? 'Access your enterprise dashboard'
                  : 'Join the future of voice automation'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-primary hover:bg-blue-600 text-white rounded-lg font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-brand-primary/25"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : isLogin ? (
                  <>
                    <LogIn className="w-5 h-5" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Create Account
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isLogin ? "New to CHAU Voice AI?" : 'Already have an account?'}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="ml-2 text-brand-primary hover:text-blue-600 font-semibold hover:underline transition-all"
                >
                  {isLogin ? 'Request Access' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 dark:text-gray-600">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}

