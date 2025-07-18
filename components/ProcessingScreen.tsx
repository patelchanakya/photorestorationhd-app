import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CircularProgress } from './CircularProgress';

interface ProcessingScreenProps {
  functionType: 'restoration' | 'unblur' | 'colorize';
  isProcessing: boolean;
  onComplete?: () => void;
}

export function ProcessingScreen({ functionType, isProcessing, onComplete }: ProcessingScreenProps) {
  const [progress, setProgress] = useState(0);

  // Get mode-specific data
  const getModeData = () => {
    switch (functionType) {
      case 'unblur':
        return {
          icon: 'eye',
          title: 'Unblurring your photo...',
          description: 'Removing blur and sharpening details'
        };
      case 'colorize':
        return {
          icon: 'paintbrush',
          title: 'Colorizing your photo...',
          description: 'Adding vibrant colors to your image'
        };
      default:
        return {
          icon: 'wand.and.stars',
          title: 'Restoring your photo...',
          description: 'Enhancing quality and fixing imperfections'
        };
    }
  };

  const modeData = getModeData();

  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      return;
    }

    // Simulate progress over ~7 seconds
    const intervals = [
      { progress: 10, delay: 200 },
      { progress: 25, delay: 800 },
      { progress: 45, delay: 1200 },
      { progress: 65, delay: 1500 },
      { progress: 80, delay: 1800 },
      { progress: 90, delay: 2000 },
      { progress: 95, delay: 500 },
    ];

    const timeouts: NodeJS.Timeout[] = [];
    let cumulativeDelay = 0;

    intervals.forEach(({ progress: targetProgress, delay }) => {
      cumulativeDelay += delay;
      const timeout = setTimeout(() => {
        setProgress(targetProgress);
      }, cumulativeDelay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [isProcessing]);

  // Complete progress when processing is done
  useEffect(() => {
    if (!isProcessing && progress > 0) {
      setProgress(100);
      // Reduced delay - just show 100% briefly then transition
      const timeout = setTimeout(() => {
        onComplete?.();
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isProcessing, progress, onComplete]);

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#f9fafb', 
      justifyContent: 'center', 
      alignItems: 'center',
      paddingHorizontal: 32 
    }}>
      <CircularProgress
        progress={progress}
        size={140}
        strokeWidth={10}
        color="#f97316"
        backgroundColor="#f3f4f6"
        showPercentage={true}
        icon={modeData.icon}
        iconSize={40}
        iconColor="#f97316"
      />
      
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '600', 
        color: '#374151',
        marginTop: 32,
        textAlign: 'center'
      }}>
        {modeData.title}
      </Text>
      
      <Text style={{ 
        fontSize: 16, 
        color: '#6b7280',
        marginTop: 8,
        textAlign: 'center'
      }}>
        {modeData.description}
      </Text>
      
      <Text style={{ 
        fontSize: 14, 
        color: '#9ca3af',
        marginTop: 16,
        textAlign: 'center'
      }}>
        This usually takes 5-10 seconds
      </Text>
    </View>
  );
}