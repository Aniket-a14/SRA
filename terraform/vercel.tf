# Frontend Project
resource "vercel_project" "sra_frontend" {
  name      = var.project_name
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = var.github_repo_frontend
  }
  
  build_command = "npm run build"
  output_directory = ".next"
  install_command = "npm ci"
  
  # Note: Environment variables are managed directly in Vercel dashboard
  # to avoid storing secrets in Terraform state
}

# Backend Project
resource "vercel_project" "sra_backend" {
  name      = "${var.project_name}-backend"
  
  git_repository = {
    type = "github"
    repo = var.github_repo_backend
  }
  
  build_command = "npm run build"
  install_command = "npm ci"
  
  # Note: Environment variables are managed directly in Vercel dashboard
  # to avoid storing secrets in Terraform state
}
