import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function SettingsModalScreen() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <Animated.View entering={FadeIn} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomWidth: 1, 
          borderBottomColor: 'rgba(255,255,255,0.1)' 
        }}>
          <View style={{ width: 32 }} />
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
            Settings
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            style={{ 
              width: 32, 
              height: 32, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <IconSymbol name="xmark" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={{ paddingVertical: 20 }}>
            
            {/* App Settings Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                App Settings
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Camera Quality */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="camera" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Camera Quality
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      High quality (recommended)
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Auto-save to Gallery */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="photo" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Auto-save to Gallery
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Automatically save restored photos
                    </Text>
                  </View>
                  <View style={{
                    width: 44,
                    height: 24,
                    backgroundColor: '#f97316',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    flexDirection: 'row',
                    paddingHorizontal: 2
                  }}>
                    <View style={{
                      width: 20,
                      height: 20,
                      backgroundColor: 'white',
                      borderRadius: 10
                    }} />
                  </View>
                </TouchableOpacity>

                {/* Processing Quality */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="wand.and.stars" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Processing Quality
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Maximum quality (slower)
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Storage Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                Storage
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Storage Usage */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="chart.pie" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Storage Usage
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      View app storage details
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Clear Cache */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="trash" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Clear Cache
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Free up temporary storage
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* About Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                About
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Version */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="info.circle" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Version
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      1.0.0
                    </Text>
                  </View>
                </View>

                {/* Help & Support */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol name="questionmark.circle" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Help & Support
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Get help using the app
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}