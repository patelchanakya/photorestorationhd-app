import { useVideoPlayer, VideoPlayer } from 'expo-video';
import React from 'react';

// Hook-based pooled video player
export function usePooledVideoPlayer(source: any) {
  const [isActive, setIsActive] = React.useState(false);
  
  // Create player using the proper hook
  const player = useVideoPlayer(source, (player: VideoPlayer) => {
    player.loop = true;
    player.muted = true;
  });

  // Track if this player is currently being used
  React.useEffect(() => {
    setIsActive(true);
    
    // Cleanup when component unmounts
    return () => {
      setIsActive(false);
      try {
        player.pause();
      } catch (error) {
        // Silent cleanup
      }
    };
  }, [player]);

  return { player, isActive };
}

// Simple global tracking for debugging
let activePlayerCount = 0;

export function useVideoPlayerWithLimit(source: any, limit: number = 5) {
  const [playerCreated, setPlayerCreated] = React.useState(false);
  
  // Check if we're under the global limit (10 total videos across all components)
  const canCreatePlayer = activePlayerCount < 10;
  
  const player = useVideoPlayer(
    canCreatePlayer ? source : null, 
    (player: VideoPlayer) => {
      if (player) {
        player.loop = true;
        player.muted = true;
      }
    }
  );

  React.useEffect(() => {
    if (player && canCreatePlayer && !playerCreated) {
      activePlayerCount++;
      setPlayerCreated(true);
      
      if (__DEV__) {
        console.log(`📹 Video player created. Active count: ${activePlayerCount}`);
      }
    }
  }, [player, canCreatePlayer, playerCreated]);

  React.useEffect(() => {
    return () => {
      if (playerCreated && player) {
        activePlayerCount--;
        setPlayerCreated(false);
        
        try {
          player.pause();
        } catch (error) {
          // Silent cleanup
        }
        
        if (__DEV__) {
          console.log(`🧹 Video player released. Active count: ${activePlayerCount}`);
        }
      }
    };
  }, [playerCreated, player]);

  return canCreatePlayer ? player : null;
}