const fs = require('fs');
const { execSync } = require('child_process');

if (!fs.existsSync('dist/main.js')) {
  execSync('npm run build', { stdio: 'inherit' });
}
