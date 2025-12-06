import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LoginPageProps {
  onAuthSuccess?: () => void;
}

type SignUpStep = "email-password" | "otp-verification";
type ResetPasswordStep = "email" | "otp-verification" | "new-password";

const LoginPage = ({ onAuthSuccess = () => {} }: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Sign up flow state
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("email-password");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  
  // Password reset flow state
  const [resetStep, setResetStep] = useState<ResetPasswordStep>("email");
  const [resetEmail, setResetEmail] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Send OTP for signup
      const { error } = await supabase.auth.signInWithOtp({
        email: signUpEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("If no account exists with this email, a code will be sent to your email. Please check your inbox.");
        setSignUpStep("otp-verification");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Verify OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: signUpEmail,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      if (data.user) {
        // Set password for the user
        const { error: updateError } = await supabase.auth.updateUser({
          password: signUpPassword,
        });

        if (updateError) {
          setError(updateError.message);
          return;
        }

        setMessage("Account created successfully!");
        onAuthSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Please double-check your email and/or password.");
      } else if (data.user) {
        setMessage("Signed in successfully!");
        onAuthSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("If an account exists with this email, a code will be sent to your email. Please check your inbox.");
        setResetStep("otp-verification");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Verify OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: otp,
        type: "recovery",
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // Move to new password step
      setResetStep("new-password");
      setMessage("Code verified. Please enter your new password.");
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Password reset successfully! You can now sign in.");
        // Reset the flow
        setResetStep("email");
        setResetEmail("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setShowResetPassword(false);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetSignUpFlow = () => {
    setSignUpStep("email-password");
    setSignUpEmail("");
    setSignUpPassword("");
    setOtp("");
    setError(null);
    setMessage(null);
  };

  const resetPasswordResetFlow = () => {
    setResetStep("email");
    setResetEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setMessage(null);
    setShowResetPassword(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-blue-100">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-3xl">🌿</span>
            <h1 className="text-2xl font-bold text-gray-800">CompanionAI</h1>
          </div>
          <CardTitle className="text-xl">Welcome</CardTitle>
          <CardDescription>Sign in to use CompanionAI</CardDescription>
        </CardHeader>
        <CardContent>
          {!showResetPassword ? (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(true)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {signUpStep === "email-password" ? (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Create a password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        disabled={loading}
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create"
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUpOTPVerification} className="space-y-4">
                    <div className="flex items-center mb-2">
                      <button
                        type="button"
                        onClick={resetSignUpFlow}
                        className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                        disabled={loading}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-otp">Code</Label>
                      <Input
                        id="signup-otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        disabled={loading}
                        maxLength={6}
                        pattern="[0-9]{6}"
                      />
                      <p className="text-xs text-gray-500">
                        Enter the 6-digit code sent to {signUpEmail}
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Confirm"
                      )}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center mb-2">
                <button
                  type="button"
                  onClick={resetPasswordResetFlow}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                  disabled={loading}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Sign In
                </button>
              </div>
              <h3 className="text-lg font-semibold">Reset Password</h3>
              
              {resetStep === "email" && (
                <form onSubmit={handleResetPasswordRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      "Send code"
                    )}
                  </Button>
                </form>
              )}

              {resetStep === "otp-verification" && (
                <form onSubmit={handleResetPasswordOTPVerification} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-otp">Code</Label>
                    <Input
                      id="reset-otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      disabled={loading}
                      maxLength={6}
                      pattern="[0-9]{6}"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the 6-digit code sent to {resetEmail}
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify code"
                    )}
                  </Button>
                </form>
              )}

              {resetStep === "new-password" && (
                <form onSubmit={handleResetPasswordUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              "For where two or three gather in my name, there am I with them."
            </p>
            <p className="font-medium">— Matthew 18:20</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
