package k8sgetpods

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// GetPods lists pods in a namespace and returns the PodList as JSON bytes.
// If kubeconfig is empty, it falls back to $KUBECONFIG and then ~/.kube/config.
// If namespace is empty, client-go lists pods from all namespaces.
func GetPods(kubeconfig string, namespace string) ([]byte, error) {
	if kubeconfig == "" {
		kubeconfig = os.Getenv("KUBECONFIG")
	}
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("k8s-get-pods: %w", err)
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	data, err := json.Marshal(pods)
	if err != nil {
		return nil, fmt.Errorf("k8s-get-pods: %w", err)
	}

	return data, nil
}
