const OpenAI = require('openai');
const Logger = require('./logger');

class AIAnalyzer {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    this.logger = new Logger('AIAnalyzer');
  }

  async initialize() {
    this.logger.info('Initializing AI Analyzer');
    // Test API connectivity
    try {
      await this.openai.models.list();
      this.logger.info('AI Analyzer initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI Analyzer:', error.message);
      throw error;
    }
  }

  async analyzeExperimentFailure(error, experiment, businessImpact) {
    this.logger.info('Analyzing experiment failure with AI');

    const prompt = this.buildAnalysisPrompt(error, experiment, businessImpact);
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in A/B testing automation and web technologies. Analyze test failures and suggest healing strategies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      });

      const analysis = this.parseAnalysisResponse(completion.choices[0].message.content);
      this.logger.info('AI analysis completed');
      
      return analysis;

    } catch (error) {
      this.logger.error('AI analysis failed:', error.message);
      return this.getFallbackAnalysis(error, experiment);
    }
  }

  buildAnalysisPrompt(error, experiment, businessImpact) {
    return `
Analyze this A/B testing experiment failure:

EXPERIMENT DETAILS:
- Name: ${experiment.name}
- Variants: ${experiment.variants.map(v => v.name).join(', ')}
- Business Impact: ${businessImpact.level}
- Revenue at Risk: $${businessImpact.amount}

ERROR INFORMATION:
- Error Type: ${error.name}
- Error Message: ${error.message}
- Stack Trace: ${error.stack?.split('\n').slice(0, 3).join('\n')}

CONTEXT:
- Test Selectors: ${this.extractSelectors(experiment)}
- Conversion Events: ${this.extractConversionEvents(experiment)}

Please provide:
1. Root cause analysis
2. Failure category (UI, API, Timing, Configuration)
3. Business impact assessment
4. Top 3 healing strategies with confidence scores (0-100)
5. Risk assessment for each strategy

Format your response as JSON with these fields:
{
  "rootCause": "...",
  "category": "...",
  "impactAssessment": "...",
  "healingStrategies": [
    {
      "name": "...",
      "description": "...",
      "confidence": 85,
      "risk": "low|medium|high",
      "estimatedTime": "seconds"
    }
  ]
}
    `;
  }

  parseAnalysisResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON, using fallback');
      return this.parseTextAnalysis(response);
    }
  }

  parseTextAnalysis(response) {
    // Fallback text parsing logic
    return {
      rootCause: 'AI analysis parsing failed',
      category: 'unknown',
      impactAssessment: 'medium',
      healingStrategies: [
        {
          name: 'generic_retry',
          description: 'Retry with basic strategies',
          confidence: 50,
          risk: 'medium',
          estimatedTime: '30'
        }
      ]
    };
  }

  getFallbackAnalysis(error, experiment) {
    return {
      rootCause: 'AI analysis unavailable',
      category: this.categorizeErrorFallback(error),
      impactAssessment: 'medium',
      healingStrategies: this.getBasicHealingStrategies(error)
    };
  }

  categorizeErrorFallback(error) {
    if (error.message.includes('element') || error.message.includes('selector')) {
      return 'ui';
    } else if (error.message.includes('api') || error.message.includes('http')) {
      return 'api';
    } else if (error.message.includes('timeout')) {
      return 'timing';
    }
    return 'unknown';
  }

  getBasicHealingStrategies(error) {
    return [
      {
        name: 'retry_with_wait',
        description: 'Retry operation with increased wait time',
        confidence: 60,
        risk: 'low',
        estimatedTime: '30'
      },
      {
        name: 'alternative_selector',
        description: 'Try alternative element selectors',
        confidence: 70,
        risk: 'medium',
        estimatedTime: '45'
      }
    ];
  }

  extractSelectors(experiment) {
    return experiment.variants
      .flatMap(v => v.selectors || [])
      .join(', ');
  }

  extractConversionEvents(experiment) {
    return experiment.variants
      .map(v => v.conversionEvent)
      .join(', ');
  }

  async generateAlternativeSelectors(originalSelector, pageContext) {
    const prompt = `
Generate 5 alternative CSS selectors for this element:
Original selector: ${originalSelector}
Page context: ${pageContext}

Requirements:
- Must be valid CSS selectors
- Should be robust and specific
- Include data attributes, text content, and positional selectors
- Order by reliability

Return as JSON array: ["selector1", "selector2", ...]
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2
      });

      const selectors = JSON.parse(completion.choices[0].message.content);
      return Array.isArray(selectors) ? selectors : [];
    } catch (error) {
      this.logger.warn('Failed to generate alternative selectors:', error.message);
      return this.generateFallbackSelectors(originalSelector);
    }
  }

  generateFallbackSelectors(originalSelector) {
    // Basic selector variations
    const variations = [];
    
    if (originalSelector.startsWith('#')) {
      const id = originalSelector.slice(1);
      variations.push(
        `[id="${id}"]`,
        `[id*="${id}"]`,
        `*[id="${id}"]`
      );
    }
    
    if (originalSelector.startsWith('.')) {
      const className = originalSelector.slice(1);
      variations.push(
        `[class*="${className}"]`,
        `[class="${className}"]`
      );
    }
    
    return variations;
  }
}

module.exports = AIAnalyzer;