package mvp

// Command is a single adapter invocation dispatched from the gateway to an agent.
type Command struct {
	OperationID string         `json:"operation_id"`
	AdapterName string         `json:"adapter_name"`
	Params      map[string]any `json:"params"`
}

// Result is the terminal outcome returned by an agent for a command.
type Result struct {
	OperationID string `json:"operation_id"`
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	ResultJSON  []byte `json:"result_json,omitempty"`
}

// RegisterRequest is the payload an agent sends when registering with the gateway.
type RegisterRequest struct {
	AgentName string `json:"agent_name"`
}

// RegisterResponse is the gateway response to a successful agent registration.
type RegisterResponse struct {
	AgentID    string `json:"agent_id"`
	AgentToken string `json:"agent_token"`
}

// ExecuteRequest is what a client sends to /execute to invoke an adapter on a specific agent.
type ExecuteRequest struct {
	AgentName   string         `json:"agent_name"`
	AdapterName string         `json:"adapter_name"`
	Params      map[string]any `json:"params"`
}

// ExecuteResponse is what the gateway returns to the client after synchronous completion
// or when the request is accepted for asynchronous retrieval.
type ExecuteResponse struct {
	OperationID string `json:"operation_id,omitempty"`
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	ResultJSON  []byte `json:"result_json,omitempty"`
}

// OperationStatus is the retained status record returned by GET /result.
type OperationStatus struct {
	OperationID string  `json:"operation_id"`
	Status      string  `json:"status"`
	Result      *Result `json:"result,omitempty"`
}
