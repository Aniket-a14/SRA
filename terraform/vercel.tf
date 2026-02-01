# Frontend Project
resource "vercel_project" "sra_frontend" {
  name      = "sra"  # Actual project name in Vercel
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = "Aniket-a14/SRA_frontend"  # Actual deployed repo
  }
  
  build_command = "npm run build"
  output_directory = ".next"
  install_command = "npm ci"
  
  # Note: Environment variables are managed directly in Vercel dashboard
  # to avoid storing secrets in Terraform state
}

# Backend Project
resource "vercel_project" "sra_backend" {
  name      = "sra-backend"  # Actual project name in Vercel
  
  git_repository = {
    type = "github"
    repo = "Aniket-a14/SRA_backend"  # Actual deployed repo
  }
  
  build_command = "npm run build"
  install_command = "npm ci"
  
  # Note: Environment variables are managed directly in Vercel dashboard
  # to avoid storing secrets in Terraform state
}
