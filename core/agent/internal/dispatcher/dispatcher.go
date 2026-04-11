package dispatcher

import (
	"context"
	"fmt"

	"github.com/TBD_PROJECT_NAME/core/adapters/k8sgetpods"
)

type Dispatcher struct {
	kubeconfig string
}

func New(kubeconfig string) *Dispatcher {
	return &Dispatcher{kubeconfig: kubeconfig}
}

func (d *Dispatcher) Execute(ctx context.Context, adapterName string, params map[string]any) ([]byte, error) {
	switch adapterName {
	case "k8s-get-pods":
		ns, _ := params["namespace"].(string)
		return k8sgetpods.GetPods(d.kubeconfig, ns)
	default:
		return nil, fmt.Errorf("unknown adapter: %s", adapterName)
	}
}
