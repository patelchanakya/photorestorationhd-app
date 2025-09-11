import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { debugABTests, AB_TESTS } from '@/utils/abTesting';
import Constants from 'expo-constants';

interface ABTestDebuggerProps {
  visible?: boolean;
}

export function ABTestDebugger({ visible = __DEV__ }: ABTestDebuggerProps) {
  const [showDebugger, setShowDebugger] = React.useState(false);
  const [testAssignments, setTestAssignments] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (visible) {
      setTestAssignments(debugABTests());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Debug Toggle Button */}
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => {
          setShowDebugger(!showDebugger);
          if (!showDebugger) {
            setTestAssignments(debugABTests());
          }
        }}
      >
        <Text style={styles.debugToggleText}>🧪</Text>
      </TouchableOpacity>

      {/* Debug Panel */}
      {showDebugger && (
        <View style={styles.debugPanel}>
          <ScrollView style={styles.scrollView}>
            <Text style={styles.debugTitle}>A/B Test Debugger</Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Session Info:</Text>
              <Text style={styles.debugText}>Session ID: {Constants.sessionId?.slice(0, 8)}...</Text>
              <Text style={styles.debugText}>App Version: {Constants.expoConfig?.version}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Test Assignments:</Text>
              {Object.entries(testAssignments).map(([testName, variant]) => {
                const test = AB_TESTS[testName];
                const variantInfo = test?.variants.find(v => v.id === variant);
                
                return (
                  <View key={testName} style={styles.testItem}>
                    <Text style={styles.testName}>{testName}:</Text>
                    <Text style={styles.testVariant}>
                      {variant} - {variantInfo?.name} ({variantInfo?.weight}%)
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Available Tests:</Text>
              {Object.entries(AB_TESTS).map(([testName, test]) => (
                <View key={testName} style={styles.testConfig}>
                  <Text style={styles.configTitle}>{testName}</Text>
                  <Text style={styles.configStatus}>
                    Status: {test.isActive ? '🟢 Active' : '🔴 Inactive'}
                  </Text>
                  {test.variants.map(variant => (
                    <Text key={variant.id} style={styles.configVariant}>
                      • {variant.id}: {variant.name} ({variant.weight}%)
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowDebugger(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  debugToggle: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  debugToggleText: {
    fontSize: 20,
  },
  debugPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 9998,
    padding: 20,
    paddingTop: 60,
  },
  scrollView: {
    flex: 1,
  },
  debugTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  testItem: {
    marginBottom: 10,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  testVariant: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 10,
  },
  testConfig: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 5,
  },
  configTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  configStatus: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  configVariant: {
    fontSize: 12,
    color: '#ccc',
    marginLeft: 10,
  },
  closeButton: {
    backgroundColor: '#f44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});