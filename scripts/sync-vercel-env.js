#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMP_ENV_FILE = '.env.vercel.tmp';
const LOCAL_ENV_FILE = '.env.local';

function log(message) {
  console.log(`🔧 ${message}`);
}

function error(message) {
  console.error(`❌ ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    return true;
  } catch (err) {
    error('Vercel CLI not found. Install it with: npm i -g vercel');
    return false;
  }
}

function isLinkedToVercel() {
  try {
    const vercelDir = path.join(process.cwd(), '.vercel');
    const projectFile = path.join(vercelDir, 'project.json');
    return fs.existsSync(projectFile);
  } catch (err) {
    return false;
  }
}

function linkToVercel() {
  log('Project not linked to Vercel. Running vercel link...');
  try {
    execSync('vercel link', { stdio: 'inherit' });
    success('Successfully linked to Vercel');
    return true;
  } catch (err) {
    error('Failed to link to Vercel. Please run "vercel link" manually.');
    return false;
  }
}

function pullVercelEnv() {
  log('Pulling environment variables from Vercel...');
  try {
    const result = execSync(`vercel env pull ${TEMP_ENV_FILE}`, { stdio: 'pipe' });
    success('Environment variables pulled successfully');
    return true;
  } catch (err) {
    error('Failed to pull environment variables from Vercel');
    
    // Check if it's an authentication issue
    if (err.message.includes('Authentication required') || err.message.includes('not authenticated')) {
      error('Please authenticate with Vercel first: vercel login');
    } else if (err.message.includes('No deployments found')) {
      error('No Vercel deployments found. Make sure your project is deployed to Vercel.');
    } else {
      console.error(err.message);
    }
    
    return false;
  }
}

function extractVercelOIDCToken() {
  if (!fs.existsSync(TEMP_ENV_FILE)) {
    error(`Temporary env file ${TEMP_ENV_FILE} not found`);
    return null;
  }

  try {
    const envContent = fs.readFileSync(TEMP_ENV_FILE, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('VERCEL_OIDC_TOKEN=')) {
        const token = line.split('=').slice(1).join('='); // Handle tokens with = in them
        if (token) {
          // Remove surrounding quotes if present
          const cleanToken = token.replace(/^["']|["']$/g, '');
          success('Found VERCEL_OIDC_TOKEN in Vercel environment');
          return cleanToken;
        }
      }
    }
    
    log('VERCEL_OIDC_TOKEN not found in Vercel environment (this is normal if not set)');
    return null;
  } catch (err) {
    error('Failed to read temporary env file');
    return null;
  }
}

function updateLocalEnv(vercelOIDCToken) {
  try {
    let localEnvContent = '';
    let hasVercelOIDCToken = false;
    let existingLines = [];
    
    // Read existing .env.local if it exists and preserve all other variables
    if (fs.existsSync(LOCAL_ENV_FILE)) {
      localEnvContent = fs.readFileSync(LOCAL_ENV_FILE, 'utf8');
      existingLines = localEnvContent.split('\n');
      
      // Check if VERCEL_OIDC_TOKEN already exists and update only that line
      const updatedLines = existingLines.map(line => {
        if (line.trim().startsWith('VERCEL_OIDC_TOKEN=')) {
          hasVercelOIDCToken = true;
          return `VERCEL_OIDC_TOKEN="${vercelOIDCToken}"`;
        }
        return line; // Preserve all other lines exactly as they are
      });
      
      if (hasVercelOIDCToken) {
        localEnvContent = updatedLines.join('\n');
        success('Updated existing VERCEL_OIDC_TOKEN in .env.local (preserving other variables)');
      } else {
        // Add VERCEL_OIDC_TOKEN to the end while preserving existing content
        if (!localEnvContent.endsWith('\n') && localEnvContent.length > 0) {
          localEnvContent += '\n';
        }
        localEnvContent += `VERCEL_OIDC_TOKEN="${vercelOIDCToken}"`;
        if (!localEnvContent.endsWith('\n')) {
          localEnvContent += '\n';
        }
        success('Added VERCEL_OIDC_TOKEN to .env.local (preserving existing variables)');
      }
    } else {
      // Create new .env.local with VERCEL_OIDC_TOKEN and a helpful comment
      localEnvContent = `# Created by Vercel CLI\nVERCEL_OIDC_TOKEN="${vercelOIDCToken}"\n`;
      success('Created .env.local with VERCEL_OIDC_TOKEN');
    }
    
    fs.writeFileSync(LOCAL_ENV_FILE, localEnvContent, 'utf8');
    
  } catch (err) {
    error('Failed to update .env.local');
    console.error(err.message);
  }
}

function cleanupTempFile() {
  if (fs.existsSync(TEMP_ENV_FILE)) {
    try {
      fs.unlinkSync(TEMP_ENV_FILE);
      log('Cleaned up temporary env file');
    } catch (err) {
      error('Failed to cleanup temporary env file');
    }
  }
}

function main() {
  log('Starting Vercel environment sync...');
  
  // Check if Vercel CLI is available
  if (!checkVercelCLI()) {
    process.exit(1);
  }
  
  // Check if project is linked to Vercel
  if (!isLinkedToVercel()) {
    if (!linkToVercel()) {
      process.exit(1);
    }
  } else {
    success('Project is already linked to Vercel');
  }
  
  // Pull environment variables from Vercel
  if (!pullVercelEnv()) {
    process.exit(1);
  }
  
  // Extract VERCEL_OIDC_TOKEN
  const vercelOIDCToken = extractVercelOIDCToken();
  
  if (vercelOIDCToken) {
    // Update .env.local with the token
    updateLocalEnv(vercelOIDCToken);
  } else {
    log('No VERCEL_OIDC_TOKEN to sync');
  }
  
  // Cleanup temporary file
  cleanupTempFile();
  
  success('Vercel environment sync completed!');
}

// Handle cleanup on process exit
process.on('exit', cleanupTempFile);
process.on('SIGINT', () => {
  cleanupTempFile();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupTempFile();
  process.exit(0);
});

main();