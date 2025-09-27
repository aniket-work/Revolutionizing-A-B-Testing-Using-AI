const UIHealingStrategies = require('./ui-healing-strategies');
const APIHealingStrategies = require('./api-healing-strategies');
const LearningDatabase = require('./learning-database');
const Logger = require('./logger');

class SelfHealingEngine {
  constructor(config) {
    this.config = config;
    this.uiStrategies = new UIHealingStrategies(config);
    this.apiStrategies = new APIHealingStrategies(config);
    this.learningDb = new LearningDatabase(config);
    this.logger = new Logger('SelfHealingEngine');
  }

  async initialize() {
    this.logger.info('Initializing Self-Healing Engine');
    await this.learningDb.initialize();
    this.logger.info('Self-Healing Engine initialized');
  }

  async healExperiment(experiment, error, analysis) {
    this.logger.info(`Healing experiment: ${experiment.name}`);
    
    const context = {
      experiment,
      error,
      analysis,
      timestamp: new Date()
    };

    // Get relevant healing strategies
    const strategies = await this.generateHealingStrategies(context);
    
    // Try strategies in order of confidence
    for (const strategy of strategies) {
      this.logger.debug(`Trying healing strategy: ${strategy.name}`);
      
      try {
        const result = await this.applyStrategy(strategy, context);
        
        if (result.success) {
          this.logger.info(`Healing successful with strategy: ${strategy.name}`);
          
          // Record successful healing for learning
          await this.learningDb.recordHealing({
            experiment: experiment.name,
            error: error.message,
            strategy: strategy.name,
            success: true,
            context: context
          });
          
          return {
            success: true,
            strategy: strategy.name,
            changes: result.changes,
            confidence: strategy.confidence
          };
        }
      } catch (strategyError) {
        this.logger.warn(`Strategy ${strategy.name} failed:`, strategyError.message);
        continue;
      }
    }

    this.logger.error('All healing strategies failed');
    return { success: false };
  }

  async generateHealingStrategies(context) {
    const { experiment, error, analysis } = context;
    const strategies = [];

    // UI-based healing strategies
    if (this.isUIError(error)) {
      const uiStrategies = await this.uiStrategies.generateStrategies(context);
      strategies.push(...uiStrategies);
    }

    // API-based healing strategies  
    if (this.isAPIError(error)) {
      const apiStrategies = await this.apiStrategies.generateStrategies(context);
      strategies.push(...apiStrategies);
    }

    // Historical learning strategies
    const historicalStrategies = await this.learningDb.getSimilarHealings(error, experiment);
    strategies.push(...historicalStrategies);

    // Sort by confidence score
    return strategies.sort((a, b) => b.confidence - a.confidence);
  }

  async applyStrategy(strategy, context) {
    const strategist = this.getStrategist(strategy.type);
    return await strategist.apply(strategy, context);
  }

  getStrategist(type) {
    switch (type) {
      case 'ui':
        return this.uiStrategies;
      case 'api':
        return this.apiStrategies;
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }

  isUIError(error) {
    const uiErrorPatterns = [
      /element.*not found/i,
      /timeout.*element/i,
      /selector.*invalid/i,
      /click.*failed/i
    ];
    
    return uiErrorPatterns.some(pattern => pattern.test(error.message));
  }

  isAPIError(error) {
    const apiErrorPatterns = [
      /api.*error/i,
      /endpoint.*not found/i,
      /http.*error/i,
      /response.*invalid/i
    ];
    
    return apiErrorPatterns.some(pattern => pattern.test(error.message));
  }
}

module.exports = SelfHealingEngine;