const AIAnalyzer = require('./ai-analyzer');
const SelfHealingEngine = require('./self-healing-engine');
const ExperimentTracker = require('./experiment-tracker');
const RevenueImpactCalculator = require('./revenue-impact-calculator');
const NotificationSystem = require('./notification-system');
const Logger = require('./logger');

class ExperimentController {
  constructor(config) {
    this.config = config;
    this.aiAnalyzer = new AIAnalyzer(config);
    this.healingEngine = new SelfHealingEngine(config);
    this.tracker = new ExperimentTracker(config);
    this.revenueCalculator = new RevenueImpactCalculator(config);
    this.notifications = new NotificationSystem(config);
    this.logger = new Logger('ExperimentController');
  }

  async initialize() {
    this.logger.info('Initializing Experiment Controller');
    await Promise.all([
      this.aiAnalyzer.initialize(),
      this.healingEngine.initialize(),
      this.tracker.initialize()
    ]);
    this.logger.info('Experiment Controller initialized successfully');
  }

  async createExperiment(experimentConfig) {
    this.logger.info(`Creating experiment: ${experimentConfig.name}`);
    
    const experiment = {
      id: this.generateExperimentId(),
      ...experimentConfig,
      createdAt: new Date(),
      status: 'created',
      healingEvents: [],
      metrics: {}
    };

    await this.tracker.registerExperiment(experiment);
    return experiment;
  }

  async runExperiment(experiment, options = {}) {
    this.logger.info(`Starting experiment: ${experiment.name}`);
    
    try {
      experiment.status = 'running';
      experiment.startTime = new Date();

      const result = await this.executeExperimentWithHealing(experiment, options);
      
      experiment.status = result.success ? 'completed' : 'failed';
      experiment.endTime = new Date();
      
      await this.tracker.updateExperiment(experiment);
      
      return {
        success: result.success,
        experiment: experiment,
        healingEvents: experiment.healingEvents,
        metrics: result.metrics,
        revenueProtected: this.calculateProtectedRevenue(experiment),
        error: result.error
      };

    } catch (error) {
      this.logger.error(`Experiment ${experiment.name} failed:`, error);
      experiment.status = 'failed';
      experiment.endTime = new Date();
      
      throw error;
    }
  }

  async executeExperimentWithHealing(experiment, options) {
    let lastError = null;
    let healingAttempts = 0;
    const maxAttempts = options.maxHealingAttempts || 5;

    while (healingAttempts <= maxAttempts) {
      try {
        const result = await this.executeExperiment(experiment);
        
        if (healingAttempts > 0) {
          this.logger.info(`Experiment healed successfully after ${healingAttempts} attempts`);
          await this.notifications.sendHealingSuccess(experiment, healingAttempts);
        }
        
        return { success: true, metrics: result };

      } catch (error) {
        lastError = error;
        this.logger.warn(`Experiment attempt ${healingAttempts + 1} failed:`, error.message);

        if (healingAttempts < maxAttempts && options.enableHealing) {
          const healingResult = await this.attemptHealing(experiment, error);
          
          if (healingResult.success) {
            healingAttempts++;
            experiment.healingEvents.push({
              timestamp: new Date(),
              error: error.message,
              strategy: healingResult.strategy,
              recoveryTime: healingResult.recoveryTime
            });
            continue;
          }
        }
        
        break;
      }
    }

    this.logger.error(`Experiment failed after ${healingAttempts} healing attempts`);
    await this.notifications.sendExperimentFailure(experiment, lastError);
    
    return { success: false, error: lastError };
  }

  async executeExperiment(experiment) {
    const results = {};
    
    for (const variant of experiment.variants) {
      this.logger.debug(`Executing variant: ${variant.name}`);
      
      const variantResult = await this.executeVariant(variant, experiment);
      results[variant.name] = variantResult;
    }
    
    return results;
  }

  async executeVariant(variant, experiment) {
    // This would contain the actual test execution logic
    // For now, we'll simulate it
    const page = global.page; // Assume Playwright page is available
    
    await page.goto(variant.url || experiment.baseUrl);
    
    // Execute variant-specific actions
    for (const selector of variant.selectors) {
      await page.click(selector);
    }
    
    // Track conversion event
    await page.waitForSelector(`[data-event="${variant.conversionEvent}"]`);
    
    return {
      conversionRate: Math.random() * 0.1 + 0.02, // Simulated
      revenue: Math.random() * 1000 + 500 // Simulated
    };
  }

  async attemptHealing(experiment, error) {
    this.logger.info('Attempting to heal experiment failure');
    const startTime = Date.now();

    // Analyze error with AI
    const analysis = await this.aiAnalyzer.analyzeExperimentFailure(
      error, 
      experiment, 
      this.calculateBusinessImpact(experiment)
    );

    // Generate and apply healing strategies
    const healingResult = await this.healingEngine.healExperiment(
      experiment, 
      error, 
      analysis
    );

    const recoveryTime = Date.now() - startTime;
    
    return {
      ...healingResult,
      recoveryTime
    };
  }

  calculateBusinessImpact(experiment) {
    return this.revenueCalculator.calculateExperimentValue(experiment);
  }

  calculateProtectedRevenue(experiment) {
    if (experiment.healingEvents.length === 0) return 0;
    
    const totalDowntime = experiment.healingEvents.reduce(
      (sum, event) => sum + event.recoveryTime, 
      0
    );
    
    return this.revenueCalculator.calculateProtectedRevenue(
      experiment, 
      totalDowntime
    );
  }

  generateExperimentId() {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ExperimentController;