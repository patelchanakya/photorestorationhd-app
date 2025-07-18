import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRestorationStore } from '@/store/restorationStore';
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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function SettingsModalScreen() {
  const router = useRouter();
  const { showFlashButton, toggleFlashButton } = useRestorationStore();

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
            
            {/* Connect & Support Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                Connect & Support
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Follow Us */}
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
                    <Ionicons name="people" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Follow Us
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity>
                      <FontAwesome5 name="pinterest" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <FontAwesome5 name="facebook" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <FontAwesome5 name="instagram" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <FontAwesome5 name="tiktok" size={20} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Email Support */}
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
                    <Ionicons name="mail" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    E-mail Support
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Rate Us */}
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
                    <Ionicons name="star" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Like Us? Rate us!
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Share App */}
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
                    <Ionicons name="share-social" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Share App
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Preferences Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                Preferences
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Language */}
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
                    <Ionicons name="globe" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Language
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 20 }}>🇬🇧</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>English</Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                
                {/* Show Flash Toggle */}
                <TouchableOpacity 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16
                  }}
                  onPress={toggleFlashButton}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(249,115,22,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="flash" size={18} color="#f97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Show Flash Button
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Display flash toggle on camera
                    </Text>
                  </View>
                  <View style={{
                    width: 44,
                    height: 24,
                    backgroundColor: showFlashButton ? '#f97316' : 'rgba(255,255,255,0.2)',
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: showFlashButton ? 'flex-end' : 'flex-start',
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

                {/* Delete All Photos */}
                <TouchableOpacity style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16
                }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '500' }}>
                      Delete All Photos
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                      Remove all saved photos permanently
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Account & Legal Section */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ 
                color: 'rgba(249,115,22,1)', 
                fontSize: 16, 
                fontWeight: '600', 
                marginBottom: 16 
              }}>
                Account & Legal
              </Text>
              
              <View style={{ 
                backgroundColor: 'rgba(255,255,255,0.05)', 
                borderRadius: 12, 
                overflow: 'hidden' 
              }}>
                
                {/* Restore Purchases */}
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
                    <Ionicons name="refresh" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Restore Purchases
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Privacy Policy */}
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
                    <Ionicons name="lock-closed" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Privacy Policy
                  </Text>
                  <IconSymbol name="chevron.right" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Terms of Use */}
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
                    <Ionicons name="document-text" size={18} color="#f97316" />
                  </View>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '500', flex: 1 }}>
                    Terms of Use
                  </Text>
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
          
          {/* Version Info */}
          <View style={{ 
            alignItems: 'center', 
            paddingVertical: 20,
            marginTop: 10
          }}>
            <Text style={{ 
              color: 'rgba(255,255,255,0.4)', 
              fontSize: 14,
              fontWeight: '400'
            }}>
              App version: 3.2 (1)
            </Text>
          </View>
          
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}