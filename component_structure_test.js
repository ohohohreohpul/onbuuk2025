// Component Structure Test for Account Settings
// This test verifies the component structure without requiring authentication

import fs from 'fs';
import path from 'path';

console.log('🔍 Testing Account Settings Component Structure...\n');

// Test 1: Verify AccountSettings.tsx exists and has required elements
const accountSettingsPath = '/app/src/components/admin/settings/AccountSettings.tsx';
try {
  const accountSettingsContent = fs.readFileSync(accountSettingsPath, 'utf8');
  
  console.log('✅ AccountSettings.tsx file exists');
  
  // Check for required imports
  const requiredImports = [
    'useState', 'useEffect', 'supabase', 'Save', 'AlertCircle', 
    'CheckCircle', 'Mail', 'Lock', 'Eye', 'EyeOff', 'User'
  ];
  
  requiredImports.forEach(importItem => {
    if (accountSettingsContent.includes(importItem)) {
      console.log(`✅ Contains required import: ${importItem}`);
    } else {
      console.log(`❌ Missing import: ${importItem}`);
    }
  });
  
  // Check for required UI elements
  const requiredElements = [
    'Logged in as',
    'Change Email Address', 
    'Change Password',
    'Security Tips',
    'Current Email',
    'New Email Address',
    'New Password',
    'Confirm New Password',
    'Update Email',
    'Update Password'
  ];
  
  console.log('\n📋 Checking for required UI elements:');
  requiredElements.forEach(element => {
    if (accountSettingsContent.includes(element)) {
      console.log(`✅ Contains UI element: "${element}"`);
    } else {
      console.log(`❌ Missing UI element: "${element}"`);
    }
  });
  
  // Check for form validation
  const validationChecks = [
    'emailRegex.test',
    'newPassword.length < 6',
    'newPassword !== confirmPassword',
    'Please enter a new password',
    'Passwords do not match',
    'Please enter a valid email address'
  ];
  
  console.log('\n🧪 Checking for form validation:');
  validationChecks.forEach(validation => {
    if (accountSettingsContent.includes(validation)) {
      console.log(`✅ Contains validation: ${validation}`);
    } else {
      console.log(`❌ Missing validation: ${validation}`);
    }
  });
  
  // Check for password visibility toggles
  if (accountSettingsContent.includes('showNewPassword') && 
      accountSettingsContent.includes('showConfirmPassword') &&
      accountSettingsContent.includes('EyeOff')) {
    console.log('✅ Password visibility toggles implemented');
  } else {
    console.log('❌ Password visibility toggles missing or incomplete');
  }
  
} catch (error) {
  console.log(`❌ Error reading AccountSettings.tsx: ${error.message}`);
}

// Test 2: Verify SettingsView.tsx has Account tab as first and default
const settingsViewPath = '/app/src/components/admin/SettingsView.tsx';
try {
  const settingsViewContent = fs.readFileSync(settingsViewPath, 'utf8');
  
  console.log('\n✅ SettingsView.tsx file exists');
  
  // Check if Account tab is first in the tabs array
  const tabsArrayMatch = settingsViewContent.match(/const tabs = \[([\s\S]*?)\];/);
  if (tabsArrayMatch) {
    const tabsContent = tabsArrayMatch[1];
    const firstTab = tabsContent.trim().split('\n')[0];
    
    if (firstTab.includes("'account'") && firstTab.includes('Account') && firstTab.includes('User')) {
      console.log('✅ Account tab is first in tabs array with User icon');
    } else {
      console.log('❌ Account tab is not first or missing proper configuration');
    }
  }
  
  // Check if Account is set as default active tab
  if (settingsViewContent.includes("useState<SettingsTab>('account')")) {
    console.log('✅ Account tab is set as default active tab');
  } else {
    console.log('❌ Account tab is not set as default active tab');
  }
  
  // Check if AccountSettings component is imported and rendered
  if (settingsViewContent.includes("import AccountSettings") && 
      settingsViewContent.includes("activeTab === 'account' && <AccountSettings />")) {
    console.log('✅ AccountSettings component is properly imported and rendered');
  } else {
    console.log('❌ AccountSettings component import or rendering issue');
  }
  
} catch (error) {
  console.log(`❌ Error reading SettingsView.tsx: ${error.message}`);
}

// Test 3: Check component dependencies
console.log('\n🔗 Checking component dependencies:');

const requiredFiles = [
  '/app/src/lib/supabase.ts',
  '/app/src/components/ui/button.tsx',
  '/app/src/components/ui/input.tsx',
  '/app/src/components/ui/card.tsx'
];

requiredFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`✅ Dependency exists: ${path.basename(filePath)}`);
  } else {
    console.log(`❌ Missing dependency: ${path.basename(filePath)}`);
  }
});

console.log('\n🏁 Component structure test completed');