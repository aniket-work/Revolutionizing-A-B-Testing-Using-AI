const Logger = require('./logger');

class LearningDatabase {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('LearningDatabase');
    this.healingHistory = new Map();
    this.patterns = new Map();
    this.successRates = new Map();
  }

  async initialize() {
    this.logger.info('Initializing Learning Database');
    await this.loadHistoricalData();
    this.logger.info('Learning Database initialized');
  }

  async recordHealing(healingEvent) {
    this.logger.info('Recording healing event for learning');
    
    const healingRecord = {
      id: this.generateHealingId(),
      timestamp: new Date(),
      experiment: healingEvent.experiment,
      error: healingEvent.error,
      strategy: healingEvent.strategy,
      success: healingEvent.success,
      context: healingEvent.context,
      recoveryTime: healingEvent.recoveryTime || 0
    };
    
    // Store the healing event
    this.healingHistory.set(healingRecord.id, healingRecord);
    
    // Update patterns and success rates
    await this.updatePatterns(healingRecord);
    await this.updateSuccessRates(healingRecord);
    
    // Persist to storage (database, file, etc.)
    await this.persistHealingRecord(healingRecord);
    
    this.logger.info(`Healing event recorded: ${healingRecord.id}`);
  }

  async getSimilarHealings(error, experiment) {
    this.logger.debug('Finding similar healing patterns');
    
    const errorSignature = this.createErrorSignature(error);
    const experimentSignature = this.createExperimentSignature(experiment);
    
    const similarHealings = [];
    
    // Find healings with similar error patterns
    for (const [id, healing] of this.healingHistory) {
      const similarity = this.calculateSimilarity(
        errorSignature,
        experimentSignature,
        healing
      );
      
      if (similarity > 0.7) { // 70% similarity threshold
        similarHealings.push({
          healing,
          similarity,
          strategy: this.convertToStrategy(healing)
        });
      }
    }
    
    // Sort by similarity and success rate
    return similarHealings
      .sort((a, b) => {
        const aScore = a.similarity * this.getStrategySuccessRate(a.strategy.name);
        const bScore = b.similarity * this.getStrategySuccessRate(b.strategy.name);
        return bScore - aScore;
      })
      .map(item => item.strategy)
      .slice(0, 3); // Return top 3 strategies
  }

  async updatePatterns(healingRecord) {
    const patternKey = this.createPatternKey(healingRecord);
    
    if (!this.patterns.has(patternKey)) {
      this.patterns.set(patternKey, {
        occurrences: 0,
        successfulStrategies: new Map(),
        averageRecoveryTime: 0,
        contexts: []
      });
    }
    
    const pattern = this.patterns.get(patternKey);
    pattern.occurrences++;
    
    if (healingRecord.success) {
      const strategyCount = pattern.successfulStrategies.get(healingRecord.strategy) || 0;
      pattern.successfulStrategies.set(healingRecord.strategy, strategyCount + 1);
    }
    
    // Update average recovery time
    pattern.averageRecoveryTime = (
      (pattern.averageRecoveryTime * (pattern.occurrences - 1)) + 
      healingRecord.recoveryTime
    ) / pattern.occurrences;
    
    // Store context for future analysis
    pattern.contexts.push(healingRecord.context);
    
    this.logger.debug(`Pattern updated: ${patternKey}`);
  }

  async updateSuccessRates(healingRecord) {
    const strategy = healingRecord.strategy;
    
    if (!this.successRates.has(strategy)) {
      this.successRates.set(strategy, {
        attempts: 0,
        successes: 0,
        rate: 0,
        averageRecoveryTime: 0
      });
    }
    
    const stats = this.successRates.get(strategy);
    stats.attempts++;
    
    if (healingRecord.success) {
      stats.successes++;
    }
    
    stats.rate = stats.successes / stats.attempts;
    
    // Update average recovery time for successful healings
    if (healingRecord.success) {
      stats.averageRecoveryTime = (
        (stats.averageRecoveryTime * (stats.successes - 1)) + 
        healingRecord.recoveryTime
      ) / stats.successes;
    }
    
    this.logger.debug(`Success rate updated for ${strategy}: ${(stats.rate * 100).toFixed(1)}%`);
  }

  createErrorSignature(error) {
    // Create a signature that captures the essence of the error
    return {
      type: error.name || 'UnknownError',
      messageWords: this.extractKeyWords(error.message),
      category: this.categorizeError(error),
      stackTrace: this.extractStackTraceFeatures(error.stack)
    };
  }

  createExperimentSignature(experiment) {
    return {
      category: this.inferExperimentCategory(experiment),
      complexity: this.calculateExperimentComplexity(experiment),
      selectorTypes: this.analyzeSelectorTypes(experiment),
      businessImpact: experiment.businessImpact || 'unknown'
    };
  }

  createPatternKey(healingRecord) {
    const errorSig = this.createErrorSignature(healingRecord.error);
    const expSig = this.createExperimentSignature(healingRecord.context.experiment);
    
    return `${errorSig.category}_${expSig.category}_${errorSig.type}`;
  }

  calculateSimilarity(errorSignature, experimentSignature, healing) {
    const healingErrorSig = this.createErrorSignature(healing.error);
    const healingExpSig = this.createExperimentSignature(healing.context.experiment);
    
    let similarity = 0;
    let factors = 0;
    
    // Error type similarity
    if (errorSignature.type === healingErrorSig.type) {
      similarity += 0.3;
    }
    factors++;
    
    // Error category similarity  
    if (errorSignature.category === healingErrorSig.category) {
      similarity += 0.3;
    }
    factors++;
    
    // Experiment category similarity
    if (experimentSignature.category === healingExpSig.category) {
      similarity += 0.2;
    }
    factors++;
    
    // Business impact similarity
    if (experimentSignature.businessImpact === healingExpSig.businessImpact) {
      similarity += 0.1;
    }
    factors++;
    
    // Message similarity (using keyword overlap)
    const messageOverlap = this.calculateMessageOverlap(
      errorSignature.messageWords,
      healingErrorSig.messageWords
    );
    similarity += messageOverlap * 0.1;
    factors++;
    
    return similarity / factors;
  }

  calculateMessageOverlap(words1, words2) {
    if (!words1.length || !words2.length) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  }

  convertToStrategy(healing) {
    return {
      name: healing.strategy,
      type: this.inferStrategyType(healing.strategy),
      confidence: this.getStrategySuccessRate(healing.strategy) * 100,
      description: this.getStrategyDescription(healing.strategy),
      estimatedRecoveryTime: this.getAverageRecoveryTime(healing.strategy)
    };
  }

  getStrategySuccessRate(strategyName) {
    const stats = this.successRates.get(strategyName);
    return stats ? stats.rate : 0.5; // Default to 50% if no data
  }

  getAverageRecoveryTime(strategyName) {
    const stats = this.successRates.get(strategyName);
    return stats ? stats.averageRecoveryTime : 30000; // Default 30 seconds
  }

  // Helper methods for error and experiment analysis

  extractKeyWords(message) {
    if (!message) return [];
    
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word));
  }

  isStopWord(word) {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return stopWords.includes(word);
  }

  categorizeError(error) {
    const message = error.message ? error.message.toLowerCase() : '';
    
    if (message.includes('element') || message.includes('selector') || message.includes('locator')) {
      return 'selector';
    }
    if (message.includes('timeout') || message.includes('wait')) {
      return 'timing';
    }
    if (message.includes('api') || message.includes('http') || message.includes('endpoint')) {
      return 'api';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    return 'unknown';
  }

  extractStackTraceFeatures(stackTrace) {
    if (!stackTrace) return {};
    
    const lines = stackTrace.split('\n').slice(0, 3); // Top 3 lines
    return {
      topFunction: this.extractFunctionName(lines[0]),
      framework: this.detectFramework(stackTrace),
      lineCount: lines.length
    };
  }

  extractFunctionName(line) {
    const match = line.match(/at\s+([^\s(]+)/);
    return match ? match[1] : 'unknown';
  }

  detectFramework(stackTrace) {
    if (stackTrace.includes('playwright')) return 'playwright';
    if (stackTrace.includes('selenium')) return 'selenium';
    if (stackTrace.includes('cypress')) return 'cypress';
    return 'unknown';
  }

  inferExperimentCategory(experiment) {
    const name = experiment.name ? experiment.name.toLowerCase() : '';
    
    if (name.includes('checkout') || name.includes('payment')) return 'checkout';
    if (name.includes('signup') || name.includes('register')) return 'signup';
    if (name.includes('login') || name.includes('signin')) return 'login';
    if (name.includes('product') || name.includes('pdp')) return 'product';
    if (name.includes('landing') || name.includes('homepage')) return 'landing';
    return 'general';
  }

  calculateExperimentComplexity(experiment) {
    let complexity = 0;
    
    if (experiment.variants && experiment.variants.length > 2) {
      complexity += experiment.variants.length * 0.2;
    }
    
    const totalSelectors = experiment.variants 
      ? experiment.variants.reduce((sum, v) => sum + (v.selectors ? v.selectors.length : 0), 0)
      : 0;
    
    complexity += totalSelectors * 0.1;
    
    if (experiment.businessImpact === 'critical') complexity += 0.5;
    
    return Math.min(complexity, 1.0);
  }

  analyzeSelectorTypes(experiment) {
    const types = {
      id: 0,
      class: 0,
      dataTest: 0,
      xpath: 0,
      other: 0
    };
    
    if (!experiment.variants) return types;
    
    experiment.variants.forEach(variant => {
      if (variant.selectors) {
        variant.selectors.forEach(selector => {
          if (selector.startsWith('#')) types.id++;
          else if (selector.startsWith('.')) types.class++;
          else if (selector.includes('data-test')) types.dataTest++;
          else if (selector.startsWith('//') || selector.includes('xpath')) types.xpath++;
          else types.other++;
        });
      }
    });
    
    return types;
  }

  inferStrategyType(strategyName) {
    if (strategyName.includes('selector') || strategyName.includes('locator')) return 'ui';
    if (strategyName.includes('api') || strategyName.includes('endpoint')) return 'api';
    if (strategyName.includes('wait') || strategyName.includes('timeout')) return 'timing';
    return 'general';
  }

  getStrategyDescription(strategyName) {
    const descriptions = {
      'alternative_selectors': 'Try different CSS selectors for the same element',
      'smart_waits': 'Apply intelligent waiting strategies for element availability',
      'api_versioning': 'Attempt different API versions to find working endpoints',
      'element_state_healing': 'Handle element visibility and interactability issues',
      'exponential_backoff': 'Retry with increasing delay between attempts',
      'visual_pattern_matching': 'Find elements using visual characteristics'
    };
    
    return descriptions[strategyName] || 'Apply general healing strategy';
  }

  async loadHistoricalData() {
    // In production, this would load from persistent storage
    // For now, we'll simulate with some sample data
    this.loadSampleData();
  }

  loadSampleData() {
    // Sample healing patterns for initial learning
    const sampleHealings = [
      {
        error: { message: 'Element not found: #checkout-btn', name: 'ElementNotFoundError' },
        strategy: 'alternative_selectors',
        success: true,
        recoveryTime: 2000,
        context: { experiment: { name: 'checkout_optimization', businessImpact: 'high' } }
      },
      {
        error: { message: 'Timeout waiting for element', name: 'TimeoutError' },
        strategy: 'smart_waits',
        success: true,
        recoveryTime: 5000,
        context: { experiment: { name: 'signup_flow', businessImpact: 'medium' } }
      },
      {
        error: { message: 'API endpoint not found', name: 'NetworkError' },
        strategy: 'api_versioning',
        success: true,
        recoveryTime: 3000,
        context: { experiment: { name: 'api_test', businessImpact: 'low' } }
      }
    ];
    
    sampleHealings.forEach(healing => {
      this.recordHealing({
        experiment: healing.context.experiment.name,
        error: healing.error.message,
        strategy: healing.strategy,
        success: healing.success,
        context: healing.context,
        recoveryTime: healing.recoveryTime
      });
    });
  }

  async persistHealingRecord(record) {
    // In production, persist to database
    // For demo, we'll just log it
    this.logger.debug(`Persisting healing record: ${record.id}`);
  }

  generateHealingId() {
    return `healing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Analytics and reporting methods

  async getHealingAnalytics() {
    return {
      totalHealings: this.healingHistory.size,
      successRate: this.calculateOverallSuccessRate(),
      topStrategies: this.getTopStrategies(),
      averageRecoveryTime: this.calculateAverageRecoveryTime(),
      patternInsights: this.generatePatternInsights()
    };
  }

  calculateOverallSuccessRate() {
    if (this.healingHistory.size === 0) return 0;
    
    const successes = Array.from(this.healingHistory.values())
      .filter(healing => healing.success).length;
    
    return successes / this.healingHistory.size;
  }

  getTopStrategies() {
    return Array.from(this.successRates.entries())
      .map(([strategy, stats]) => ({
        strategy,
        successRate: stats.rate,
        attempts: stats.attempts,
        averageRecoveryTime: stats.averageRecoveryTime
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
  }

  calculateAverageRecoveryTime() {
    const healings = Array.from(this.healingHistory.values());
    if (healings.length === 0) return 0;
    
    const totalTime = healings.reduce((sum, healing) => sum + healing.recoveryTime, 0);
    return totalTime / healings.length;
  }

  generatePatternInsights() {
    const insights = [];
    
    for (const [patternKey, pattern] of this.patterns) {
      if (pattern.occurrences > 2) { // Only patterns with enough data
        const topStrategy = Array.from(pattern.successfulStrategies.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        if (topStrategy) {
          insights.push({
            pattern: patternKey,
            occurrences: pattern.occurrences,
            bestStrategy: topStrategy[0],
            successCount: topStrategy[1],
            averageRecoveryTime: pattern.averageRecoveryTime
          });
        }
      }
    }
    
    return insights.sort((a, b) => b.occurrences - a.occurrences);
  }
}

module.exports = LearningDatabase;