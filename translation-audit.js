const fs = require('fs');
const path = require('path');

// Reference translation keys from en-US
const enUSPath = 'src/locales/en-US/translations.json';
const enUS = JSON.parse(fs.readFileSync(enUSPath, 'utf8'));

// New keys we added
const newKeys = [
  'explore.writeYourOwn',
  'explore.byClever', 
  'explore.rateUs.title',
  'explore.rateUs.subtitle',
  'explore.requestFeature.title',
  'explore.requestFeature.subtitle',
  'explore.reportBug.title',
  'explore.reportBug.subtitle',
  'popular.cleanBackground',
  'popular.blurBackground',
  'memorial.candlelightVigil',
  'memorial.restInPeace', 
  'memorial.heavenly',
  'outfits.makeDoctor',
  'magic.fixTornPhotos',
  'magic.removeStains',
  'magic.fixFadedPhotos',
  'magic.requestIdea',
  'magic.requestIdeaSubtitle',
  'magic.send',
  'magic.reportBugSubtitle',
  'magic.report',
  'faceBody.teethWhitening',
  'faceBody.fixClosedEyes',
  'faceBody.removeWrinkles', 
  'faceBody.removeRedEye',
  'common.choosePhoto',
  'common.videoLoading',
  'common.loading'
];

// Get value from nested object using dot notation
function getValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

// Get all language files
const localesDir = 'src/locales';
const languageFiles = fs.readdirSync(localesDir)
  .filter(dir => dir !== 'en-US' && fs.statSync(path.join(localesDir, dir)).isDirectory())
  .map(dir => ({
    code: dir,
    path: path.join(localesDir, dir, 'translations.json')
  }))
  .filter(lang => fs.existsSync(lang.path));

console.log('🌐 Translation Audit Report');
console.log('='.repeat(50));
console.log(`📊 Found ${languageFiles.length} language files to check`);
console.log(`🔍 Checking ${newKeys.length} new translation keys`);
console.log('');

let totalMissing = 0;
const missingByLanguage = {};

languageFiles.forEach(lang => {
  try {
    const translations = JSON.parse(fs.readFileSync(lang.path, 'utf8'));
    const missing = [];
    
    newKeys.forEach(key => {
      const enValue = getValue(enUS, key);
      const langValue = getValue(translations, key);
      
      if (enValue && !langValue) {
        missing.push({
          key,
          enValue: typeof enValue === 'object' ? JSON.stringify(enValue) : enValue
        });
      }
    });
    
    if (missing.length > 0) {
      console.log(`❌ ${lang.code}: ${missing.length} missing keys`);
      missingByLanguage[lang.code] = missing;
      totalMissing += missing.length;
    } else {
      console.log(`✅ ${lang.code}: Complete`);
    }
  } catch (error) {
    console.log(`⚠️  ${lang.code}: Error reading file - ${error.message}`);
  }
});

console.log('');
console.log('📈 Summary');
console.log('-'.repeat(30));
console.log(`📊 Total missing translations: ${totalMissing}`);
console.log(`🌍 Languages needing updates: ${Object.keys(missingByLanguage).length}`);
console.log(`🎯 Coverage: ${((languageFiles.length - Object.keys(missingByLanguage).length) / languageFiles.length * 100).toFixed(1)}%`);

if (Object.keys(missingByLanguage).length > 0) {
  console.log('');
  console.log('📝 Missing Keys by Language:');
  console.log('='.repeat(50));
  
  Object.entries(missingByLanguage).forEach(([langCode, missing]) => {
    console.log(`\n🌐 ${langCode}:`);
    missing.forEach(item => {
      console.log(`   ${item.key}: "${item.enValue}"`);
    });
  });
}