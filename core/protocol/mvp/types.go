package mvp

type Command struct {
	OperationID string         `json:"operation_id"`
	AdapterName string         `json:"adapter_name"`
	Params      map[string]any `json:"params"`
}

type Result struct {
	OperationID string `json:"operation_id"`
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	ResultJSON  []byte `json:"result_json,omitempty"`
}

type RegisterRequest struct {
	AgentName string `json:"agent_name"`
}

type RegisterResponse struct {
	AgentID string `json:"agent_id"`
}

// ExecuteRequest is what a client sends to /execute to invoke an adapter
// on a specific agent. Deliberately does not carry operation_id — that is
// a gateway-internal concern.
type ExecuteRequest struct {
	AgentName   string         `json:"agent_name"`
	AdapterName string         `json:"adapter_name"`
	Params      map[string]any `json:"params"`
}

// ExecuteResponse is what the gateway returns to the client after the
// agent completes (or times out on) the execution.
type ExecuteResponse struct {
	OK         bool   `json:"ok"`
	Error      string `json:"error,omitempty"`
	ResultJSON []byte `json:"result_json,omitempty"`
}
