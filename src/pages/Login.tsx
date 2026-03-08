import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2c2419] via-[#2a2117] to-[#231d14] relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl animate-pulse-slow delay-500" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-[0.15em] text-primary-300">ABYSS</h1>
              <p className="text-sm tracking-wide text-primary-400/60 font-medium mt-1">정산 ERP 시스템</p>
            </div>

            <h2 className="text-4xl font-bold leading-tight mb-4">
              비즈니스 관리의<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-primary-500">
                새로운 기준
              </span>
            </h2>

            <p className="text-lg text-slate-400 max-w-md">
              인사, 재무, 영업, 정산을 하나의 플랫폼에서 효율적으로 관리하세요.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-8">
            <div className="flex -space-x-3">
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <div
                  key={letter}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-sm font-bold border-2 border-[#2a2117]"
                  style={{ zIndex: 4 - i }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">500+</span> 기업이 사용 중
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-stone-50 via-white to-orange-50/30">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <h1 className="text-2xl font-bold tracking-[0.15em] text-primary-700">ABYSS</h1>
            <p className="text-xs tracking-wide text-primary-400 font-medium mt-1">정산 ERP 시스템</p>
          </div>

          <div className="bg-white rounded-3xl shadow-soft-lg border border-slate-100 p-8 lg:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">로그인</h2>
              <p className="text-slate-500 mt-2">계정에 로그인하여 시작하세요</p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start animate-scale-in">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  이메일
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    required
                    className="input pl-12"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input pl-12"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3.5 text-base group"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 rounded-full border-t-white animate-spin" />
                    <span>로그인 중...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>로그인</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <KeyRound className="h-4 w-4 text-primary-600" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-slate-700 mb-1">테스트 계정</p>
                  <p className="text-slate-500">
                    이메일: <span className="text-slate-700 font-medium">admin@company.com</span><br />
                    비밀번호: <span className="text-slate-700 font-medium">admin123</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            ERP System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
