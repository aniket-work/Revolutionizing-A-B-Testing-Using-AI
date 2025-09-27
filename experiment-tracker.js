const Logger = require('./logger');

class ExperimentTracker {
  constructor(config) {
    this.config = config;
    this.experiments = new Map();
    this.metrics = new Map();
    this.logger = new Logger('ExperimentTracker');
  }

  async initialize() {
    this.logger.info('Initializing Experiment Tracker');
    // Initialize database connections, storage, etc.
    this.logger.info('Experiment Tracker initialized');
  }

  async registerExperiment(experiment) {
    this.logger.info(`Registering experiment: ${experiment.name}`);
    
    // Validate experiment configuration
    const validation = this.validateExperiment(experiment);
    if (!validation.isValid) {
      throw new Error(`Invalid experiment: ${validation.errors.join(', ')}`);
    }
    
    // Store experiment
    this.experiments.set(experiment.id, experiment);
    
    // Initialize metrics tracking
    this.metrics.set(experiment.id, {
      startTime: new Date(),
      variantMetrics: {},
      healingEvents: [],
      totalVisitors: 0,
      conversions: 0
    });
    
    this.logger.info(`Experiment registered successfully: ${experiment.id}`);
    return experiment;
  }

  async updateExperiment(experiment) {
    this.experiments.set(experiment.id, experiment);
    this.logger.debug(`Experiment updated: ${experiment.id}`);
  }

  async trackConversion(experimentId, variantId, userId, conversionData) {
    const metrics = this.metrics.get(experimentId);
    if (!metrics) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    if (!metrics.variantMetrics[variantId]) {
      metrics.variantMetrics[variantId] = {
        visitors: 0,
        conversions: 0,
        revenue: 0,
        conversionRate: 0
      };
    }
    
    const variantMetrics = metrics.variantMetrics[variantId];
    variantMetrics.conversions++;
    variantMetrics.revenue += conversionData.revenue || 0;
    variantMetrics.conversionRate = variantMetrics.conversions / variantMetrics.visitors;
    
    metrics.conversions++;
    
    this.logger.debug(`Conversion tracked: ${experimentId}/${variantId}`);
  }

  async trackVisitor(experimentId, variantId, userId) {
    const metrics = this.metrics.get(experimentId);
    if (!metrics) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    if (!metrics.variantMetrics[variantId]) {
      metrics.variantMetrics[variantId] = {
        visitors: 0,
        conversions: 0,
        revenue: 0,
        conversionRate: 0
      };
    }
    
    metrics.variantMetrics[variantId].visitors++;
    metrics.totalVisitors++;
    
    this.logger.debug(`Visitor tracked: ${experimentId}/${variantId}`);
  }

  async getExperimentMetrics(experimentId) {
    const experiment = this.experiments.get(experimentId);
    const metrics = this.metrics.get(experimentId);
    
    if (!experiment || !metrics) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }
    
    return {
      experiment: experiment,
      metrics: metrics,
      statisticalSignificance: this.calculateStatisticalSignificance(metrics),
      confidence: this.calculateConfidence(metrics),
      recommendations: this.generateRecommendations(experiment, metrics)
    };
  }

  validateExperiment(experiment) {
    const errors = [];
    
    if (!experiment.name) {
      errors.push('Experiment name is required');
    }
    
    if (!experiment.variants || experiment.variants.length < 2) {
      errors.push('At least 2 variants are required');
    }
    
    if (experiment.variants) {
      experiment.variants.forEach((variant, index) => {
        if (!variant.name) {
          errors.push(`Variant ${index} name is required`);
        }
        
        if (!variant.selectors || variant.selectors.length === 0) {
          errors.push(`Variant ${index} must have at least one selector`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  calculateStatisticalSignificance(metrics) {
    // Simplified statistical significance calculation
    // In production, use proper statistical libraries
    
    const variants = Object.keys(metrics.variantMetrics);
    if (variants.length < 2) return false;
    
    const variant1 = metrics.variantMetrics[variants[0]];
    const variant2 = metrics.variantMetrics[variants[1]];
    
    // Check minimum sample size
    const minSampleSize = 1000;
    if (variant1.visitors < minSampleSize || variant2.visitors < minSampleSize) {
      return false;
    }
    
    // Simple z-test approximation
    const p1 = variant1.conversionRate;
    const p2 = variant2.conversionRate;
    const n1 = variant1.visitors;
    const n2 = variant2.visitors;
    
    const pooledP = (variant1.conversions + variant2.conversions) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    const zScore = Math.abs(p1 - p2) / se;
    
    // Check if z-score indicates significance (p < 0.05)
    return zScore > 1.96;
  }

  calculateConfidence(metrics) {
    const variants = Object.keys(metrics.variantMetrics);
    if (variants.length < 2) return 0;
    
    const totalVisitors = Object.values(metrics.variantMetrics)
      .reduce((sum, variant) => sum + variant.visitors, 0);
    
    // Confidence increases with sample size
    if (totalVisitors < 100) return 10;
    if (totalVisitors < 1000) return 50;
    if (totalVisitors < 5000) return 80;
    return 95;
  }

  generateRecommendations(experiment, metrics) {
    const recommendations = [];
    const variants = Object.keys(metrics.variantMetrics);
    
    if (variants.length >= 2) {
      const sortedVariants = variants
        .map(id => ({
          id,
          ...metrics.variantMetrics[id]
        }))
        .sort((a, b) => b.conversionRate - a.conversionRate);
      
      const winner = sortedVariants[0];
      const runner = sortedVariants[1];
      
      const improvement = ((winner.conversionRate - runner.conversionRate) / runner.conversionRate) * 100;
      
      if (improvement > 10) {
        recommendations.push(`Strong winner: ${winner.id} shows ${improvement.toFixed(1)}% improvement`);
      } else if (improvement > 5) {
        recommendations.push(`Moderate improvement: ${winner.id} shows ${improvement.toFixed(1)}% improvement`);
      } else {
        recommendations.push('Results are close, consider running longer for clearer winner');
      }
    }
    
    return recommendations;
  }
}

module.exports = ExperimentTracker;