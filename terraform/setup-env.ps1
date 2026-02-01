# Terraform Helper Script for SRA
# This script sets up the environment and makes Terraform commands easier to run

# Refresh PATH to include Terraform
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Load Vercel API token from backend/.env
$envFile = Get-Content "../backend/.env"
$vercelToken = ($envFile | Select-String "VERCEL_API_TOKEN" | ForEach-Object { $_ -replace "VERCEL_API_TOKEN=", "" }).Trim()
$env:VERCEL_API_TOKEN = $vercelToken

Write-Host "✅ Environment configured:" -ForegroundColor Green
Write-Host "  - Terraform: $(terraform --version | Select-Object -First 1)" -ForegroundColor Cyan
Write-Host "  - Vercel Token: Loaded from backend/.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run Terraform commands:" -ForegroundColor Yellow
Write-Host "  terraform plan" -ForegroundColor White
Write-Host "  terraform apply" -ForegroundColor White
Write-Host "  terraform destroy" -ForegroundColor White
