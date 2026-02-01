output "frontend_project_id" {
  description = "Vercel project ID for frontend"
  value       = vercel_project.sra_frontend.id
}

output "backend_project_id" {
  description = "Vercel project ID for backend"
  value       = vercel_project.sra_backend.id
}

output "frontend_url" {
  description = "Frontend production URL"
  value       = "https://${vercel_project.sra_frontend.name}.vercel.app"
}

output "backend_url" {
  description = "Backend production URL"
  value       = "https://${vercel_project.sra_backend.name}.vercel.app"
}
