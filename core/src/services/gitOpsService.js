const { execSync } = require('child_process');
const path = require('path');

class GitOpsService {
  /**
   * Commits the updated agent config file and attempts to push to origin if configured.
   * @param {string} tenantId 
   * @param {string} companyName 
   */
  async commitAgentConfig(tenantId, companyName) {
    try {
      // The workspace root is 3 levels up from core/src/services
      const rootDir = path.join(__dirname, '..', '..', '..');
      
      // 1. Stage the specific database file containing configurations
      execSync('git add core/data/tenants.json', { cwd: rootDir, stdio: 'ignore' });
      
      // 2. Commit the changes with an expressive descriptive engineering message
      const commitMessage = `feat(agent-prompt): calibrate tuning & voice metrics for ${companyName} (${tenantId})`;
      execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'ignore' });
      
      // 3. Extract the short commit SHA
      const sha = execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
      
      let pushStatus = 'Local Commit Registered';
      
      // 4. Try to push changes if a remote 'origin' is configured
      try {
        const hasRemote = execSync('git remote get-url origin', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
        if (hasRemote) {
          const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
          execSync(`git push origin ${currentBranch}`, { cwd: rootDir, stdio: 'ignore' });
          pushStatus = `Pushed and Sync'd to origin/${currentBranch}`;
        }
      } catch (remoteErr) {
        // No remote configured, which is a normal state for local development
        pushStatus = 'Saved locally (Run git remote add origin <repo> to link GitHub)';
      }
      
      console.log(`[GitOps] Commit [${sha}]: "${commitMessage}". Status: ${pushStatus}`);
      return {
        success: true,
        sha,
        commitMessage,
        pushStatus
      };
    } catch (error) {
      console.error('[GitOpsService Error]:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new GitOpsService();
