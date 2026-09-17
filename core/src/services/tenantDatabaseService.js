const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'tenants.json');

class TenantDatabaseService {
  constructor() {
    this.ensureDatabase();
  }

  ensureDatabase() {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
    }
  }

  // Load all tenants
  getAllTenants() {
    try {
      this.ensureDatabase();
      const content = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('[TenantDatabaseService] Error reading tenants:', err);
      return {};
    }
  }

  // Find dynamic tenant config
  async getTenantConfig(tenantId) {
    const db = this.getAllTenants();
    const config = db[tenantId];
    if (!config) {
      console.warn(`[TenantDatabaseService] Tenant ${tenantId} not found, falling back to mi-empresa.`);
      return db['mi-empresa'];
    }
    return config;
  }

  // Save or update tenant config
  async saveTenantConfig(tenantId, tenantConfig) {
    try {
      const db = this.getAllTenants();
      db[tenantId] = {
        tenantId,
        ...tenantConfig,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
      console.log(`[TenantDatabaseService] Saved config for tenant: ${tenantId}`);
      return { success: true };
    } catch (err) {
      console.error('[TenantDatabaseService] Error saving tenant:', err);
      throw err;
    }
  }
}

module.exports = new TenantDatabaseService();
