{{/*
Expand the name of the chart.
*/}}
{{- define "backstage-gitops.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "backstage-gitops.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "backstage-gitops.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "backstage-gitops.labels" -}}
helm.sh/chart: {{ include "backstage-gitops.chart" . }}
{{ include "backstage-gitops.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels - base labels used by all resources
*/}}
{{- define "backstage-gitops.selectorLabels" -}}
app.kubernetes.io/name: {{ include "backstage-gitops.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
App selector labels - includes component label for app pods only
This ensures the Service and Deployment only target app pods, not postgres
*/}}
{{- define "backstage-gitops.appSelectorLabels" -}}
{{ include "backstage-gitops.selectorLabels" . }}
app.kubernetes.io/component: app
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "backstage-gitops.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "backstage-gitops.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL fullname
*/}}
{{- define "backstage-gitops.postgres.fullname" -}}
{{- printf "%s-postgres" (include "backstage-gitops.fullname" .) -}}
{{- end }}

{{/*
PostgreSQL service name
*/}}
{{- define "backstage-gitops.postgres.serviceName" -}}
{{- if .Values.postgres.enabled }}
{{- include "backstage-gitops.postgres.fullname" . }}
{{- else }}
{{- .Values.postgres.host }}
{{- end }}
{{- end }}
