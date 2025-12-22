#!/usr/bin/env node

/**
 * ImageKit Configuration Validator
 * Run this script to validate your ImageKit setup
 * Usage: node validate-imagekit-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ImageKit Configuration Validator\n');
console.log('='.repeat(50));

// Load .env.local file
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.log('   Please create .env.local in the project root');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2];
    }
});

// Check required variables
const requiredVars = [
    'VITE_IMAGEKIT_PUBLIC_KEY',
    'VITE_IMAGEKIT_URL_ENDPOINT',
    'IMAGEKIT_PRIVATE_KEY'
];

console.log('\n📋 Checking Required Variables:\n');

let allPresent = true;
requiredVars.forEach(varName => {
    const value = envVars[varName];
    if (!value) {
        console.log(`❌ ${varName} - MISSING`);
        allPresent = false;
    } else {
        const masked = varName.includes('PRIVATE') || varName.includes('KEY')
            ? value.substring(0, 12) + '...' + value.substring(value.length - 4)
            : value;
        console.log(`✅ ${varName} - ${masked}`);
    }
});

// Check Supabase variables
console.log('\n📋 Checking Supabase Variables (for metadata):\n');

const supabaseVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
supabaseVars.forEach(varName => {
    const value = envVars[varName];
    if (!value) {
        console.log(`⚠️  ${varName} - MISSING (optional but recommended)`);
    } else {
        const masked = varName.includes('KEY')
            ? value.substring(0, 12) + '...' + value.substring(value.length - 4)
            : value;
        console.log(`✅ ${varName} - ${masked}`);
    }
});

// Validate format
console.log('\n📋 Validating Format:\n');

if (envVars.VITE_IMAGEKIT_PUBLIC_KEY) {
    if (envVars.VITE_IMAGEKIT_PUBLIC_KEY.startsWith('public_')) {
        console.log('✅ Public key format looks correct');
    } else {
        console.log('⚠️  Public key should start with "public_"');
    }
}

if (envVars.IMAGEKIT_PRIVATE_KEY) {
    if (envVars.IMAGEKIT_PRIVATE_KEY.startsWith('private_')) {
        console.log('✅ Private key format looks correct');
    } else {
        console.log('⚠️  Private key should start with "private_"');
    }
}

if (envVars.VITE_IMAGEKIT_URL_ENDPOINT) {
    if (envVars.VITE_IMAGEKIT_URL_ENDPOINT.startsWith('https://ik.imagekit.io/')) {
        console.log('✅ URL endpoint format looks correct');
    } else {
        console.log('⚠️  URL endpoint should start with "https://ik.imagekit.io/"');
    }
}

// Summary
console.log('\n' + '='.repeat(50));
if (allPresent) {
    console.log('✅ All required ImageKit variables are configured!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Start API server: npm run dev:api');
    console.log('   3. Test image upload in the app');
    console.log('   4. Check browser console for upload logs');
} else {
    console.log('❌ Some required variables are missing!');
    console.log('\n📝 To fix:');
    console.log('   1. Go to https://imagekit.io/dashboard/developer/api-keys');
    console.log('   2. Copy your credentials');
    console.log('   3. Add them to .env.local file');
    console.log('   4. Restart your dev servers');
}

console.log('\n📚 For more info, see: IMAGEKIT_SETUP.md');
console.log('='.repeat(50) + '\n');

process.exit(allPresent ? 0 : 1);
