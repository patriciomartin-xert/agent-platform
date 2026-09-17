const config = require('../config/config');

class SalesforceService {
  constructor() {
    this.leadsDb = [];
    this.opportunitiesDb = [];
    this.casesDb = [];
  }

  async createLead(tenantId, leadData) {
    console.log(`[Salesforce - Lead] Create lead requested for ${tenantId}:`, leadData);
    
    const lead = {
      id: `sf_lead_${Date.now()}`,
      tenantId,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone || '',
      status: 'Open - Not Contacted',
      createdAt: new Date().toISOString()
    };

    if (config.IS_MOCK_SALESFORCE) {
      this.leadsDb.push(lead);
      console.log(`[Salesforce MOCK] Created Lead:`, lead);
      return { success: true, leadId: lead.id, mock: true };
    }

    // Live OAuth + REST API call would go here
    return { success: true, leadId: `live_sf_${Date.now()}` };
  }

  async updateOpportunityStage(tenantId, email, stageName) {
    console.log(`[Salesforce - Opportunity] Update requested: ${email} -> ${stageName}`);
    
    if (config.IS_MOCK_SALESFORCE) {
      const opp = {
        id: `sf_opp_${Date.now()}`,
        tenantId,
        customerEmail: email,
        stage: stageName,
        updatedAt: new Date().toISOString()
      };
      this.opportunitiesDb.push(opp);
      console.log(`[Salesforce MOCK] Updated Opportunity Stage:`, opp);
      return { success: true, oppId: opp.id, mock: true };
    }

    return { success: true };
  }

  async createCase(tenantId, caseData) {
    console.log(`[Salesforce - Case] Create case requested:`, caseData);

    const ticket = {
      id: `sf_case_${Date.now()}`,
      tenantId,
      customerEmail: caseData.email,
      subject: caseData.subject,
      description: caseData.description,
      status: 'New',
      createdAt: new Date().toISOString()
    };

    if (config.IS_MOCK_SALESFORCE) {
      this.casesDb.push(ticket);
      console.log(`[Salesforce MOCK] Created Support Case:`, ticket);
      return { success: true, caseId: ticket.id, mock: true };
    }

    return { success: true, caseId: `live_case_${Date.now()}` };
  }
}

module.exports = new SalesforceService();
