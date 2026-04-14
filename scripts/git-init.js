const { execSync } = require('child_process');
const opts = { stdio: 'inherit', cwd: 'C:\\projetos\\chamados', shell: true };
execSync('git init', opts);
execSync('git add .', opts);
execSync('git commit -m "feat: implementacao inicial do sistema de chamados"', opts);
execSync('git branch -M main', opts);
execSync('git remote add origin https://github.com/EricOFreitas/chamados.git', opts);
execSync('git push -u origin main', opts);
