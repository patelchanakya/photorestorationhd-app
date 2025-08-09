// Quick test script - run with: node testBackToLife.js
// (This won't actually work since it needs React Native env, but shows the test pattern)

import { backToLifeService } from './services/backToLifeService';

async function testBackToLifeService() {
  console.log('🧪 Testing Back to Life Service...');
  
  try {
    // Test 1: Check usage
    console.log('\n1. Testing checkUsage()...');
    const usage = await backToLifeService.checkUsage();
    console.log('Usage result:', usage);
    
    // Test 2: Try increment (only if can use)
    if (usage.canUse) {
      console.log('\n2. Testing incrementUsage()...');
      const incrementResult = await backToLifeService.incrementUsage();
      console.log('Increment result:', incrementResult);
      
      // Test 3: Check usage again
      console.log('\n3. Checking usage after increment...');
      const newUsage = await backToLifeService.checkUsage();
      console.log('New usage:', newUsage);
    } else {
      console.log('\n2. Cannot increment - user at limit');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBackToLife();