terraform {
  required_version = ">= 1.0"
  
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
  
  # Local state storage (for development)
  # For production, consider using remote backend (S3, Terraform Cloud, etc.)
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "vercel" {
  # API token is read from VERCEL_API_TOKEN environment variable
  # No need to specify it here for security
}
