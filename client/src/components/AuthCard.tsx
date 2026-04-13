import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logoImg from "@assets/icai-ca-india-logo.png";
import { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AuthCardProps {
  mode: "login" | "register";
  onSubmit: (email: string, password: string, name?: string, mfaToken?: string) => void;
  onToggleMode: () => void;
  requireMfa?: boolean;
  lockoutMessage?: string;
}

export default function AuthCard({ mode, onSubmit, onToggleMode, requireMfa, lockoutMessage }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation matching server requirements
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const passwordRequirements = [
    { met: password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(password), text: 'One lowercase letter' },
    { met: /\d/.test(password), text: 'One number' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    
    if (mode === 'register' && !passwordValid) {
      setValidationError("Password must be at least 8 characters long");
      return;
    }
    
    if (mode === 'register' && !passwordsMatch) {
      setValidationError("Passwords do not match. Please re-enter your password.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(email, password, name, requireMfa ? mfaToken : undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = mode === "login";

  // Handle Google OAuth sign-in
  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/sso/google';
  };

  const handleMicrosoftSignIn = () => {
    window.location.href = '/api/auth/sso/microsoft';
  };
  
  // Sanitize lockout message to avoid leaking security details
  const sanitizedLockoutMessage = lockoutMessage 
    ? "Your account has been temporarily locked due to multiple failed login attempts. Please try again later."
    : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <img src={logoImg} alt="CA GPT" className="h-12 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-semibold">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin 
                ? "Sign in to continue to CA GPT" 
                : "Get started with CA GPT for free"}
            </p>
            
            {/* Helpful tips */}
            {!isLogin && (
              <div className="mt-4 p-3 bg-rai-50 dark:bg-rai-950/20 border border-rai-200 dark:border-rai-800 rounded-md">
                <p className="text-xs text-rai-700 dark:text-rai-300">
                  💡 <strong>Quick tip:</strong> Use a strong password with at least 8 characters
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {sanitizedLockoutMessage && (
              <Alert variant="destructive" data-testid="alert-lockout">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{sanitizedLockoutMessage}</AlertDescription>
              </Alert>
            )}
            
            {validationError && (
              <Alert variant="destructive" data-testid="alert-validation-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="input-name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {!isLogin && password && (
                <div className="mt-2 p-3 bg-muted/50 rounded-md space-y-1">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Password requirements:</p>
                  {passwordRequirements.map((req, index) => (
                    <PasswordRequirement key={index} met={req.met} text={req.text} />
                  ))}
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    data-testid="input-confirm-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-confirm-password"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-2 mt-1">
                    {passwordsMatch ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs text-green-600 dark:text-green-400">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-xs text-destructive">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {requireMfa && (
              <div className="space-y-2">
                <Label htmlFor="mfaToken" className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Two-Factor Code
                </Label>
                <Input
                  id="mfaToken"
                  type="text"
                  placeholder="000000"
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  data-testid="input-mfa-token"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting || !!sanitizedLockoutMessage || (!isLogin && (!passwordValid || !passwordsMatch))}
              data-testid="button-auth-submit"
            >
              {isSubmitting ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleSignIn}
            data-testid="button-google-signin"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLogin ? "Sign in with Google" : "Sign up with Google"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleMicrosoftSignIn}
            data-testid="button-microsoft-signin"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#F35325" d="M1 1h10v10H1z" />
              <path fill="#81BC06" d="M13 1h10v10H13z" />
              <path fill="#05A6F0" d="M1 13h10v10H1z" />
              <path fill="#FFBA08" d="M13 13h10v10H13z" />
            </svg>
            {isLogin ? "Sign in with Microsoft" : "Sign up with Microsoft"}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={onToggleMode}
              className="text-primary hover:underline font-medium"
              data-testid="button-toggle-mode"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );
}
