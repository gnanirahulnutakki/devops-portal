{{/*
Expand the name of the chart.
*/}}
{{- define "devops-portal.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "devops-portal.fullname" -}}
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
{{- define "devops-portal.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "devops-portal.labels" -}}
helm.sh/chart: {{ include "devops-portal.chart" . }}
{{ include "devops-portal.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "devops-portal.selectorLabels" -}}
app.kubernetes.io/name: {{ include "devops-portal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "devops-portal.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "devops-portal.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database Host
*/}}
{{- define "devops-portal.databaseHost" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "devops-portal.fullname" .) }}
{{- else }}
{{- .Values.externalDatabase.host }}
{{- end }}
{{- end }}

{{/*
Database URL
*/}}
{{- define "devops-portal.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
postgresql://{{ .Values.postgresql.auth.username }}:$(DATABASE_PASSWORD)@{{ include "devops-portal.databaseHost" . }}:5432/{{ .Values.postgresql.auth.database }}?schema=public
{{- else }}
postgresql://{{ .Values.externalDatabase.username }}:$(DATABASE_PASSWORD)@{{ .Values.externalDatabase.host }}:{{ .Values.externalDatabase.port }}/{{ .Values.externalDatabase.database }}?schema=public&sslmode={{ .Values.externalDatabase.sslMode }}
{{- end }}
{{- end }}

{{/*
Redis Host
*/}}
{{- define "devops-portal.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "devops-portal.fullname" .) }}
{{- else }}
{{- .Values.externalRedis.host }}
{{- end }}
{{- end }}

{{/*
Redis URL
*/}}
{{- define "devops-portal.redisUrl" -}}
{{- if .Values.redis.enabled }}
redis://:$(REDIS_PASSWORD)@{{ include "devops-portal.redisHost" . }}:6379
{{- else }}
redis://:$(REDIS_PASSWORD)@{{ .Values.externalRedis.host }}:{{ .Values.externalRedis.port }}
{{- end }}
{{- end }}

{{/*
MinIO/S3 Endpoint
*/}}
{{- define "devops-portal.s3Endpoint" -}}
{{- if .Values.minio.enabled }}
http://{{ include "devops-portal.fullname" . }}-minio:9000
{{- else if .Values.externalS3.endpoint }}
{{- .Values.externalS3.endpoint }}
{{- else }}
{{- /* AWS S3 - no endpoint needed */ -}}
{{- end }}
{{- end }}

{{/*
MinIO/S3 Bucket
*/}}
{{- define "devops-portal.s3Bucket" -}}
{{- if .Values.minio.enabled }}
{{- .Values.minio.defaultBuckets | default "devops-portal-storage" }}
{{- else }}
{{- .Values.externalS3.bucket }}
{{- end }}
{{- end }}

{{/*
Environment variables for the application
*/}}
{{- define "devops-portal.env" -}}
# Core configuration
- name: NODE_ENV
  value: "production"
- name: LOG_LEVEL
  value: {{ .Values.config.logLevel | default "info" | quote }}
- name: NEXTAUTH_URL
  value: {{ .Values.config.baseUrl | quote }}

# Authentication
- name: ENABLE_CREDENTIALS_AUTH
  value: {{ .Values.config.enableCredentialsAuth | default false | quote }}
- name: BCRYPT_ROUNDS
  value: {{ .Values.config.bcryptRounds | default 12 | quote }}

# Database
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      {{- if .Values.postgresql.enabled }}
      name: {{ .Values.postgresql.auth.existingSecret }}
      key: {{ .Values.postgresql.auth.secretKeys.userPasswordKey }}
      {{- else }}
      name: {{ .Values.externalDatabase.existingSecret }}
      key: {{ .Values.externalDatabase.existingSecretPasswordKey }}
      {{- end }}
- name: DATABASE_URL
  value: {{ include "devops-portal.databaseUrl" . | quote }}

# Redis
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      {{- if .Values.redis.enabled }}
      name: {{ .Values.redis.auth.existingSecret }}
      key: {{ .Values.redis.auth.existingSecretPasswordKey }}
      {{- else }}
      name: {{ .Values.externalRedis.existingSecret }}
      key: {{ .Values.externalRedis.existingSecretPasswordKey }}
      {{- end }}
- name: REDIS_URL
  value: {{ include "devops-portal.redisUrl" . | quote }}

# S3/MinIO
{{- if or .Values.minio.enabled .Values.externalS3.enabled }}
- name: S3_BUCKET
  value: {{ include "devops-portal.s3Bucket" . | quote }}
- name: AWS_REGION
  value: {{ .Values.externalS3.region | default "us-east-1" | quote }}
{{- if include "devops-portal.s3Endpoint" . }}
- name: S3_ENDPOINT
  value: {{ include "devops-portal.s3Endpoint" . | quote }}
- name: S3_PATH_STYLE
  value: "true"
{{- end }}
{{- if .Values.minio.enabled }}
- name: AWS_ACCESS_KEY_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.minio.auth.existingSecret | default "devops-portal-minio-sealed" }}
      key: root-user
- name: AWS_SECRET_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.minio.auth.existingSecret | default "devops-portal-minio-sealed" }}
      key: root-password
{{- else if .Values.externalS3.existingSecret }}
- name: AWS_ACCESS_KEY_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.externalS3.existingSecret }}
      key: {{ .Values.externalS3.accessKeyIdKey }}
- name: AWS_SECRET_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.externalS3.existingSecret }}
      key: {{ .Values.externalS3.secretAccessKeyKey }}
{{- end }}
{{- end }}

# ArgoCD Integration
{{- if .Values.integrations.argocd.enabled }}
- name: ARGOCD_URL
  value: {{ .Values.integrations.argocd.url | quote }}
- name: ARGOCD_INSECURE
  value: {{ .Values.integrations.argocd.insecure | default false | quote }}
- name: ARGOCD_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.argocd.existingSecret | default "devops-portal-argocd-sealed" }}
      key: {{ .Values.integrations.argocd.tokenKey | default "token" }}
{{- end }}

# Grafana Integration
{{- if .Values.integrations.grafana.enabled }}
- name: GRAFANA_URL
  value: {{ .Values.integrations.grafana.url | quote }}
- name: NEXT_PUBLIC_GRAFANA_URL
  value: {{ .Values.integrations.grafana.url | quote }}
- name: GRAFANA_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.grafana.existingSecret | default "devops-portal-grafana-sealed" }}
      key: {{ .Values.integrations.grafana.apiKeyKey | default "api-key" }}
{{- end }}

# Prometheus Integration
{{- if .Values.integrations.prometheus.enabled }}
- name: PROMETHEUS_URL
  value: {{ .Values.integrations.prometheus.url | quote }}
{{- if .Values.integrations.prometheus.existingSecret }}
- name: PROMETHEUS_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.prometheus.existingSecret }}
      key: {{ .Values.integrations.prometheus.usernameKey | default "username" }}
- name: PROMETHEUS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.prometheus.existingSecret }}
      key: {{ .Values.integrations.prometheus.passwordKey | default "password" }}
{{- end }}
{{- end }}

# GitHub OAuth
{{- if .Values.integrations.github.enabled }}
- name: GITHUB_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.github.existingSecret | default "devops-portal-github-sealed" }}
      key: {{ .Values.integrations.github.clientIdKey | default "client-id" }}
- name: GITHUB_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.github.existingSecret | default "devops-portal-github-sealed" }}
      key: {{ .Values.integrations.github.clientSecretKey | default "client-secret" }}
{{- end }}

# Keycloak OIDC
{{- if .Values.integrations.keycloak.enabled }}
- name: KEYCLOAK_ISSUER
  value: {{ .Values.integrations.keycloak.issuer | quote }}
- name: KEYCLOAK_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.keycloak.existingSecret | default "devops-portal-keycloak-sealed" }}
      key: {{ .Values.integrations.keycloak.clientIdKey | default "client-id" }}
- name: KEYCLOAK_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.integrations.keycloak.existingSecret | default "devops-portal-keycloak-sealed" }}
      key: {{ .Values.integrations.keycloak.clientSecretKey | default "client-secret" }}
{{- end }}
{{- end }}
