"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error("ErrorBoundary caught an error:", error, errorInfo)
    }
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    })
    
    // Here you could also log the error to an error reporting service
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
                </p>
                {process.env.NODE_ENV !== 'production' && this.state.error && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium mb-2">
                      Error Details (Development Only)
                    </summary>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
                <div className="mt-4 flex gap-2">
                  <Button onClick={this.handleReset} variant="outline" size="sm">
                    Try Again
                  </Button>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="default"
                    size="sm"
                  >
                    Refresh Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

