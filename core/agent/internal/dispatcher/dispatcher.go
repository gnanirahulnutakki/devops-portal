package dispatcher

import (
	"context"
	"fmt"

	"github.com/TBD_PROJECT_NAME/core/adapters/k8sgetpods"
	"github.com/TBD_PROJECT_NAME/core/adapters/mcpclient"
)

// Dispatcher routes adapter operations by name using a kubeconfig path for Kubernetes adapters.
type Dispatcher struct {
	kubeconfig string
}

// New returns a Dispatcher that uses kubeconfig for adapters that talk to the cluster.
func New(kubeconfig string) *Dispatcher {
	return &Dispatcher{kubeconfig: kubeconfig}
}

// Execute runs the named adapter with params. ctx is forwarded to adapters that support it.
func (d *Dispatcher) Execute(ctx context.Context, adapterName string, params map[string]any) ([]byte, error) {
	switch adapterName {
	case "k8s-get-pods":
		ns, _ := params["namespace"].(string)
		return k8sgetpods.GetPods(ctx, d.kubeconfig, ns)
	case "mcp-client":
		return mcpclient.CallTool(ctx, params)
	default:
		return nil, fmt.Errorf("unknown adapter: %s", adapterName)
	}
}
