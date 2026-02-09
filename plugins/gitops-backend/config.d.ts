export interface Config {
  /**
   * GitOps plugin configuration
   */
  gitops?: {
    /**
     * GitHub configuration
     */
    github?: {
      /**
       * GitHub organization name
       * @visibility frontend
       */
      organization: string;

      /**
       * GitHub personal access token
       * @visibility secret
       */
      token: string;
    };

    /**
     * ArgoCD configuration
     */
    argocd?: {
      /**
       * Enable ArgoCD integration
       * @visibility frontend
       */
      enabled?: boolean;

      /**
       * ArgoCD server URL
       * @visibility frontend
       */
      url: string;

      /**
       * ArgoCD auth token
       * @visibility secret
       */
      token: string;
    };
  };
}
