const Logger = require('./logger');

class ConfigManager {
  constructor(configPath = null) {
    this.logger = new Logger('ConfigManager');
    this.config = {};
    this.configPath = configPath;
    this.loadConfiguration();
  }

  loadConfiguration() {
    this.logger.info('Loading configuration');
    
    // Load from environment variables
    this.loadEnvironmentConfig();
    
    // Load from config file if provided
    if (this.configPath) {
      this.loadFileConfig();
    }
    
    // Apply defaults
    this.applyDefaults();
    
    // Validate configuration
    this.validateConfig();
    
    this.logger.info('Configuration loaded successfully');
  }

  loadEnvironmentConfig() {
    this.config = {
      // AI Configuration
      ai: {
        provider: process.env.AI_PROVIDER || 'openai',
        openaiApiKey: process.env.OPENAI_API_KEY,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.AI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.1,
        maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 1500
      },
      
      // Healing Configuration
      healing: {
        enabled: process.env.ENABLE_HEALING !== 'false',
        enableAI: process.env.ENABLE_AI !== 'false',
        mode: process.env.HEALING_MODE || 'aggressive',
        maxAttempts: parseInt(process.env.MAX_HEALING_ATTEMPTS) || 5,
        timeout: parseInt(process.env.HEALING_TIMEOUT) || 300000,
        retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
      },
      
      // UI Testing Configuration
      ui: {
        maxWaitTime: parseInt(process.env.MAX_WAIT_TIME) || 30000,
        enableAILocatorGeneration: process.env.ENABLE_AI_LOCATOR_GENERATION !== 'false',
        enableSmartWaits: process.env.ENABLE_SMART_WAITS !== 'false',
        enableVisualHealing: process.env.ENABLE_VISUAL_HEALING !== 'false'
      },
      
      // API Testing Configuration
      api: {
        timeout: parseInt(process.env.API_TIMEOUT) || 30000,
        retries: parseInt(process.env.API_RETRIES) || 3,
        enableSchemaValidation: process.env.ENABLE_SCHEMA_VALIDATION !== 'false',
        enableResponseHealing: process.env.ENABLE_RESPONSE_HEALING !== 'false'
      },
      
      // Notification Configuration
      notifications: {
        email: {
          enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
          recipients: process.env.EMAIL_RECIPIENTS ? process.env.EMAIL_RECIPIENTS.split(',') : [],
          smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            username: process.env.SMTP_USERNAME,
            password: process.env.SMTP_PASSWORD
          }
        },
        slack: {
          enabled: process.env.SLACK_NOTIFICATIONS_ENABLED === 'true',
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#experiments'
        },
        teams: {
          enabled: process.env.TEAMS_NOTIFICATIONS_ENABLED === 'true',
          webhookUrl: process.env.TEAMS_WEBHOOK_URL
        },
        webhook: {
          enabled: process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true',
          url: process.env.WEBHOOK_URL,
          headers: this.parseHeaders(process.env.WEBHOOK_HEADERS)
        }
      },
      
      // Dashboard Configuration
      dashboard: {
        enabled: process.env.DASHBOARD_ENABLED !== 'false',
        port: parseInt(process.env.DASHBOARD_PORT) || 3000,
        url: process.env.DASHBOARD_URL || 'http://localhost:3000'
      },
      
      // Database Configuration
      database: {
        type: process.env.DATABASE_TYPE || 'memory',
        connectionString: process.env.DATABASE_CONNECTION_STRING,
        options: {
          maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
          timeout: parseInt(process.env.DB_TIMEOUT) || 30000
        }
      },
      
      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
        logDirectory: process.env.LOG_DIRECTORY || './logs',
        maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 10,
        maxLogSize: process.env.MAX_LOG_SIZE || '10MB'
      },
      
      // Security Configuration
      security: {
        enableApiKeyAuth: process.env.ENABLE_API_KEY_AUTH === 'true',
        apiKey: process.env.API_KEY,
        enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
        rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000 // 15 minutes
      }
    };
  }

  loadFileConfig() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      if (fs.existsSync(this.configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.config = this.mergeConfigs(this.config, fileConfig);
        this.logger.info(`Configuration loaded from file: ${this.configPath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load config file: ${error.message}`);
    }
  }

  applyDefaults() {
    // Apply intelligent defaults based on environment
    if (process.env.NODE_ENV === 'production') {
      this.config.healing.mode = this.config.healing.mode || 'conservative';
      this.config.logging.level = this.config.logging.level || 'warn';
      this.config.ai.temperature = Math.min(this.config.ai.temperature || 0.1, 0.2);
    } else if (process.env.NODE_ENV === 'development') {
      this.config.healing.mode = this.config.healing.mode || 'aggressive';
      this.config.logging.level = this.config.logging.level || 'debug';
      this.config.dashboard.enabled = this.config.dashboard.enabled !== false;
    }
    
    // Set reasonable timeouts based on healing mode
    if (this.config.healing.mode === 'aggressive') {
      this.config.healing.maxAttempts = Math.max(this.config.healing.maxAttempts, 5);
      this.config.healing.timeout = Math.max(this.config.healing.timeout, 300000);
    } else if (this.config.healing.mode === 'conservative') {
      this.config.healing.maxAttempts = Math.min(this.config.healing.maxAttempts, 3);
      this.config.healing.timeout = Math.min(this.config.healing.timeout, 120000);
    }
  }

  validateConfig() {
    const errors = [];
    
    // AI Configuration Validation
    if (this.config.healing.enableAI) {
      if (this.config.ai.provider === 'openai' && !this.config.ai.openaiApiKey) {
        errors.push('OpenAI API key is required when AI is enabled');
      }
      
      if (this.config.ai.provider === 'anthropic' && !this.config.ai.anthropicApiKey) {
        errors.push('Anthropic API key is required when AI provider is anthropic');
      }
    }
    
    // Notification Configuration Validation
    if (this.config.notifications.email.enabled) {
      if (!this.config.notifications.email.recipients.length) {
        errors.push('Email recipients are required when email notifications are enabled');
      }
      
      if (!this.config.notifications.email.smtp.host) {
        errors.push('SMTP host is required when email notifications are enabled');
      }
    }
    
    if (this.config.notifications.slack.enabled && !this.config.notifications.slack.webhookUrl) {
      errors.push('Slack webhook URL is required when Slack notifications are enabled');
    }
    
    if (this.config.notifications.teams.enabled && !this.config.notifications.teams.webhookUrl) {
      errors.push('Teams webhook URL is required when Teams notifications are enabled');
    }
    
    if (this.config.notifications.webhook.enabled && !this.config.notifications.webhook.url) {
      errors.push('Webhook URL is required when webhook notifications are enabled');
    }
    
    // Timeout Validation
    if (this.config.healing.timeout < 10000) {
      errors.push('Healing timeout must be at least 10 seconds');
    }
    
    if (this.config.ui.maxWaitTime < 5000) {
      errors.push('UI max wait time must be at least 5 seconds');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  mergeConfigs(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfigs(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  parseHeaders(headersString) {
    if (!headersString) return {};
    
    try {
      return JSON.parse(headersString);
    } catch (error) {
      this.logger.warn(`Failed to parse headers: ${error.message}`);
      return {};
    }
  }

  get(path) {
    return this.getNestedValue(this.config, path);
  }

  set(path, value) {
    this.setNestedValue(this.config, path, value);
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates) {
    this.config = this.mergeConfigs(this.config, updates);
    this.validateConfig();
    this.logger.info('Configuration updated');
  }

  exportConfig() {
    // Export config without sensitive information
    const exportConfig = JSON.parse(JSON.stringify(this.config));
    
    // Remove sensitive keys
    if (exportConfig.ai) {
      delete exportConfig.ai.openaiApiKey;
      delete exportConfig.ai.anthropicApiKey;
    }
    
    if (exportConfig.notifications?.email?.smtp) {
      delete exportConfig.notifications.email.smtp.password;
    }
    
    if (exportConfig.security) {
      delete exportConfig.security.apiKey;
    }
    
    if (exportConfig.database) {
      delete exportConfig.database.connectionString;
    }
    
    return exportConfig;
  }
}

module.exports = ConfigManager;