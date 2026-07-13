"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Globe, Lock, LogIn, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DocumentTitle } from "@/components/document-title"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { API_URL } from "@/lib/config"
import { fetchWithRetry } from "@/lib/apiClient"
import {
  LANGUAGE_COOKIE,
  type AppLanguage,
  normalizeLanguage,
  persistLanguage,
} from "@/lib/language"
import { cacheUserData } from "@/lib/user-profile"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [language, setLanguage] = React.useState<AppLanguage>("en")
  const [error, setError] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  // AbortController ref for request cancellation
  const loginAbortControllerRef = React.useRef<AbortController | null>(null)

  // Memoized headers object
  const headers = React.useMemo(() => ({
    "Content-Type": "application/json",
  }), [])

  // Standardized error handling utility
  const handleError = React.useCallback((error: unknown, defaultMessage: string) => {
    // Silently handle AbortError (request cancellation)
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Request aborted')
      }
      return
    }

    const errorMessage = error instanceof Error ? error.message : defaultMessage
    
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', errorMessage, error)
    }

    setError(errorMessage)
  }, [])

  // Load language preference (localStorage + cookie sync for SSR lang/dir)
  React.useEffect(() => {
    const storedLanguage = normalizeLanguage(localStorage.getItem(LANGUAGE_COOKIE))
    setLanguage(storedLanguage)
    persistLanguage(storedLanguage)
  }, [])

  // Cleanup: abort pending requests on unmount
  React.useEffect(() => {
    return () => {
      if (loginAbortControllerRef.current) {
        loginAbortControllerRef.current.abort()
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
  
    // Cancel previous request if any
    if (loginAbortControllerRef.current) {
      loginAbortControllerRef.current.abort()
    }
    
    const controller = new AbortController()
    loginAbortControllerRef.current = controller
  
    try {
      const response = await fetchWithRetry(`${API_URL}/auth/login/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
        skipAuth: true,
        skipSessionHandling: true,
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Authentication failed");
      }
  
      // ✅ Store tokens in localStorage
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
  
      // ✅ Store user data (optional)
      if (data.user) {
        cacheUserData(data.user as Record<string, unknown>)
      }

      // Cache page permissions from login (also refreshed by PermissionsProvider)
      if (data.permissions) {
        localStorage.setItem("userPermissions", JSON.stringify(data.permissions));
      }
  
      // ✅ Redirect after successful login
      toast.success(language === "en" ? "Login Successful" : "تم تسجيل الدخول بنجاح", {
        description: language === "en" ? "Welcome to the dashboard" : "مرحبًا بك في لوحة التحكم",
      });

      const perms = data.permissions
      let landing = "/dashboard"
      if (perms && !perms.unrestricted) {
        const first = (perms.permissions || []).find(
          (p: { can_view?: boolean; url?: string }) => p.can_view && p.url,
        )
        if (first?.url) landing = first.url
        else if (!(perms.permissions || []).some((p: { url?: string; can_view?: boolean }) => p.url === "/dashboard" && p.can_view)) {
          landing = "/account"
        }
      }
  
      router.push(landing);
    } catch (err: unknown) {
      // Handle AbortError silently
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Login request aborted')
        }
        return
      }

      const errorMessage = err instanceof Error ? err.message : "Login failed."
      handleError(err, errorMessage)
      setError(language === "en" ? errorMessage : "فشل تسجيل الدخول.");
    } finally {
      setIsLoading(false);
    }
  };
  

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const handleLanguageChange = (value: string) => {
    const next = normalizeLanguage(value)
    setLanguage(next)
    persistLanguage(next)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
      <DocumentTitle title="Login" />
      {/* Language Switcher — logical `end` mirrors to left in RTL */}
      <div className="absolute top-4 end-4 z-10 flex items-center gap-2 md:top-8 md:end-8">
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger
            className="w-[180px]"
            aria-label={language === "en" ? "Select language" : "اختر اللغة"}
          >
            <Globe className="me-2 h-4 w-4" />
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md px-4">
        <Card className="mx-auto shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-36 w-36 items-center justify-center">
                <img 
                  src="/dararab-logo-1.png" 
                  alt="DarArab Logo" 
                  className="h-32 w-32 object-contain"
                />
              </div>
            </div>
            <CardTitle className="text-2xl">{language === "en" ? "DarArab" : "دار عرب"}</CardTitle>
            <CardDescription>
              {language === "en"
                ? "Enter your credentials to access your account"
                : "أدخل بياناتك الخاصة بك للوصول إلى حسابك"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">{language === "en" ? "Username" : "اسم المستخدم"}</Label>
                <div className="relative">
                  <User className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder={language === "en" ? "Enter your username" : "أدخل اسم المستخدم"}
                    className="ps-10"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{language === "en" ? "Password" : "كلمة المرور"}</Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={language === "en" ? "Enter your password" : "أدخل كلمة المرور"}
                    className="ps-10 pe-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute end-1 top-1 h-8 w-8"
                    onClick={togglePasswordVisibility}
                    aria-label={
                      showPassword
                        ? language === "en"
                          ? "Hide password"
                          : "إخفاء كلمة المرور"
                        : language === "en"
                          ? "Show password"
                          : "إظهار كلمة المرور"
                    }
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <svg
                      className="me-2 h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === "en" ? "Logging in..." : "جاري تسجيل الدخول..."}
                  </>
                ) : (
                  <>
                    <LogIn className="me-2 h-4 w-4" />
                    {language === "en" ? "Login" : "تسجيل الدخول"}
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
