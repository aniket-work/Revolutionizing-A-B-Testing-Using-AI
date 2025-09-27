const Logger = require('./logger');

class UIHealingStrategies {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('UIHealingStrategies');
  }

  async generateStrategies(context) {
    const { error, experiment } = context;
    const strategies = [];

    // Strategy 1: Alternative Selectors
    if (this.isSelectorError(error)) {
      strategies.push({
        name: 'alternative_selectors',
        type: 'ui',
        confidence: 85,
        description: 'Try alternative CSS selectors for the same element',
        apply: (strategy, ctx) => this.applyAlternativeSelectors(strategy, ctx)
      });
    }

    // Strategy 2: Smart Waits
    if (this.isTimingError(error)) {
      strategies.push({
        name: 'smart_waits',
        type: 'ui',
        confidence: 80,
        description: 'Apply intelligent waiting strategies',
        apply: (strategy, ctx) => this.applySmartWaits(strategy, ctx)
      });
    }

    // Strategy 3: Element State Healing
    strategies.push({
      name: 'element_state_healing',
      type: 'ui',
      confidence: 75,
      description: 'Handle element state issues (visibility, interactability)',
      apply: (strategy, ctx) => this.applyElementStateHealing(strategy, ctx)
    });

    // Strategy 4: Visual Pattern Matching
    strategies.push({
      name: 'visual_pattern_matching',
      type: 'ui',
      confidence: 65,
      description: 'Find elements by visual characteristics',
      apply: (strategy, ctx) => this.applyVisualPatternMatching(strategy, ctx)
    });

    // Strategy 5: DOM Tree Navigation
    strategies.push({
      name: 'dom_tree_navigation',
      type: 'ui',
      confidence: 70,
      description: 'Navigate DOM relationships to find elements',
      apply: (strategy, ctx) => this.applyDOMTreeNavigation(strategy, ctx)
    });

    return strategies;
  }

  async apply(strategy, context) {
    this.logger.info(`Applying UI healing strategy: ${strategy.name}`);
    return await strategy.apply(strategy, context);
  }

  async applyAlternativeSelectors(strategy, context) {
    const { experiment, error } = context;
    const page = global.page; // Assume Playwright page
    
    const originalSelectors = this.extractFailedSelectors(error, experiment);
    const changes = [];
    
    for (const originalSelector of originalSelectors) {
      const alternatives = await this.generateSelectorAlternatives(originalSelector, page);
      
      for (const altSelector of alternatives) {
        try {
          await page.waitForSelector(altSelector, { timeout: 5000 });
          
          // Update experiment with working selector
          this.updateExperimentSelectors(experiment, originalSelector, altSelector);
          changes.push(`Updated ${originalSelector} to ${altSelector}`);
          
          this.logger.info(`Selector healing successful: ${originalSelector} -> ${altSelector}`);
          return { success: true, changes };
          
        } catch (selectorError) {
          continue; // Try next alternative
        }
      }
    }
    
    return { success: false, changes: [] };
  }

  async applySmartWaits(strategy, context) {
    const { experiment } = context;
    const page = global.page;
    const changes = [];
    
    // Increase wait times for all selectors
    const waitStrategies = [
      { name: 'networkidle', timeout: 10000 },
      { name: 'domcontentloaded', timeout: 15000 },
      { name: 'explicit_wait', timeout: 20000 }
    ];
    
    for (const waitStrategy of waitStrategies) {
      try {
        if (waitStrategy.name === 'explicit_wait') {
          await page.waitForTimeout(waitStrategy.timeout);
        } else {
          await page.waitForLoadState(waitStrategy.name, { timeout: waitStrategy.timeout });
        }
        
        changes.push(`Applied ${waitStrategy.name} wait strategy`);
        return { success: true, changes };
        
      } catch (waitError) {
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyElementStateHealing(strategy, context) {
    const { experiment } = context;
    const page = global.page;
    const changes = [];
    
    const selectors = this.getAllSelectors(experiment);
    
    for (const selector of selectors) {
      try {
        // Wait for element to be attached to DOM
        await page.waitForSelector(selector, { state: 'attached', timeout: 10000 });
        
        // Ensure element is visible
        await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
        
        // Scroll element into view
        await page.locator(selector).scrollIntoViewIfNeeded();
        
        // Wait for element to be interactable
        await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
        
        changes.push(`Healed element state for ${selector}`);
        
      } catch (stateError) {
        continue;
      }
    }
    
    return { success: changes.length > 0, changes };
  }

  async applyVisualPatternMatching(strategy, context) {
    const { experiment } = context;
    const page = global.page;
    
    // This would integrate with visual testing tools
    // For now, we'll simulate with text-based matching
    
    const textPatterns = this.extractTextPatterns(experiment);
    const changes = [];
    
    for (const pattern of textPatterns) {
      try {
        const elementByText = page.getByText(pattern);
        await elementByText.waitFor({ timeout: 10000 });
        
        changes.push(`Found element by text pattern: ${pattern}`);
        return { success: true, changes };
        
      } catch (textError) {
        continue;
      }
    }
    
    return { success: false, changes: [] };
  }

  async applyDOMTreeNavigation(strategy, context) {
    const { experiment } = context;
    const page = global.page;
    const changes = [];
    
    // Try finding elements through parent/sibling relationships
    const selectors = this.getAllSelectors(experiment);
    
    for (const selector of selectors) {
      const navigationStrategies = [
        `${selector} + *`, // Next sibling
        `${selector} ~ *`, // Following siblings  
        `${selector} > *`, // Direct children
        `${selector} *`,   // All descendants
        `*:has(${selector})` // Parent containing element
      ];
      
      for (const navSelector of navigationStrategies) {
        try {
          await page.waitForSelector(navSelector, { timeout: 5000 });
          changes.push(`Found element via DOM navigation: ${navSelector}`);
          return { success: true, changes };
        } catch (navError) {
          continue;
        }
      }
    }
    
    return { success: false, changes: [] };
  }

  // Helper methods
  
  isSelectorError(error) {
    return /element.*not found|selector.*invalid|locator.*failed/i.test(error.message);
  }

  isTimingError(error) {
    return /timeout|wait.*failed|element.*not.*ready/i.test(error.message);
  }

  extractFailedSelectors(error, experiment) {
    // Extract selectors from error message and experiment config
    const selectors = [];
    
    // Get all selectors from experiment variants
    experiment.variants.forEach(variant => {
      if (variant.selectors) {
        selectors.push(...variant.selectors);
      }
    });
    
    return selectors;
  }

  async generateSelectorAlternatives(selector, page) {
    const alternatives = [];
    
    // Generate common variations
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      alternatives.push(
        `[id="${id}"]`,
        `[id*="${id}"]`,
        `[data-testid="${id}"]`,
        `[data-test="${id}"]`,
        `[aria-label*="${id}"]`
      );
    }
    
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      alternatives.push(
        `[class*="${className}"]`,
        `[class="${className}"]`,
        `[data-class="${className}"]`
      );
    }
    
    // Add common button/input patterns
    if (selector.includes('button') || selector.includes('btn')) {
      alternatives.push(
        'button[type="submit"]',
        'input[type="submit"]',
        '[role="button"]',
        'button:last-of-type',
        '*[onclick]'
      );
    }
    
    return alternatives;
  }

  updateExperimentSelectors(experiment, oldSelector, newSelector) {
    experiment.variants.forEach(variant => {
      if (variant.selectors) {
        const index = variant.selectors.indexOf(oldSelector);
        if (index !== -1) {
          variant.selectors[index] = newSelector;
        }
      }
    });
  }

  getAllSelectors(experiment) {
    return experiment.variants
      .flatMap(variant => variant.selectors || [])
      .filter(selector => selector);
  }

  extractTextPatterns(experiment) {
    // Extract text patterns that might help identify elements
    const patterns = [];
    
    experiment.variants.forEach(variant => {
      if (variant.name.includes('checkout')) {
        patterns.push('checkout', 'buy now', 'purchase', 'complete order');
      }
      if (variant.name.includes('login')) {
        patterns.push('login', 'sign in', 'log in');
      }
      if (variant.name.includes('signup')) {
        patterns.push('sign up', 'register', 'create account');
      }
    });
    
    return patterns;
  }
}

module.exports = UIHealingStrategies;