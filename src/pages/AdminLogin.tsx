import { useState } from "react";
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

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Visibility state
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
            Admin Login
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Sign in to manage the DAET Digital collection
          </p>
        </div>

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
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50" 
            disabled={loading}
          >
            {loading ? "Verifying..." : "Login to Dashboard"}
          </Button>
        </form>

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