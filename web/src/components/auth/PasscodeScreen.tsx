import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Lock, UserPlus, LogIn, Loader2 } from 'lucide-react';
import { PasscodeInput } from './PasscodeInput';
import { Button, Input, Card } from '../common';
import { useAuthStore, hasExistingUsers } from '../../stores/authStore';

type Mode = 'login' | 'setup' | 'loading';

export function PasscodeScreen() {
  const [mode, setMode] = useState<Mode>('loading');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'passcode' | 'confirm'>('name');
  const [error, setError] = useState('');

  const { login, createUser, isLoading } = useAuthStore();

  // Check if users exist to determine initial mode
  useEffect(() => {
    const checkUsers = async () => {
      const exists = await hasExistingUsers();
      setMode(exists ? 'login' : 'setup');
    };
    checkUsers();
  }, []);

  const handleLogin = async (code: string) => {
    setError('');
    const success = await login(code);
    if (!success) {
      setError('Invalid passcode');
      setPasscode('');
    }
  };

  const handleSetup = async () => {
    if (step === 'name') {
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      setError('');
      setStep('passcode');
    } else if (step === 'passcode') {
      if (passcode.length !== 4) {
        setError('Please enter a 4-digit passcode');
        return;
      }
      setError('');
      setStep('confirm');
    } else if (step === 'confirm') {
      if (confirmPasscode !== passcode) {
        setError('Passcodes do not match');
        setConfirmPasscode('');
        return;
      }
      try {
        await createUser(name.trim(), passcode, 'worker');
      } catch (err) {
        setError('Failed to create account');
      }
    }
  };

  const resetSetup = () => {
    setStep('name');
    setName('');
    setPasscode('');
    setConfirmPasscode('');
    setError('');
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo/Branding */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-white">T</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Today</h1>
        <p className="text-slate-500 mt-1">Route Planning Made Simple</p>
      </div>

      <Card className="w-full max-w-sm" variant="elevated" padding="lg">
        {mode === 'login' ? (
          // Login Mode
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter your 4-digit passcode
            </p>
            <PasscodeInput
              value={passcode}
              onChange={setPasscode}
              onComplete={handleLogin}
              error={error}
              disabled={isLoading}
            />
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Signing in...</span>
              </div>
            )}
            <button
              onClick={() => {
                setMode('setup');
                resetSetup();
              }}
              className="mt-6 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Create new account
            </button>
          </div>
        ) : (
          // Setup Mode
          <div className="flex flex-col">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-primary-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">
              {step === 'name' && 'Create Account'}
              {step === 'passcode' && 'Set Passcode'}
              {step === 'confirm' && 'Confirm Passcode'}
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              {step === 'name' && "Let's get you started"}
              {step === 'passcode' && 'Choose a 4-digit passcode'}
              {step === 'confirm' && 'Enter your passcode again'}
            </p>

            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mb-6">
              {['name', 'passcode', 'confirm'].map((s, i) => (
                <div
                  key={s}
                  className={clsx(
                    'w-2 h-2 rounded-full transition-colors',
                    i <=
                      ['name', 'passcode', 'confirm'].indexOf(step)
                      ? 'bg-primary-600'
                      : 'bg-slate-200'
                  )}
                />
              ))}
            </div>

            {step === 'name' && (
              <div className="space-y-4">
                <Input
                  label="Your Name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={error}
                  autoFocus
                />
                <Button fullWidth onClick={handleSetup}>
                  Continue
                </Button>
              </div>
            )}

            {step === 'passcode' && (
              <div className="flex flex-col items-center gap-4">
                <PasscodeInput
                  value={passcode}
                  onChange={setPasscode}
                  error={error}
                />
                <Button
                  fullWidth
                  onClick={handleSetup}
                  disabled={passcode.length !== 4}
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 'confirm' && (
              <div className="flex flex-col items-center gap-4">
                <PasscodeInput
                  value={confirmPasscode}
                  onChange={setConfirmPasscode}
                  onComplete={handleSetup}
                  error={error}
                  disabled={isLoading}
                />
                <Button
                  fullWidth
                  onClick={handleSetup}
                  disabled={confirmPasscode.length !== 4}
                  isLoading={isLoading}
                >
                  Create Account
                </Button>
              </div>
            )}

            <div className="mt-4 flex justify-between">
              {step !== 'name' && (
                <button
                  onClick={() => {
                    if (step === 'passcode') {
                      setStep('name');
                      setPasscode('');
                    } else if (step === 'confirm') {
                      setStep('passcode');
                      setConfirmPasscode('');
                    }
                    setError('');
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Back
                </button>
              )}
              <button
                onClick={async () => {
                  const exists = await hasExistingUsers();
                  if (exists) {
                    setMode('login');
                    resetSetup();
                  }
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium ml-auto"
              >
                Sign in instead
              </button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-6 text-xs text-slate-400">
        Your data is stored locally on this device
      </p>
    </div>
  );
}
