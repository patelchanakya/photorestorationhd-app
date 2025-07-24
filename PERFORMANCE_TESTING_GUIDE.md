# Performance Testing Guide for Photo Restoration HD App

This guide helps you verify that the performance optimizations are working correctly.

## Performance Optimizations Implemented

### 1. React.memo Optimization
- **BeforeAfterSlider** - Prevents unnecessary re-renders
- **ProcessingScreen** - Avoids animation restarts
- **PhotoPicker** - Reduces parent-triggered re-renders

### 2. FlatList Optimizations
- **Gallery Modal** - Added memory management and batch rendering
- **Restoration Screen** - Optimized horizontal scroll performance

## Testing Tools Required

### 1. React DevTools
Install React DevTools for React Native:
```bash
npm install -g react-devtools
# Then run:
react-devtools
```

### 2. Flipper (Recommended)
Download from: https://fbflipper.com/
- Install React DevTools plugin
- Install Layout Inspector plugin
- Install Network plugin

### 3. Built-in Metro Performance Monitor
Shake device → "Show Perf Monitor"

## Testing React.memo Optimizations

### Step 1: Enable Component Highlighting
1. Open React DevTools
2. Go to Settings (gear icon)
3. Enable "Highlight updates when components render"
4. Components will flash when they re-render

### Step 2: Test BeforeAfterSlider
1. Navigate to a restoration result screen
2. Interact with other UI elements (buttons, text)
3. **Expected**: BeforeAfterSlider should NOT flash/re-render
4. Only when dragging the slider should it update

### Step 3: Test ProcessingScreen
1. Start a photo restoration
2. Navigate away and back
3. **Expected**: Animations continue smoothly without restarting

### Step 4: Test PhotoPicker
1. Go to home screen
2. Toggle between modes
3. **Expected**: PhotoPicker should NOT re-render when switching modes

## Testing FlatList Optimizations

### Gallery Modal Performance Test

#### Memory Usage Test:
1. Open gallery with 50+ images
2. Scroll rapidly up and down
3. Check memory in Flipper or Xcode/Android Studio
4. **Expected**: Memory should stabilize, not continuously grow

#### Scroll Performance Test:
1. Open Performance Monitor (shake → Show Perf Monitor)
2. Scroll through gallery
3. **Expected**: 
   - JS FPS should stay above 50
   - UI FPS should stay at 60
   - No dropped frames

#### Verification Commands:
```javascript
// In React DevTools console
$r.props // Check FlatList props
// Should see: removeClippedSubviews: true, maxToRenderPerBatch: 10, etc.
```

### Restoration Screen Horizontal List Test

1. Open restoration with 10+ recent items
2. Scroll horizontally rapidly
3. **Expected**: Smooth 60fps scrolling
4. Check that off-screen items are unmounted (memory efficient)

## Performance Metrics to Monitor

### 1. JS Thread FPS
- Target: > 50 FPS during interactions
- Critical: < 30 FPS indicates performance issues

### 2. UI Thread FPS  
- Target: 60 FPS (smooth)
- Acceptable: > 55 FPS
- Poor: < 45 FPS

### 3. Memory Usage
- Monitor in Xcode Instruments or Android Studio Profiler
- Should stabilize after initial load
- No continuous growth during scrolling

### 4. Component Render Count
```javascript
// Add to any component to track renders
const renderCount = useRef(0);
renderCount.current++;
console.log(`Component rendered ${renderCount.current} times`);
```

## Before/After Comparison

### Test 1: Parent Re-render Impact
1. Add a state counter to parent component:
```javascript
const [counter, setCounter] = useState(0);
// Add button to increment counter
```

2. **Before optimization**: Child components re-render on every count change
3. **After optimization**: Only components using the counter re-render

### Test 2: Gallery Scroll Memory
1. **Before**: Memory increases with each scroll
2. **After**: Memory stabilizes due to `removeClippedSubviews`

### Test 3: Large List Performance
1. Generate 100+ restorations (or mock data)
2. **Before**: Janky scrolling, high memory
3. **After**: Smooth scrolling, controlled memory

## Quick Performance Audit Script

Add this temporary code to measure performance:

```javascript
// Add to app/_layout.tsx temporarily
useEffect(() => {
  const measurePerformance = () => {
    console.log('=== Performance Metrics ===');
    console.log('JS Heap:', performance.memory?.usedJSHeapSize / 1048576, 'MB');
    console.log('Total Heap:', performance.memory?.totalJSHeapSize / 1048576, 'MB');
  };
  
  const interval = setInterval(measurePerformance, 5000);
  return () => clearInterval(interval);
}, []);
```

## Automated Performance Testing

### Using Detox (Optional)
```javascript
// Example Detox test for scroll performance
it('should maintain 60fps while scrolling gallery', async () => {
  await element(by.id('gallery-modal')).swipe('up', 'fast');
  // Check performance metrics
  const metrics = await device.getPerformanceMetrics();
  expect(metrics.fps).toBeGreaterThan(55);
});
```

## Performance Optimization Checklist

- [ ] React DevTools shows reduced re-renders
- [ ] FlatList props are applied (check in DevTools)
- [ ] Memory remains stable during scrolling
- [ ] JS FPS stays above 50 during interactions
- [ ] UI FPS maintains 60 during animations
- [ ] No console warnings about performance
- [ ] App feels noticeably smoother

## Troubleshooting

### If optimizations aren't working:

1. **Verify React.memo is applied**:
   ```javascript
   console.log(BeforeAfterSlider.$$typeof); // Should show React.Memo
   ```

2. **Check FlatList props**:
   ```javascript
   // In component
   console.log('FlatList props:', props);
   ```

3. **Enable Metro bundler cache clear**:
   ```bash
   npx react-native start --reset-cache
   ```

4. **Force refresh**:
   - iOS: Cmd + R in simulator
   - Android: R,R in emulator

## Performance Benchmarks

Good performance indicators:
- App launch: < 2 seconds
- Image processing start: < 500ms response
- Gallery open: < 300ms
- Scroll FPS: 60 constant
- Memory: < 200MB for typical usage