const Logger = require('./logger');

class RevenueImpactCalculator {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('RevenueImpactCalculator');
  }

  calculateExperimentValue(experiment) {
    const baselineRevenue = this.estimateBaselineRevenue(experiment);
    const potentialUplift = this.estimatePotentialUplift(experiment);
    const riskFactor = this.calculateRiskFactor(experiment);
    
    return {
      level: this.categorizeBusinessImpact(baselineRevenue, potentialUplift),
      amount: baselineRevenue,
      potentialUplift: potentialUplift,
      riskFactor: riskFactor,
      dailyValue: baselineRevenue / 30, // Assuming monthly baseline
      hourlyValue: baselineRevenue / (30 * 24)
    };
  }

  calculateProtectedRevenue(experiment, downtimeMs) {
    const businessImpact = this.calculateExperimentValue(experiment);
    const downtimeHours = downtimeMs / (1000 * 60 * 60);
    
    const protectedRevenue = businessImpact.hourlyValue * downtimeHours;
    
    this.logger.info(`Protected revenue calculation: ${downtimeHours}h = ${protectedRevenue.toFixed(2)}`);
    
    return protectedRevenue;
  }

  calculateLostRevenue(experiment, downtimeMs) {
    const businessImpact = this.calculateExperimentValue(experiment);
    const downtimeHours = downtimeMs / (1000 * 60 * 60);
    
    // Factor in the potential uplift loss
    const baseRevenueLoss = businessImpact.hourlyValue * downtimeHours;
    const upliftLoss = (businessImpact.potentialUplift / (30 * 24)) * downtimeHours;
    
    const totalLoss = baseRevenueLoss + upliftLoss;
    
    return {
      baseRevenueLoss,
      upliftLoss,
      totalLoss,
      downtimeHours,
      impact: this.categorizeImpact(totalLoss)
    };
  }

  estimateBaselineRevenue(experiment) {
    // Use experiment configuration or historical data
    if (experiment.expectedRevenue) {
      return experiment.expectedRevenue;
    }
    
    // Estimate based on experiment type and business category
    const categoryMultipliers = {
      'checkout': 50000,
      'signup': 20000,
      'product_page': 30000,
      'landing_page': 25000,
      'default': 15000
    };
    
    const category = this.inferExperimentCategory(experiment);
    return categoryMultipliers[category] || categoryMultipliers.default;
  }

  estimatePotentialUplift(experiment) {
    // Estimate based on experiment type
    const baseRevenue = this.estimateBaselineRevenue(experiment);
    
    const upliftRates = {
      'checkout': 0.15,      // 15% improvement typical for checkout optimization
      'signup': 0.25,        // 25% improvement typical for signup flows
      'product_page': 0.12,  // 12% improvement for product pages
      'landing_page': 0.20,  // 20% improvement for landing pages
      'default': 0.10        // 10% conservative estimate
    };
    
    const category = this.inferExperimentCategory(experiment);
    const upliftRate = upliftRates[category] || upliftRates.default;
    
    return baseRevenue * upliftRate;
  }

  calculateRiskFactor(experiment) {
    let riskScore = 0;
    
    // Higher risk for complex experiments
    if (experiment.variants && experiment.variants.length > 3) {
      riskScore += 0.2;
    }
    
    // Higher risk for critical business processes
    if (experiment.businessImpact === 'critical') {
      riskScore += 0.3;
    }
    
    // Higher risk for checkout/payment flows
    const category = this.inferExperimentCategory(experiment);
    if (category === 'checkout') {
      riskScore += 0.4;
    }
    
    // Higher risk for experiments without proper selectors
    const hasRobustSelectors = this.assessSelectorRobustness(experiment);
    if (!hasRobustSelectors) {
      riskScore += 0.3;
    }
    
    return Math.min(riskScore, 1.0); // Cap at 1.0
  }

  inferExperimentCategory(experiment) {
    const name = experiment.name.toLowerCase();
    
    if (name.includes('checkout') || name.includes('payment') || name.includes('purchase')) {
      return 'checkout';
    }
    if (name.includes('signup') || name.includes('register') || name.includes('sign up')) {
      return 'signup';
    }
    if (name.includes('product') || name.includes('pdp')) {
      return 'product_page';
    }
    if (name.includes('landing') || name.includes('homepage')) {
      return 'landing_page';
    }
    
    return 'default';
  }

  assessSelectorRobustness(experiment) {
    if (!experiment.variants) return false;
    
    let robustCount = 0;
    let totalSelectors = 0;
    
    experiment.variants.forEach(variant => {
      if (variant.selectors) {
        variant.selectors.forEach(selector => {
          totalSelectors++;
          
          // Check for robust selector patterns
          if (selector.includes('data-test') || 
              selector.includes('data-testid') || 
              selector.includes('[aria-label]') ||
              selector.match(/\[[^=]+="[^"]+"\]/)) {
            robustCount++;
          }
        });
      }
    });
    
    return totalSelectors > 0 && (robustCount / totalSelectors) > 0.5;
  }

  categorizeBusinessImpact(baseRevenue, potentialUplift) {
    const totalValue = baseRevenue + potentialUplift;
    
    if (totalValue > 100000) return 'critical';
    if (totalValue > 50000) return 'high';
    if (totalValue > 20000) return 'medium';
    return 'low';
  }

  categorizeImpact(amount) {
    if (amount > 10000) return 'critical';
    if (amount > 5000) return 'high';
    if (amount > 1000) return 'medium';
    return 'low';
  }

  generateRevenueReport(experiment, metrics) {
    const businessImpact = this.calculateExperimentValue(experiment);
    const currentResults = this.calculateCurrentResults(experiment, metrics);
    
    return {
      experiment: experiment.name,
      businessImpact: businessImpact,
      currentResults: currentResults,
      projectedValue: this.projectFinalValue(businessImpact, currentResults),
      roi: this.calculateROI(businessImpact, currentResults),
      recommendations: this.generateFinancialRecommendations(businessImpact, currentResults)
    };
  }

  calculateCurrentResults(experiment, metrics) {
    // This would integrate with actual metrics data
    return {
      visitorsToDate: metrics?.totalVisitors || 0,
      conversionsToDate: metrics?.conversions || 0,
      revenueToDate: this.calculateRevenueToDate(metrics),
      projectedMonthlyImpact: 0 // Calculate based on current trends
    };
  }

  calculateRevenueToDate(metrics) {
    if (!metrics?.variantMetrics) return 0;
    
    return Object.values(metrics.variantMetrics)
      .reduce((sum, variant) => sum + (variant.revenue || 0), 0);
  }

  projectFinalValue(businessImpact, currentResults) {
    // Project based on current performance
    const daysRunning = 7; // Assume week of data
    const monthlyProjection = (currentResults.revenueToDate / daysRunning) * 30;
    
    return {
      monthlyRevenue: monthlyProjection,
      annualRevenue: monthlyProjection * 12,
      confidence: this.calculateProjectionConfidence(currentResults)
    };
  }

  calculateROI(businessImpact, currentResults) {
    const implementationCost = 10000; // Estimated cost of running experiment
    const projectedAnnualBenefit = businessImpact.potentialUplift * 12;
    
    return {
      roi: ((projectedAnnualBenefit - implementationCost) / implementationCost) * 100,
      paybackPeriod: implementationCost / (businessImpact.potentialUplift / 12), // months
      netPresentValue: projectedAnnualBenefit - implementationCost
    };
  }

  calculateProjectionConfidence(currentResults) {
    if (currentResults.visitorsToDate > 5000) return 'high';
    if (currentResults.visitorsToDate > 1000) return 'medium';
    return 'low';
  }

  generateFinancialRecommendations(businessImpact, currentResults) {
    const recommendations = [];
    
    if (businessImpact.riskFactor > 0.7) {
      recommendations.push('High-risk experiment: Consider additional monitoring and quick rollback procedures');
    }
    
    if (businessImpact.potentialUplift > 50000) {
      recommendations.push('High-value experiment: Prioritize quick resolution of any issues');
    }
    
    if (currentResults.visitorsToDate < 1000) {
      recommendations.push('Increase traffic allocation to reach statistical significance faster');
    }
    
    return recommendations;
  }
}

module.exports = RevenueImpactCalculator;