const Logger = require('./logger');

class NotificationSystem {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('NotificationSystem');
    this.channels = this.initializeChannels();
  }

  initializeChannels() {
    const channels = {};
    
    // Email notifications
    if (this.config.email?.enabled) {
      channels.email = {
        enabled: true,
        recipients: this.config.email.recipients || [],
        smtp: this.config.email.smtp
      };
    }
    
    // Slack notifications
    if (this.config.slack?.enabled) {
      channels.slack = {
        enabled: true,
        webhookUrl: this.config.slack.webhookUrl,
        channel: this.config.slack.channel || '#experiments'
      };
    }
    
    // Teams notifications
    if (this.config.teams?.enabled) {
      channels.teams = {
        enabled: true,
        webhookUrl: this.config.teams.webhookUrl
      };
    }
    
    // Dashboard/webhook notifications
    if (this.config.webhook?.enabled) {
      channels.webhook = {
        enabled: true,
        url: this.config.webhook.url,
        headers: this.config.webhook.headers || {}
      };
    }
    
    return channels;
  }

  async sendHealingSuccess(experiment, healingAttempts) {
    const message = {
      type: 'healing_success',
      title: '🎉 Experiment Self-Healing Successful',
      experiment: experiment.name,
      details: `Experiment automatically recovered after ${healingAttempts} healing attempts`,
      timestamp: new Date(),
      severity: 'info',
      actions: [
        {
          text: 'View Experiment',
          url: this.getExperimentUrl(experiment.id)
        }
      ]
    };
    
    await this.sendNotification(message);
  }

  async sendExperimentFailure(experiment, error) {
    const revenueCalculator = require('./revenue-impact-calculator');
    const calculator = new revenueCalculator(this.config);
    const businessImpact = calculator.calculateExperimentValue(experiment);
    
    const message = {
      type: 'experiment_failure',
      title: '🚨 Critical: Experiment Failure',
      experiment: experiment.name,
      details: `Experiment failed after all healing attempts. Revenue at risk: ${businessImpact.amount.toLocaleString()}`,
      error: error.message,
      timestamp: new Date(),
      severity: 'critical',
      actions: [
        {
          text: 'Debug Experiment',
          url: this.getExperimentDebugUrl(experiment.id)
        },
        {
          text: 'View Logs',
          url: this.getLogsUrl(experiment.id)
        }
      ]
    };
    
    await this.sendNotification(message);
  }

  async sendRevenueAlert(experiment, revenueImpact) {
    const message = {
      type: 'revenue_alert',
      title: '💰 Revenue Impact Alert',
      experiment: experiment.name,
      details: `Potential revenue loss detected: ${revenueImpact.totalLoss.toLocaleString()} over ${revenueImpact.downtimeHours.toFixed(1)} hours`,
      timestamp: new Date(),
      severity: revenueImpact.impact === 'critical' ? 'critical' : 'warning',
      actions: [
        {
          text: 'View Revenue Dashboard',
          url: this.getRevenueDashboardUrl(experiment.id)
        }
      ]
    };
    
    await this.sendNotification(message);
  }

  async sendStatisticalSignificance(experiment, results) {
    const winner = results.recommendations[0] || 'No clear winner';
    
    const message = {
      type: 'statistical_significance',
      title: '📊 Experiment Reached Statistical Significance',
      experiment: experiment.name,
      details: `Results are statistically significant. ${winner}`,
      timestamp: new Date(),
      severity: 'info',
      actions: [
        {
          text: 'View Results',
          url: this.getResultsUrl(experiment.id)
        },
        {
          text: 'Implement Winner',
          url: this.getImplementationUrl(experiment.id)
        }
      ]
    };
    
    await this.sendNotification(message);
  }

  async sendHealingAttempt(experiment, strategy, attempt) {
    // Only send for high-value experiments to avoid noise
    const revenueCalculator = require('./revenue-impact-calculator');
    const calculator = new revenueCalculator(this.config);
    const businessImpact = calculator.calculateExperimentValue(experiment);
    
    if (businessImpact.level !== 'critical' && businessImpact.level !== 'high') {
      return; // Don't notify for low-impact experiments
    }
    
    const message = {
      type: 'healing_attempt',
      title: '🔧 Experiment Self-Healing in Progress',
      experiment: experiment.name,
      details: `Attempting healing strategy: ${strategy} (Attempt ${attempt})`,
      timestamp: new Date(),
      severity: 'warning',
      actions: [
        {
          text: 'Monitor Progress',
          url: this.getMonitoringUrl(experiment.id)
        }
      ]
    };
    
    await this.sendNotification(message);
  }

  async sendNotification(message) {
    this.logger.info(`Sending notification: ${message.type}`);
    
    const promises = [];
    
    // Send to all enabled channels
    Object.entries(this.channels).forEach(([channelType, config]) => {
      if (config.enabled) {
        promises.push(this.sendToChannel(channelType, config, message));
      }
    });
    
    try {
      await Promise.allSettled(promises);
      this.logger.info('Notifications sent successfully');
    } catch (error) {
      this.logger.error('Failed to send notifications:', error.message);
    }
  }

  async sendToChannel(channelType, config, message) {
    try {
      switch (channelType) {
        case 'email':
          await this.sendEmail(config, message);
          break;
        case 'slack':
          await this.sendSlack(config, message);
          break;
        case 'teams':
          await this.sendTeams(config, message);
          break;
        case 'webhook':
          await this.sendWebhook(config, message);
          break;
        default:
          this.logger.warn(`Unknown notification channel: ${channelType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send to ${channelType}:`, error.message);
    }
  }

  async sendEmail(config, message) {
    // Email implementation would go here
    // Using a service like SendGrid, AWS SES, etc.
    this.logger.debug(`Email notification sent: ${message.title}`);
  }

  async sendSlack(config, message) {
    const axios = require('axios');
    
    const slackMessage = {
      channel: config.channel,
      username: 'AB Test Framework',
      icon_emoji: this.getEmojiForSeverity(message.severity),
      attachments: [
        {
          color: this.getColorForSeverity(message.severity),
          title: message.title,
          text: message.details,
          fields: [
            {
              title: 'Experiment',
              value: message.experiment,
              short: true
            },
            {
              title: 'Time',
              value: message.timestamp.toLocaleString(),
              short: true
            }
          ],
          actions: message.actions?.map(action => ({
            type: 'button',
            text: action.text,
            url: action.url
          })) || []
        }
      ]
    };
    
    await axios.post(config.webhookUrl, slackMessage);
    this.logger.debug(`Slack notification sent: ${message.title}`);
  }

  async sendTeams(config, message) {
    const axios = require('axios');
    
    const teamsMessage = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: message.title,
      themeColor: this.getColorForSeverity(message.severity),
      sections: [
        {
          activityTitle: message.title,
          activitySubtitle: message.experiment,
          facts: [
            {
              name: 'Details',
              value: message.details
            },
            {
              name: 'Time',
              value: message.timestamp.toLocaleString()
            }
          ]
        }
      ],
      potentialAction: message.actions?.map(action => ({
        '@type': 'OpenUri',
        name: action.text,
        targets: [
          {
            os: 'default',
            uri: action.url
          }
        ]
      })) || []
    };
    
    await axios.post(config.webhookUrl, teamsMessage);
    this.logger.debug(`Teams notification sent: ${message.title}`);
  }

  async sendWebhook(config, message) {
    const axios = require('axios');
    
    await axios.post(config.url, message, {
      headers: config.headers,
      timeout: 10000
    });
    
    this.logger.debug(`Webhook notification sent: ${message.title}`);
  }

  getEmojiForSeverity(severity) {
    const emojiMap = {
      'info': ':information_source:',
      'warning': ':warning:',
      'critical': ':rotating_light:'
    };
    
    return emojiMap[severity] || ':information_source:';
  }

  getColorForSeverity(severity) {
    const colorMap = {
      'info': '#36a64f',    // Green
      'warning': '#ff9500', // Orange  
      'critical': '#ff0000' // Red
    };
    
    return colorMap[severity] || '#36a64f';
  }

  // URL helper methods - these would integrate with your dashboard/monitoring system
  getExperimentUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}`;
  }

  getExperimentDebugUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}/debug`;
  }

  getLogsUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}/logs`;
  }

  getRevenueDashboardUrl(experimentId) {
    return `${this.config.dashboardUrl}/revenue/${experimentId}`;
  }

  getResultsUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}/results`;
  }

  getImplementationUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}/implement`;
  }

  getMonitoringUrl(experimentId) {
    return `${this.config.dashboardUrl}/experiments/${experimentId}/monitor`;
  }
}

module.exports = NotificationSystem;