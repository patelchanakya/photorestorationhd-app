import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { analyticsService } from '@/services/analytics';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorBoundaryId: string;
}

export class RevenueCatErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorBoundaryId: `revenue-cat-${Date.now()}`
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💳 RevenueCat Error Boundary caught error:', error, errorInfo);
    
    // Track error in analytics
    analyticsService.track('RevenueCat Error Boundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundaryId: this.state.errorBoundaryId,
      timestamp: Date.now(),
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorBoundaryId: `revenue-cat-${Date.now()}` // Generate new ID for retry
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      // Default error UI
      return (
        <View className="flex-1 justify-center items-center p-6 bg-black">
          <View className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full">
            <Text className="text-white text-lg font-semibold mb-2">
              Subscription Service Unavailable
            </Text>
            <Text className="text-gray-300 text-sm mb-4 leading-relaxed">
              We&apos;re having trouble connecting to our subscription service. Please try again.
            </Text>
            <TouchableOpacity
              onPress={this.handleRetry}
              className="bg-blue-600 py-3 px-6 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-white font-medium text-center">
                Try Again
              </Text>
            </TouchableOpacity>
            {__DEV__ && this.state.error && (
              <View className="mt-4 p-3 bg-red-900 rounded-lg">
                <Text className="text-red-200 text-xs font-mono">
                  Dev Error: {this.state.error.message}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with RevenueCat error boundary
export const withRevenueCatErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) => {
  const WrappedComponent = (props: P) => (
    <RevenueCatErrorBoundary fallback={fallback}>
      <Component {...props} />
    </RevenueCatErrorBoundary>
  );

  WrappedComponent.displayName = `withRevenueCatErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Specialized error boundary for paywall components
export const PaywallErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const PaywallFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
    <View className="flex-1 justify-center items-center p-6">
      <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
        <Text className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
          Payment System Error
        </Text>
        <Text className="text-gray-600 dark:text-gray-300 text-sm mb-4 leading-relaxed">
          Unable to load payment options. Please check your internet connection and try again.
        </Text>
        <TouchableOpacity
          onPress={retry}
          className="bg-blue-600 py-3 px-6 rounded-lg mb-3"
          activeOpacity={0.8}
        >
          <Text className="text-white font-medium text-center">
            Retry Payment
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <RevenueCatErrorBoundary fallback={PaywallFallback}>
      {children}
    </RevenueCatErrorBoundary>
  );
};

export default RevenueCatErrorBoundary;