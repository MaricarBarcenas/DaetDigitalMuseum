import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QrCode, ArrowLeft, Eye, EyeOff } from "lucide-react"; // Added Eye icons
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/supabase-helpers";
import museumLogo from "@/assets/logo.png"; // Using the @ alias common in Shadcn/Vite projects

import heroImage from "@/assets/hero-museum.jpg";

type Mode = "login" | "forgot" | "reset";

// NEW: detect if the page was opened from a password recovery email link
const isRecoveryUrl = () =>
  typeof window !== "undefined" &&
  (window.location.hash.includes("type=recovery") ||
    new URLSearchParams(window.location.search).get("type") === "recovery");

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Visibility state
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(isRecoveryUrl() ? "reset" : "login"); // NEW
  const [resetSent, setResetSent] = useState(false); // NEW: confirmation after sending link
  const [newPassword, setNewPassword] = useState(""); // NEW
  const [confirmPassword, setConfirmPassword] = useState(""); // NEW
  const navigate = useNavigate();
  const { toast } = useToast();

  // NEW: switch to "reset" view when Supabase signals a password recovery
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
      return;
    }
    
    if (data.session) {
      await logActivity("Login", "User signed in to the dashboard");
    }
    
    navigate("/admin");
  };

  // NEW: send password reset email (link brings the admin back to this same page)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    setLoading(false);

    if (error) {
      toast({ title: "Could not send reset link", description: error.message, variant: "destructive" });
      return;
    }

    // Same message whether or not the email exists (prevents account enumeration)
    setResetSent(true);
  };

  // NEW: save the new password after the admin opens the emailed link
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast({ title: "Could not update password", description: error.message, variant: "destructive" });
      return;
    }

    try {
      await logActivity("Password Reset", "Admin password was changed via reset link");
    } catch {
      /* logging should never block the reset */
    }

    toast({ title: "Password updated", description: "Please sign in with your new password." });
    await supabase.auth.signOut();
    window.history.replaceState(null, "", window.location.pathname); // clean the recovery token from the URL
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setMode("login");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setResetSent(false);
  };

  const title =
    mode === "login" ? "Admin Login" : mode === "forgot" ? "Forgot Password" : "Set New Password";
  const subtitle =
    mode === "login"
      ? "Sign in to manage the DAET Digital collection"
      : mode === "forgot"
      ? "Enter your admin email and we'll send you a reset link"
      : "Choose a new password for your admin account";

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden bg-slate-950">
      <div 
        className="absolute inset-0 z-0 bg-no-repeat bg-center"
        style={{ 
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[3px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950" />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-2xl md:p-12">
        
        <div className="mb-8 text-center">
          <Link 
            to="/" 
            className="group inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 transition-all hover:bg-primary/40 mb-6"
          >
          <img src={museumLogo} alt="DAET Digital Museum Logo" className="h-10 w-10 object-contain rounded-md" />            
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {subtitle}
          </p>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200 font-medium ml-1">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@daetmuseum.ph"
                className="h-12 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary rounded-xl"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200 font-medium ml-1">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} // Toggle type
                  placeholder="••••••••"
                  className="h-12 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary rounded-xl pr-12"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
                {/* Eye Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                </button>
              </div>
              {/* NEW: Forgot password link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-sm text-slate-300 hover:text-white underline-offset-4 hover:underline transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50" 
              disabled={loading}
            >
              {loading ? "Verifying..." : "Login to Dashboard"}
            </Button>
          </form>
        )}

        {mode === "forgot" && !resetSent && (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-slate-200 font-medium ml-1">Email Address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="admin@daetmuseum.ph"
                className="h-12 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <button
              type="button"
              onClick={() => switchMode("login")}
              className="flex w-full items-center justify-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to login
            </button>
          </form>
        )}

        {mode === "forgot" && resetSent && (
          <div className="space-y-5 text-center">
            <p className="text-sm text-slate-200">
              If an account exists for <span className="font-semibold text-white">{email}</span>, a password
              reset link has been sent. Please check your inbox (and spam folder).
            </p>
            <Button
              type="button"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98]"
              onClick={() => switchMode("login")}
            >
              Back to Login
            </Button>
          </div>
        )}

        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-slate-200 font-medium ml-1">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary rounded-xl pr-12"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-slate-200 font-medium ml-1">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-12 border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary rounded-xl"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="mt-2 text-xs text-slate-300">
            Only administrative personnel can access this area
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;