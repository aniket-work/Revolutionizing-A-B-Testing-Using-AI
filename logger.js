const fs = require('fs');
const path = require('path');

class Logger {
  constructor(component = 'Framework') {
    this.component = component;
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.logLevels[process.env.LOG_LEVEL] || this.logLevels.info;
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';
    this.logDirectory = process.env.LOG_DIRECTORY || './logs';
    
    this.initializeLogDirectory();
  }

  initializeLogDirectory() {
    if (this.enableFileLogging && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const levelNum = this.logLevels[level];
    if (levelNum > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      component: this.component,
      message,
      data
    };

    // Console output
    this.outputToConsole(logEntry);

    // File output
    if (this.enableFileLogging) {
      this.outputToFile(logEntry);
    }
  }

  outputToConsole(logEntry) {
    const color = this.getColorForLevel(logEntry.level);
    const dataStr = logEntry.data ? ` ${JSON.stringify(logEntry.data)}` : '';
    
    console.log(
      `${color}${logEntry.timestamp} [${logEntry.level}] [${logEntry.component}] ${logEntry.message}${dataStr}\x1b[0m`
    );
  }

  outputToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Write to general log
      fs.appendFileSync(path.join(this.logDirectory, 'framework.log'), logLine);
      
      // Write to level-specific log
      const levelFile = `${logEntry.level.toLowerCase()}.log`;
      fs.appendFileSync(path.join(this.logDirectory, levelFile), logLine);
      
      // Write to component-specific log
      const componentFile = `${this.component.toLowerCase()}.log`;
      fs.appendFileSync(path.join(this.logDirectory, componentFile), logLine);
      
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  getColorForLevel(level) {
    const colors = {
      ERROR: '\x1b[31m',   // Red
      WARN: '\x1b[33m',    // Yellow
      INFO: '\x1b[36m',    // Cyan
      DEBUG: '\x1b[37m'    // White
    };
    
    return colors[level] || '\x1b[37m';
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  // Specialized logging methods for A/B testing context
  
  logExperimentStart(experiment) {
    this.info(`Experiment started: ${experiment.name}`, {
      experimentId: experiment.id,
      variants: experiment.variants.length,
      businessImpact: experiment.businessImpact
    });
  }

  logExperimentEnd(experiment, result) {
    this.info(`Experiment completed: ${experiment.name}`, {
      experimentId: experiment.id,
      success: result.success,
      duration: result.duration,
      healingEvents: result.healingEvents?.length || 0
    });
  }

  logHealingAttempt(experiment, strategy, attempt) {
    this.warn(`Healing attempt ${attempt}: ${strategy}`, {
      experimentId: experiment.id,
      experimentName: experiment.name,
      strategy: strategy,
      attempt: attempt
    });
  }

  logHealingSuccess(experiment, strategy, recoveryTime) {
    this.info(`Healing successful: ${strategy}`, {
      experimentId: experiment.id,
      experimentName: experiment.name,
      strategy: strategy,
      recoveryTime: recoveryTime,
      recoveryTimeFormatted: `${(recoveryTime / 1000).toFixed(2)}s`
    });
  }

  logHealingFailure(experiment, error, attempts) {
    this.error(`Healing failed after ${attempts} attempts`, {
      experimentId: experiment.id,
      experimentName: experiment.name,
      error: error.message,
      attempts: attempts
    });
  }

  logRevenueImpact(experiment, impact) {
    this.warn(`Revenue impact detected: ${impact.totalLoss.toLocaleString()}`, {
      experimentId: experiment.id,
      experimentName: experiment.name,
      revenueImpact: impact,
      severity: impact.impact
    });
  }

  logAIAnalysis(experiment, analysis, processingTime) {
    this.debug('AI analysis completed', {
      experimentId: experiment.id,
      analysisCategory: analysis.category,
      strategiesGenerated: analysis.healingStrategies?.length || 0,
      processingTime: processingTime,
      confidence: analysis.confidence
    });
  }

  // Log rotation and maintenance
  
  rotateLogs() {
    if (!this.enableFileLogging) return;
    
    const maxLogFiles = parseInt(process.env.MAX_LOG_FILES) || 10;
    const maxLogSize = this.parseLogSize(process.env.MAX_LOG_SIZE || '10MB');
    
    try {
      const logFiles = fs.readdirSync(this.logDirectory)
        .filter(file => file.endsWith('.log'));
      
      logFiles.forEach(file => {
        const filePath = path.join(this.logDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.size > maxLogSize) {
          this.rotateLogFile(filePath, maxLogFiles);
        }
      });
      
    } catch (error) {
      console.error(`Log rotation failed: ${error.message}`);
    }
  }

  rotateLogFile(filePath, maxFiles) {
    const baseName = filePath.replace('.log', '');
    
    // Shift existing rotated files
    for (let i = maxFiles - 1; i > 0; i--) {
      const oldFile = `${baseName}.${i}.log`;
      const newFile = `${baseName}.${i + 1}.log`;
      
      if (fs.existsSync(oldFile)) {
        if (i === maxFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }
    
    // Rotate current file
    fs.renameSync(filePath, `${baseName}.1.log`);
    
    this.info(`Log file rotated: ${path.basename(filePath)}`);
  }

  parseLogSize(sizeString) {
    const units = {
      '