import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error?: Error; resetError: () => void}>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <View style={{ 
          flex: 1, 
          backgroundColor: 'black', 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingHorizontal: 24 
        }}>
          <IconSymbol name="exclamationmark.triangle" size={64} color="#f97316" />
          <Text style={{ 
            color: 'white', 
            fontSize: 22, 
            fontWeight: 'bold', 
            marginTop: 16, 
            marginBottom: 8,
            textAlign: 'center'
          }}>
            Something went wrong
          </Text>
          <Text style={{ 
            color: 'rgba(255,255,255,0.7)', 
            fontSize: 16, 
            textAlign: 'center', 
            marginBottom: 32,
            lineHeight: 24
          }}>
            The app encountered an error. Please try again.
          </Text>
          <TouchableOpacity
            onPress={this.resetError}
            style={{ 
              backgroundColor: '#f97316', 
              paddingHorizontal: 32, 
              paddingVertical: 14, 
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8
            }}
          >
            <IconSymbol name="arrow.clockwise" size={18} color="white" />
            <Text style={{ 
              color: 'white', 
              fontWeight: 'bold', 
              fontSize: 16 
            }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}