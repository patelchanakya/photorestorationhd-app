import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/i18n/useTranslation';

interface Mode {
  id: string;
  name: string;
  icon: string;
}

interface ModeSelectorProps {
  visible: boolean;
  modes: Mode[];
  selectedMode: string;
  onSelect: (modeId: string) => void;
  onClose: () => void;
}

export function ModeSelector({ visible, modes, selectedMode, onSelect, onClose }: ModeSelectorProps) {
  const { t } = useTranslation();
  
  const handleModeSelect = (modeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(modeId);
    onClose();
  };

  const handleBackdropPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={{ flex: 1 }} onPress={handleBackdropPress}>
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable onPress={() => {}}>
            <Animated.View
              entering={SlideInDown.duration(300)}
              style={{
                backgroundColor: 'black',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                paddingBottom: 40,
                paddingHorizontal: 20,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Handle */}
              <View style={{
                width: 40,
                height: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }} />

              {/* Title */}
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center',
                marginBottom: 20,
              }}>
                {t('modes.selectMode')}
              </Text>

              {/* Mode Options */}
              {modes.map((mode) => (
                <TouchableOpacity
                  key={mode.id}
                  onPress={() => handleModeSelect(mode.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    backgroundColor: selectedMode === mode.id 
                      ? 'rgba(249, 115, 22, 0.2)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    marginBottom: 8,
                    borderWidth: selectedMode === mode.id ? 2 : 1,
                    borderColor: selectedMode === mode.id 
                      ? '#f97316' 
                      : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {/* Mode Icon */}
                  <View style={{
                    width: 40,
                    height: 40,
                    backgroundColor: selectedMode === mode.id 
                      ? 'rgba(249, 115, 22, 0.3)' 
                      : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}>
                    <IconSymbol 
                      name={mode.icon as any} 
                      size={20} 
                      color={selectedMode === mode.id ? '#f97316' : 'white'} 
                    />
                  </View>

                  {/* Mode Name */}
                  <Text style={{
                    color: selectedMode === mode.id ? '#f97316' : 'white',
                    fontSize: 16,
                    fontWeight: selectedMode === mode.id ? '600' : '500',
                    flex: 1,
                  }}>
                    {mode.name}
                  </Text>

                  {/* Check Icon */}
                  {selectedMode === mode.id && (
                    <IconSymbol name="checkmark" size={20} color="#f97316" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Cancel Button */}
              <TouchableOpacity
                onPress={handleBackdropPress}
                style={{
                  marginTop: 10,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '500',
                }}>
                  {t('modes.cancel')}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}