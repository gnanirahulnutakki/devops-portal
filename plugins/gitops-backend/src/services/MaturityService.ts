import { Config } from '@backstage/config';
import fetch from 'node-fetch';

export interface MaturityCheck {
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  weight: number;
  details?: string;
}

export interface MaturityCategory {
  name: string;
  score: number;
  maxScore: number;
  checks: MaturityCheck[];
}

export interface MaturityResult {
  serviceName: string;
  grade: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  score: number;
  maxScore: number;
  percentage: number;
  categories: MaturityCategory[];
  improvements: string[];
  evaluatedAt: string;
}

export interface MaturityServiceConfig {
  githubToken?: string;
  githubApiUrl?: string;
}

/**
 * Service for evaluating service maturity based on multiple criteria
 */
export class MaturityService {
  private config: MaturityServiceConfig;
  
  constructor(config: Config) {
    this.config = {
      githubToken: config.getOptionalString('integrations.github.0.token'),
      githubApiUrl: config.getOptionalString('integrations.github.0.apiBaseUrl') || 'https://api.github.com',
    };
  }

  /**
   * Evaluate the maturity of a service/repository
   */
  async evaluateMaturity(owner: string, repo: string): Promise<MaturityResult> {
    const categories: MaturityCategory[] = [];
    
    // Evaluate each category
    const [
      documentation,
      testing,
      cicd,
      monitoring,
      security,
      infrastructure,
    ] = await Promise.all([
      this.evaluateDocumentation(owner, repo),
      this.evaluateTesting(owner, repo),
      this.evaluateCICD(owner, repo),
      this.evaluateMonitoring(owner, repo),
      this.evaluateSecurity(owner, repo),
      this.evaluateInfrastructure(owner, repo),
    ]);

    categories.push(documentation, testing, cicd, monitoring, security, infrastructure);

    // Calculate total score
    const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
    const maxScore = categories.reduce((sum, cat) => sum + cat.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);

    // Determine grade
    let grade: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
    if (percentage >= 90) {
      grade = 'Platinum';
    } else if (percentage >= 75) {
      grade = 'Gold';
    } else if (percentage >= 50) {
      grade = 'Silver';
    } else {
      grade = 'Bronze';
    }

    // Generate improvement suggestions
    const improvements: string[] = [];
    categories.forEach(category => {
      category.checks.forEach(check => {
        if (check.status === 'failed') {
          improvements.push(`Add ${check.name.toLowerCase()}: ${check.description}`);
        }
      });
    });

    return {
      serviceName: `${owner}/${repo}`,
      grade,
      score: totalScore,
      maxScore,
      percentage,
      categories,
      improvements: improvements.slice(0, 10),
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if a file exists in the repository
   */
  private async fileExists(owner: string, repo: string, path: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.githubApiUrl}/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: this.getHeaders(),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get repository details
   */
  private async getRepoDetails(owner: string, repo: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.githubApiUrl}/repos/${owner}/${repo}`,
        {
          headers: this.getHeaders(),
        }
      );
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get workflows for the repository
   */
  private async getWorkflows(owner: string, repo: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.config.githubApiUrl}/repos/${owner}/${repo}/actions/workflows`,
        {
          headers: this.getHeaders(),
        }
      );
      if (!response.ok) return [];
      const data = await response.json() as any;
      return data.workflows || [];
    } catch {
      return [];
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'DevOps-Portal-Maturity-Service',
    };
    if (this.config.githubToken) {
      headers['Authorization'] = `token ${this.config.githubToken}`;
    }
    return headers;
  }

  /**
   * Evaluate documentation maturity
   */
  private async evaluateDocumentation(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];

    // Check for README
    const hasReadme = await this.fileExists(owner, repo, 'README.md');
    checks.push({
      name: 'README',
      description: 'Repository has a README.md file',
      status: hasReadme ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for API docs (OpenAPI/Swagger)
    const hasOpenApi = await this.fileExists(owner, repo, 'openapi.yaml') ||
                       await this.fileExists(owner, repo, 'openapi.json') ||
                       await this.fileExists(owner, repo, 'swagger.yaml') ||
                       await this.fileExists(owner, repo, 'swagger.json') ||
                       await this.fileExists(owner, repo, 'docs/api');
    checks.push({
      name: 'API Documentation',
      description: 'API documentation (OpenAPI/Swagger)',
      status: hasOpenApi ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for architecture docs
    const hasArchDocs = await this.fileExists(owner, repo, 'docs/architecture') ||
                        await this.fileExists(owner, repo, 'ARCHITECTURE.md') ||
                        await this.fileExists(owner, repo, 'docs/adr');
    checks.push({
      name: 'Architecture Docs',
      description: 'Architecture documentation or ADRs',
      status: hasArchDocs ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for runbooks
    const hasRunbooks = await this.fileExists(owner, repo, 'docs/runbooks') ||
                        await this.fileExists(owner, repo, 'RUNBOOK.md') ||
                        await this.fileExists(owner, repo, 'docs/operations');
    checks.push({
      name: 'Runbooks',
      description: 'Operational runbooks available',
      status: hasRunbooks ? 'passed' : 'failed',
      weight: 25,
    });

    return this.calculateCategoryScore('Documentation', checks);
  }

  /**
   * Evaluate testing maturity
   */
  private async evaluateTesting(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];

    // Check for test directories
    const hasTests = await this.fileExists(owner, repo, 'tests') ||
                     await this.fileExists(owner, repo, 'test') ||
                     await this.fileExists(owner, repo, '__tests__') ||
                     await this.fileExists(owner, repo, 'spec');
    checks.push({
      name: 'Unit Tests',
      description: 'Unit test directory exists',
      status: hasTests ? 'passed' : 'failed',
      weight: 30,
    });

    // Check for integration tests
    const hasIntegration = await this.fileExists(owner, repo, 'tests/integration') ||
                           await this.fileExists(owner, repo, 'test/integration') ||
                           await this.fileExists(owner, repo, 'integration-tests');
    checks.push({
      name: 'Integration Tests',
      description: 'Integration test directory exists',
      status: hasIntegration ? 'passed' : 'warning',
      weight: 30,
    });

    // Check for E2E tests
    const hasE2E = await this.fileExists(owner, repo, 'tests/e2e') ||
                   await this.fileExists(owner, repo, 'e2e') ||
                   await this.fileExists(owner, repo, 'cypress');
    checks.push({
      name: 'E2E Tests',
      description: 'End-to-end test directory exists',
      status: hasE2E ? 'passed' : 'failed',
      weight: 20,
    });

    // Check for test config
    const hasTestConfig = await this.fileExists(owner, repo, 'jest.config.js') ||
                          await this.fileExists(owner, repo, 'pytest.ini') ||
                          await this.fileExists(owner, repo, 'mocha.opts');
    checks.push({
      name: 'Test Configuration',
      description: 'Test framework configuration exists',
      status: hasTestConfig ? 'passed' : 'warning',
      weight: 20,
    });

    return this.calculateCategoryScore('Testing', checks);
  }

  /**
   * Evaluate CI/CD maturity
   */
  private async evaluateCICD(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];
    const workflows = await this.getWorkflows(owner, repo);

    // Check for CI workflow
    const hasCI = workflows.length > 0 ||
                  await this.fileExists(owner, repo, '.github/workflows') ||
                  await this.fileExists(owner, repo, '.gitlab-ci.yml') ||
                  await this.fileExists(owner, repo, 'Jenkinsfile');
    checks.push({
      name: 'Automated Build',
      description: 'CI pipeline exists',
      status: hasCI ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for deployment workflow
    const hasCD = workflows.some((w: any) => 
      w.name?.toLowerCase().includes('deploy') || 
      w.path?.includes('deploy')
    );
    checks.push({
      name: 'Automated Deploy',
      description: 'CD pipeline exists',
      status: hasCD ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for GitOps config
    const hasGitOps = await this.fileExists(owner, repo, 'helm') ||
                      await this.fileExists(owner, repo, 'charts') ||
                      await this.fileExists(owner, repo, 'kustomize') ||
                      await this.fileExists(owner, repo, 'deploy');
    checks.push({
      name: 'GitOps Configuration',
      description: 'Helm charts or Kustomize config',
      status: hasGitOps ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for release workflow
    const hasRelease = workflows.some((w: any) => 
      w.name?.toLowerCase().includes('release') ||
      w.path?.includes('release')
    ) || await this.fileExists(owner, repo, '.releaserc');
    checks.push({
      name: 'Release Automation',
      description: 'Automated release process',
      status: hasRelease ? 'passed' : 'warning',
      weight: 25,
    });

    return this.calculateCategoryScore('CI/CD', checks);
  }

  /**
   * Evaluate monitoring maturity
   */
  private async evaluateMonitoring(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];

    // Check for health endpoint indicators
    const hasHealthChecks = await this.fileExists(owner, repo, 'Dockerfile');
    checks.push({
      name: 'Health Checks',
      description: 'Application health endpoints',
      status: hasHealthChecks ? 'passed' : 'warning',
      weight: 20,
    });

    // Check for metrics config
    const hasMetrics = await this.fileExists(owner, repo, 'prometheus.yml') ||
                       await this.fileExists(owner, repo, 'metrics');
    checks.push({
      name: 'Metrics',
      description: 'Prometheus metrics configuration',
      status: hasMetrics ? 'passed' : 'warning',
      weight: 20,
    });

    // Check for logging config
    const hasLogging = await this.fileExists(owner, repo, 'logging.yaml') ||
                       await this.fileExists(owner, repo, 'fluent.conf') ||
                       await this.fileExists(owner, repo, 'logback.xml');
    checks.push({
      name: 'Structured Logging',
      description: 'Logging configuration',
      status: hasLogging ? 'passed' : 'warning',
      weight: 20,
    });

    // Check for alerting
    const hasAlerts = await this.fileExists(owner, repo, 'alerts') ||
                      await this.fileExists(owner, repo, 'prometheus/alerts');
    checks.push({
      name: 'Alerting',
      description: 'Alert rules defined',
      status: hasAlerts ? 'passed' : 'failed',
      weight: 20,
    });

    // Check for dashboards
    const hasDashboards = await this.fileExists(owner, repo, 'dashboards') ||
                          await this.fileExists(owner, repo, 'grafana');
    checks.push({
      name: 'Dashboards',
      description: 'Grafana dashboards defined',
      status: hasDashboards ? 'passed' : 'failed',
      weight: 20,
    });

    return this.calculateCategoryScore('Monitoring', checks);
  }

  /**
   * Evaluate security maturity
   */
  private async evaluateSecurity(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];

    // Check for dependency scanning (Dependabot, Snyk, etc.)
    const hasDepScan = await this.fileExists(owner, repo, '.github/dependabot.yml') ||
                       await this.fileExists(owner, repo, '.snyk');
    checks.push({
      name: 'Dependency Scanning',
      description: 'Automated dependency vulnerability scanning',
      status: hasDepScan ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for SAST
    const hasSAST = await this.fileExists(owner, repo, '.github/workflows/codeql.yml') ||
                    await this.fileExists(owner, repo, 'sonar-project.properties');
    checks.push({
      name: 'SAST',
      description: 'Static Application Security Testing',
      status: hasSAST ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for secret scanning config
    const hasSecretScan = await this.fileExists(owner, repo, '.gitleaks.toml') ||
                          await this.fileExists(owner, repo, '.secrets.baseline');
    checks.push({
      name: 'Secret Detection',
      description: 'Secret scanning configuration',
      status: hasSecretScan ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for security policy
    const hasSecurityPolicy = await this.fileExists(owner, repo, 'SECURITY.md') ||
                              await this.fileExists(owner, repo, '.github/SECURITY.md');
    checks.push({
      name: 'Security Policy',
      description: 'Security disclosure policy',
      status: hasSecurityPolicy ? 'passed' : 'failed',
      weight: 25,
    });

    return this.calculateCategoryScore('Security', checks);
  }

  /**
   * Evaluate infrastructure maturity
   */
  private async evaluateInfrastructure(owner: string, repo: string): Promise<MaturityCategory> {
    const checks: MaturityCheck[] = [];

    // Check for IaC
    const hasIaC = await this.fileExists(owner, repo, 'terraform') ||
                   await this.fileExists(owner, repo, 'pulumi') ||
                   await this.fileExists(owner, repo, 'cdk');
    checks.push({
      name: 'Infrastructure as Code',
      description: 'Terraform, Pulumi, or CDK configuration',
      status: hasIaC ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for K8s manifests
    const hasK8s = await this.fileExists(owner, repo, 'kubernetes') ||
                   await this.fileExists(owner, repo, 'k8s') ||
                   await this.fileExists(owner, repo, 'manifests');
    checks.push({
      name: 'Kubernetes Manifests',
      description: 'Kubernetes deployment manifests',
      status: hasK8s ? 'passed' : 'warning',
      weight: 25,
    });

    // Check for Docker
    const hasDocker = await this.fileExists(owner, repo, 'Dockerfile') ||
                      await this.fileExists(owner, repo, 'docker-compose.yml');
    checks.push({
      name: 'Containerization',
      description: 'Docker configuration',
      status: hasDocker ? 'passed' : 'failed',
      weight: 25,
    });

    // Check for environment config
    const hasEnvConfig = await this.fileExists(owner, repo, '.env.example') ||
                         await this.fileExists(owner, repo, 'env.template');
    checks.push({
      name: 'Environment Config',
      description: 'Environment variable template',
      status: hasEnvConfig ? 'passed' : 'warning',
      weight: 25,
    });

    return this.calculateCategoryScore('Infrastructure', checks);
  }

  /**
   * Calculate category score from checks
   */
  private calculateCategoryScore(name: string, checks: MaturityCheck[]): MaturityCategory {
    let score = 0;
    let maxScore = 0;

    checks.forEach(check => {
      maxScore += check.weight;
      if (check.status === 'passed') {
        score += check.weight;
      } else if (check.status === 'warning') {
        score += check.weight * 0.5;
      }
    });

    return {
      name,
      score: Math.round(score),
      maxScore,
      checks,
    };
  }

  /**
   * Get maturity badge SVG
   */
  getBadgeSVG(grade: string, percentage: number): string {
    const colors: Record<string, string> = {
      Bronze: '#CD7F32',
      Silver: '#C0C0C0',
      Gold: '#FFD700',
      Platinum: '#E5E4E2',
    };
    const color = colors[grade] || '#808080';
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
      <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <mask id="a">
        <rect width="120" height="20" rx="3" fill="#fff"/>
      </mask>
      <g mask="url(#a)">
        <path fill="#555" d="M0 0h65v20H0z"/>
        <path fill="${color}" d="M65 0h55v20H65z"/>
        <path fill="url(#b)" d="M0 0h120v20H0z"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="33.5" y="15" fill="#010101" fill-opacity=".3">maturity</text>
        <text x="33.5" y="14">maturity</text>
        <text x="91.5" y="15" fill="#010101" fill-opacity=".3">${grade} ${percentage}%</text>
        <text x="91.5" y="14">${grade} ${percentage}%</text>
      </g>
    </svg>`;
  }
}
