import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppLifecycleDebug } from '@/hooks/useAppLifecycle';

/**
 * Debug component for testing app lifecycle restart functionality
 * Only renders in development mode
 */
export function AppLifecycleDebug() {
  const { forceRestart, getBackgroundDuration, setTestThreshold } = useAppLifecycleDebug();

  // Only show in development
  if (!__DEV__) {
    return null;
  }

  const handleSetTestThreshold = () => {
    // Set threshold to 30 seconds for quick testing
    setTestThreshold(30 * 1000);
  };

  const handleForceRestart = () => {
    forceRestart();
  };

  const backgroundDuration = getBackgroundDuration();
  const durationText = backgroundDuration
    ? `${Math.round(backgroundDuration / 1000)}s ago`
    : 'Not backgrounded';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔄 App Lifecycle Debug</Text>
      <Text style={styles.info}>Background duration: {durationText}</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleSetTestThreshold}>
          <Text style={styles.buttonText}>Set 30s threshold</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleForceRestart}>
          <Text style={styles.buttonText}>Force Restart</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        💡 Set threshold, background app for 30s, then return to test restart
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    minWidth: 200,
    maxWidth: 250,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  info: {
    color: '#ccc',
    fontSize: 11,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  hint: {
    color: '#888',
    fontSize: 9,
    fontStyle: 'italic',
    lineHeight: 12,
  },
});