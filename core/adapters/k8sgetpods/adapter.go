package k8sgetpods

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPods lists pods in a namespace and returns the PodList as JSON bytes.
// ctx is passed to the Kubernetes API client for cancellation and deadlines.
// If kubeconfig is empty, it tries $KUBECONFIG, then ~/.kube/config, then
// in-cluster config (for running inside a K8s pod).
// If namespace is empty, client-go lists pods from all namespaces.
func GetPods(ctx context.Context, kubeconfig string, namespace string) ([]byte, error) {
	if kubeconfig == "" {
		kubeconfig = os.Getenv("KUBECONFIG")
	}
	if kubeconfig == "" {
		home, _ := os.UserHomeDir()
		candidate := filepath.Join(home, ".kube", "config")
		if _, err := os.Stat(candidate); err == nil {
			kubeconfig = candidate
		}
	}

	var config *rest.Config
	var err error
	if kubeconfig != "" {
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	} else {
		// In-cluster config when running inside a K8s pod
		config, err = rest.InClusterConfig()
	}
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	data, err := json.Marshal(pods)
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	return data, nil
}
