variable "vercel_api_token" {
  description = "Vercel API token for authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "project_name" {
  description = "Project name for SRA"
  type        = string
  default     = "sra"
}

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
  default     = "Aniket-a14/SRA"
}

variable "backend_url" {
  description = "Backend API URL"
  type        = string
  default     = "https://sra-backend-six.vercel.app"
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  default     = "https://sra-xi.vercel.app"
}

variable "database_url" {
  description = "PostgreSQL connection string (Supabase)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "direct_url" {
  description = "Direct PostgreSQL connection string"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "qstash_token" {
  description = "Upstash QStash token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "csrf_secret" {
  description = "CSRF secret for security"
  type        = string
  sensitive   = true
  default     = ""
}

variable "encryption_key" {
  description = "Encryption key for field-level encryption"
  type        = string
  sensitive   = true
  default     = ""
}

variable "backup_encryption_key" {
  description = "Backup encryption key"
  type        = string
  sensitive   = true
  default     = ""
}
