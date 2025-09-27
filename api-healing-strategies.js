const Logger = require('./logger');
const axios = require('axios');

class APIHealingStrategies {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('APIHealingStrategies');
  }

  async generateStrategies(context) {
    const { error, experiment } = context;
    const strategies = [];

    // Strategy 1: Alternative Endpoints
    if (this.isEndpointError(error)) {
      strategies.push({
        name: 'alternative_endpoints',
        type: 'api',
        confidence: 80,
        description: 'Try alternative API endpoint variations',
        apply: (strategy, ctx) => this.applyAlternativeEndpoints(strategy, ctx)
      });
    }

    // Strategy 2: API Versioning
    strategies.push({
      name: 'api_versioning',
      type: 'api',
      confidence: 75,
      description: 'Try different API versions',
      apply: (strategy, ctx) => this.applyAPIVersioning(strategy, ctx)
    });

    // Strategy 3: Request/Response Healing
    if (this.isDataError(error)) {
      strategies.push({
        name: 'data_format_healing',
        type: 'api',
        confidence: 70,
        description: 'Adapt request/response data formats',
        apply: (strategy, ctx) => this.applyDataFormatHealing(strategy, ctx)
      });
    }

    // Strategy 4: Authentication Healing
    if (this.isAuthError(error)) {
      strategies.push({
        name: 'auth_healing',
        type: 'api',
        confidence: 85,
        description: 'Fix authentication issues',
        apply: (strategy, ctx) => this.applyAuthHealing(strategy, ctx)
      });
    }

    // Strategy 5: Retry with Exponential Backoff
    strategies.push({
      name: 'exponential_backoff',
      type: 'api',
      confidence: 60,
      description: 'Retry with exponential backoff',
      apply: (strategy, ctx) => this.applyExponentialBackoff(strategy, ctx)
    });

    return strategies;
  }

  async apply(strategy, context) {
    this.logger.info(`Applying API healing strategy: ${strategy.name}`);
    return await strategy.apply(strategy, context);
  }

  async applyAlternativeEndpoints(strategy, context) {
    const { experiment, error } = context;
    const changes = [];
    
    const failedEndpoint = this.extractEndpoint(error);
    const alternatives = this.generateEndpointAlternatives(failedEndpoint);
    
    for (const altEndpoint of alternatives) {
      try {
        const response = await axios.get(altEndpoint, {
          timeout: 10000,
          headers: this.getDefaultHeaders()
        });
        
        if (response.status === 200) {
          this.updateExperimentEndpoints(experiment, failedEndpoint, altEndpoint);
          changes.push(`Updated endpoint: ${failedEndpoint} -> ${altEndpoint}`);
          
          this.logger.info(`Endpoint healing successful: ${altEndpoint}`);
          return { success: true, changes };
        }
        
      } catch (endpointError) {
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyAPIVersioning(strategy, context) {
    const { experiment } = context;
    const changes = [];
    
    const versions = ['v1', 'v2', 'v3', 'v4'];
    const baseEndpoints = this.getExperimentEndpoints(experiment);
    
    for (const endpoint of baseEndpoints) {
      for (const version of versions) {
        const versionedEndpoint = this.createVersionedEndpoint(endpoint, version);
        
        try {
          const response = await axios.get(versionedEndpoint, {
            timeout: 10000,
            headers: this.getDefaultHeaders()
          });
          
          if (response.status === 200) {
            changes.push(`Found working API version: ${version}`);
            this.updateExperimentEndpoints(experiment, endpoint, versionedEndpoint);
            return { success: true, changes };
          }
          
        } catch (versionError) {
          continue;
        }
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyDataFormatHealing(strategy, context) {
    const { experiment } = context;
    const changes = [];
    
    // Try different content types and data formats
    const formatStrategies = [
      { contentType: 'application/json', transform: data => JSON.stringify(data) },
      { contentType: 'application/x-www-form-urlencoded', transform: data => new URLSearchParams(data) },
      { contentType: 'multipart/form-data', transform: data => this.createFormData(data) }
    ];
    
    const testData = this.getExperimentTestData(experiment);
    
    for (const formatStrategy of formatStrategies) {
      try {
        const transformedData = formatStrategy.transform(testData);
        
        // Test with a sample endpoint
        const testEndpoint = this.getTestEndpoint(experiment);
        const response = await axios.post(testEndpoint, transformedData, {
          headers: {
            'Content-Type': formatStrategy.contentType,
            ...this.getDefaultHeaders()
          },
          timeout: 10000
        });
        
        if (response.status === 200 || response.status === 201) {
          changes.push(`Data format healing: ${formatStrategy.contentType}`);
          return { success: true, changes };
        }
        
      } catch (formatError) {
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyAuthHealing(strategy, context) {
    const { experiment } = context;
    const changes = [];
    
    // Try different authentication methods
    const authStrategies = [
      { type: 'bearer', header: 'Authorization', value: `Bearer ${this.getToken()}` },
      { type: 'api_key', header: 'X-API-Key', value: this.getApiKey() },
      { type: 'basic', header: 'Authorization', value: this.getBasicAuth() }
    ];
    
    const testEndpoint = this.getTestEndpoint(experiment);
    
    for (const authStrategy of authStrategies) {
      try {
        const response = await axios.get(testEndpoint, {
          headers: {
            [authStrategy.header]: authStrategy.value,
            ...this.getDefaultHeaders()
          },
          timeout: 10000
        });
        
        if (response.status === 200) {
          changes.push(`Auth healing successful: ${authStrategy.type}`);
          this.updateExperimentAuth(experiment, authStrategy);
          return { success: true, changes };
        }
        
      } catch (authError) {
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyExponentialBackoff(strategy, context) {
    const { experiment } = context;
    const changes = [];
    
    const maxRetries = 5;
    let delay = 1000; // Start with 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const testEndpoint = this.getTestEndpoint(experiment);
        const response = await axios.get(testEndpoint, {
          timeout: 30000,
          headers: this.getDefaultHeaders()
        });
        
        if (response.status === 200) {
          changes.push(`Retry successful on attempt ${attempt} with ${delay}ms delay`);
          return { success: true, changes };
        }
        
      } catch (retryError) {
        delay *= 2; // Exponential backoff
        if (attempt === maxRetries) {
          break;
        }
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  // Helper methods
  
  isEndpointError(error) {
    return /404|not found|endpoint.*invalid|url.*invalid/i.test(error.message);
  }

  isDataError(error) {
    return /400|bad request|invalid.*data|schema.*error/i.test(error.message);
  }

  isAuthError(error) {
    return /401|403|unauthorized|forbidden|authentication/i.test(error.message);
  }

  extractEndpoint(error) {
    // Extract endpoint URL from error message
    const urlMatch = error.message.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : '';
  }

  generateEndpointAlternatives(endpoint) {
    if (!endpoint) return [];
    
    const alternatives = [];
    const url = new URL(endpoint);
    
    // Try common endpoint variations
    const pathVariations = [
      url.pathname.replace(/\/v\d+/, '/v1'),
      url.pathname.replace(/\/v\d+/, '/v2'),
      url.pathname.replace(/\/$/, ''),
      url.pathname + '/',
      url.pathname.replace(/s$/, ''), // Remove plural
      url.pathname + 's' // Add plural
    ];
    
    pathVariations.forEach(path => {
      alternatives.push(`${url.protocol}//${url.host}${path}${url.search}`);
    });
    
    return [...new Set(alternatives)]; // Remove duplicates
  }

  createVersionedEndpoint(endpoint, version) {
    const url = new URL(endpoint);
    // Replace existing version or add new one
    url.pathname = url.pathname.replace(/\/v\d+/, `/${version}`);
    if (!url.pathname.includes(`/${version}`)) {
      url.pathname = `/${version}${url.pathname}`;
    }
    return url.toString();
  }

  getDefaultHeaders() {
    return {
      'User-Agent': 'Self-Healing-AB-Test-Framework',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
  }

  getToken() {
    return this.config.authToken || process.env.API_TOKEN || '';
  }

  getApiKey() {
    return this.config.apiKey || process.env.API_KEY || '';
  }

  getBasicAuth() {
    const username = this.config.username || process.env.API_USERNAME || '';
    const password = this.config.password || process.env.API_PASSWORD || '';
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  getExperimentEndpoints(experiment) {
    return experiment.variants
      .flatMap(variant => variant.apiEndpoints || [])
      .filter(endpoint => endpoint);
  }

  getTestEndpoint(experiment) {
    const endpoints = this.getExperimentEndpoints(experiment);
    return endpoints[0] || experiment.baseApiUrl || '';
  }

  getExperimentTestData(experiment) {
    return experiment.testData || {};
  }

  createFormData(data) {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    return formData;
  }

  updateExperimentEndpoints(experiment, oldEndpoint, newEndpoint) {
    experiment.variants.forEach(variant => {
      if (variant.apiEndpoints) {
        const index = variant.apiEndpoints.indexOf(oldEndpoint);
        if (index !== -1) {
          variant.apiEndpoints[index] = newEndpoint;
        }
      }
    });
  }

  updateExperimentAuth(experiment, authStrategy) {
    experiment.authConfig = {
      type: authStrategy.type,
      header: authStrategy.header,
      value: authStrategy.value
    };
  }
}

module.exports = APIHealingStrategies;