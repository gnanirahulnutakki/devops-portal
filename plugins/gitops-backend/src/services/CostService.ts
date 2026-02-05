import { Config } from '@backstage/config';

export interface CostBreakdown {
  category: string;
  cost: number;
  percentage: number;
}

export interface ServiceCost {
  serviceName: string;
  environment: string;
  cost: number;
  previousCost: number;
  trend: 'up' | 'down' | 'flat';
  percentage: number;
  breakdown: CostBreakdown[];
}

export interface CostSummary {
  totalCost: number;
  previousTotalCost: number;
  trend: 'up' | 'down' | 'flat';
  trendPercentage: number;
  budget?: number;
  services: ServiceCost[];
  breakdown: CostBreakdown[];
  period: string;
  startDate: string;
  endDate: string;
}

export interface CostRecommendation {
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

export interface CostServiceConfig {
  provider: 'aws' | 'gcp' | 'azure' | 'mock';
  awsRegion?: string;
  budget?: number;
}

/**
 * Service for fetching cloud cost data
 * Supports AWS Cost Explorer, GCP Billing, Azure Cost Management (with mock fallback)
 */
export class CostService {
  private config: CostServiceConfig;

  constructor(config: Config) {
    this.config = {
      provider: config.getOptionalString('cost.provider') as any || 'mock',
      awsRegion: config.getOptionalString('cost.aws.region') || 'us-east-1',
      budget: config.getOptionalNumber('cost.budget'),
    };
  }

  /**
   * Get cost summary for a time period
   */
  async getCostSummary(
    period: 'daily' | 'weekly' | 'monthly',
    serviceName?: string
  ): Promise<CostSummary> {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    const previousEndDate = new Date();
    const previousStartDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        previousStartDate.setDate(previousStartDate.getDate() - 2);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        previousStartDate.setDate(previousStartDate.getDate() - 14);
        previousEndDate.setDate(previousEndDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        previousStartDate.setMonth(previousStartDate.getMonth() - 2);
        previousEndDate.setMonth(previousEndDate.getMonth() - 1);
        break;
    }

    switch (this.config.provider) {
      case 'aws':
        return this.getAWSCostSummary(startDate, endDate, previousStartDate, previousEndDate, period, serviceName);
      case 'gcp':
        return this.getGCPCostSummary(startDate, endDate, previousStartDate, previousEndDate, period, serviceName);
      case 'azure':
        return this.getAzureCostSummary(startDate, endDate, previousStartDate, previousEndDate, period, serviceName);
      default:
        return this.getMockCostSummary(startDate, endDate, period, serviceName);
    }
  }

  /**
   * Get AWS Cost Explorer data
   */
  private async getAWSCostSummary(
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    period: string,
    serviceName?: string
  ): Promise<CostSummary> {
    // In production, this would use AWS SDK:
    // const costExplorer = new AWS.CostExplorer({ region: this.config.awsRegion });
    // const response = await costExplorer.getCostAndUsage({...}).promise();
    
    // For now, return mock data with AWS-style structure
    return this.getMockCostSummary(startDate, endDate, period, serviceName);
  }

  /**
   * Get GCP Billing data
   */
  private async getGCPCostSummary(
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    period: string,
    serviceName?: string
  ): Promise<CostSummary> {
    // In production, use Google Cloud Billing API
    return this.getMockCostSummary(startDate, endDate, period, serviceName);
  }

  /**
   * Get Azure Cost Management data
   */
  private async getAzureCostSummary(
    startDate: Date,
    endDate: Date,
    previousStartDate: Date,
    previousEndDate: Date,
    period: string,
    serviceName?: string
  ): Promise<CostSummary> {
    // In production, use Azure Cost Management API
    return this.getMockCostSummary(startDate, endDate, period, serviceName);
  }

  /**
   * Generate mock cost data for development
   */
  private getMockCostSummary(
    startDate: Date,
    endDate: Date,
    period: string,
    serviceName?: string
  ): CostSummary {
    const services: ServiceCost[] = [
      this.generateServiceCost('fid-cluster', 'production', 2450, 2200),
      this.generateServiceCost('eoc-backend', 'production', 890, 920),
      this.generateServiceCost('argocd', 'shared', 340, 335),
      this.generateServiceCost('grafana-stack', 'shared', 280, 275),
      this.generateServiceCost('elasticsearch', 'shared', 1200, 1150),
      this.generateServiceCost('redis-cluster', 'production', 180, 190),
      this.generateServiceCost('iddm-service', 'staging', 420, 400),
      this.generateServiceCost('ida-analytics', 'production', 680, 720),
    ];

    const filteredServices = serviceName
      ? services.filter(s => s.serviceName.toLowerCase().includes(serviceName.toLowerCase()))
      : services;

    const totalCost = filteredServices.reduce((sum, s) => sum + s.cost, 0);
    const previousTotalCost = filteredServices.reduce((sum, s) => sum + s.previousCost, 0);
    const trendPercentage = ((totalCost - previousTotalCost) / previousTotalCost) * 100;

    return {
      totalCost,
      previousTotalCost,
      trend: trendPercentage > 2 ? 'up' : trendPercentage < -2 ? 'down' : 'flat',
      trendPercentage: Math.abs(trendPercentage),
      budget: this.config.budget,
      services: filteredServices,
      breakdown: [
        { category: 'Compute (EC2/EKS)', cost: totalCost * 0.45, percentage: 45 },
        { category: 'Storage (S3/EBS)', cost: totalCost * 0.20, percentage: 20 },
        { category: 'Database (RDS)', cost: totalCost * 0.18, percentage: 18 },
        { category: 'Network', cost: totalCost * 0.12, percentage: 12 },
        { category: 'Other', cost: totalCost * 0.05, percentage: 5 },
      ],
      period,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * Helper to generate service cost data
   */
  private generateServiceCost(
    serviceName: string,
    environment: string,
    cost: number,
    previousCost: number
  ): ServiceCost {
    const percentage = ((cost - previousCost) / previousCost) * 100;
    return {
      serviceName,
      environment,
      cost,
      previousCost,
      trend: percentage > 2 ? 'up' : percentage < -2 ? 'down' : 'flat',
      percentage: Math.abs(percentage),
      breakdown: [
        { category: 'Compute', cost: cost * 0.6, percentage: 60 },
        { category: 'Storage', cost: cost * 0.25, percentage: 25 },
        { category: 'Network', cost: cost * 0.15, percentage: 15 },
      ],
    };
  }

  /**
   * Get cost optimization recommendations
   */
  async getRecommendations(): Promise<CostRecommendation[]> {
    // In production, this could use AWS Trusted Advisor, GCP Recommendations, etc.
    return [
      {
        title: 'Use Reserved Instances for FID Cluster',
        description: 'Convert on-demand EC2 instances to Reserved Instances for consistent workloads',
        potentialSavings: 735,
        priority: 'high',
        category: 'compute',
      },
      {
        title: 'Enable S3 Intelligent Tiering',
        description: 'Move infrequently accessed data to lower-cost storage tiers automatically',
        potentialSavings: 180,
        priority: 'medium',
        category: 'storage',
      },
      {
        title: 'Right-size EKS nodes',
        description: 'Current nodes are under-utilized (avg 35% CPU). Consider smaller instance types',
        potentialSavings: 420,
        priority: 'high',
        category: 'compute',
      },
      {
        title: 'Delete unused EBS volumes',
        description: '5 unattached EBS volumes detected, totaling 500GB',
        potentialSavings: 50,
        priority: 'low',
        category: 'storage',
      },
      {
        title: 'Use Spot instances for non-critical workloads',
        description: 'Development and testing workloads can leverage Spot pricing',
        potentialSavings: 320,
        priority: 'medium',
        category: 'compute',
      },
    ];
  }

  /**
   * Get cost anomalies
   */
  async getAnomalies(): Promise<any[]> {
    // In production, this could use AWS Cost Anomaly Detection
    return [
      {
        service: 'elasticsearch',
        anomalyType: 'spike',
        expectedCost: 1000,
        actualCost: 1200,
        startDate: new Date(Date.now() - 86400000 * 3).toISOString(),
        rootCause: 'Increased index storage due to log retention policy change',
      },
    ];
  }

  /**
   * Get cost forecast
   */
  async getForecast(months: number = 3): Promise<any> {
    // In production, use AWS Cost Explorer forecast API
    const currentMonthCost = 5340;
    const forecast = [];
    
    for (let i = 1; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      forecast.push({
        month: date.toISOString().slice(0, 7),
        predictedCost: currentMonthCost * (1 + 0.05 * i), // 5% growth per month
        lowerBound: currentMonthCost * (1 + 0.02 * i),
        upperBound: currentMonthCost * (1 + 0.08 * i),
      });
    }

    return {
      currentMonthCost,
      forecast,
      annualProjection: currentMonthCost * 12 * 1.05,
    };
  }
}
