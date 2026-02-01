# SRA Infrastructure as Code (Terraform)

This directory contains Terraform configuration for managing SRA infrastructure on Vercel.

## Prerequisites

1. **Terraform** >= 1.0
   ```bash
   # Install Terraform
   # Windows (Chocolatey):
   choco install terraform
   
   # macOS (Homebrew):
   brew install terraform
   
   # Or download from: https://www.terraform.io/downloads
   ```

2. **Vercel API Token**
   - Get from: https://vercel.com/account/tokens
   - Scope: "Read and Write"
   - Expiration: No expiration (with 90-day rotation policy)

## Setup

### 1. Create Configuration File

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
# IMPORTANT: Never commit terraform.tfvars to git!
```

### 2. Fill in Required Values

Edit `terraform.tfvars` with your actual values:
- `vercel_api_token` - From Vercel dashboard
- `database_url` - From Supabase
- `gemini_api_key` - From Google AI Studio
- All other secrets from your `.env` files

## Usage

### Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the Vercel provider and sets up the backend.

### Plan Changes

```bash
# Preview what will be created/changed
terraform plan
```

### Apply Configuration

```bash
# Apply changes to create/update infrastructure
terraform apply

# Auto-approve (use with caution)
terraform apply -auto-approve
```

### View Current State

```bash
# Show current infrastructure
terraform show

# List all resources
terraform state list
```

### Destroy Infrastructure

```bash
# Remove all managed infrastructure
terraform destroy

# WARNING: This will delete your Vercel projects!
# Only use for testing or decommissioning
```

## File Structure

```
terraform/
├── main.tf                    # Provider and backend configuration
├── variables.tf               # Variable definitions
├── vercel.tf                  # Vercel project resources
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example configuration
├── terraform.tfvars           # Your actual values (gitignored)
└── README.md                  # This file
```

## Security Best Practices

### 1. Never Commit Secrets

Ensure these files are in `.gitignore`:
- `terraform.tfvars`
- `terraform.tfstate`
- `terraform.tfstate.backup`
- `.terraform/`

### 2. Use Environment Variables

Alternative to `terraform.tfvars`:
```bash
export TF_VAR_vercel_api_token="your-token"
export TF_VAR_database_url="your-db-url"
# ... etc

terraform apply
```

### 3. Remote State (Production)

For production, use remote state backend:

```hcl
# main.tf
terraform {
  backend "s3" {
    bucket = "sra-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}
```

Or use Terraform Cloud:
```hcl
terraform {
  cloud {
    organization = "your-org"
    workspaces {
      name = "sra-production"
    }
  }
}
```

## Workflow

### Initial Setup (One-time)

```bash
# 1. Initialize
terraform init

# 2. Import existing Vercel projects (if any)
terraform import vercel_project.sra_frontend <project-id>
terraform import vercel_project.sra_backend <project-id>

# 3. Plan and apply
terraform plan
terraform apply
```

### Regular Updates

```bash
# 1. Update configuration files
# 2. Plan changes
terraform plan -out=tfplan

# 3. Review plan
# 4. Apply if looks good
terraform apply tfplan
```

### Disaster Recovery

```bash
# 1. Ensure terraform.tfvars has all secrets
# 2. Initialize Terraform
terraform init

# 3. Recreate infrastructure
terraform apply
```

## Troubleshooting

### "Error: Invalid provider configuration"

**Cause:** Missing `VERCEL_API_TOKEN` environment variable

**Solution:**
```bash
export VERCEL_API_TOKEN="your-token"
# Or add to terraform.tfvars
```

### "Error: Project already exists"

**Cause:** Trying to create a project that already exists

**Solution:**
```bash
# Import existing project
terraform import vercel_project.sra_frontend <project-id>
```

### "Error: Unauthorized"

**Cause:** Invalid or expired Vercel token

**Solution:**
1. Generate new token at vercel.com/account/tokens
2. Update `terraform.tfvars` or environment variable

## Maintenance

### Token Rotation (Every 90 Days)

1. Generate new Vercel API token
2. Update `terraform.tfvars` or environment variable
3. Test with `terraform plan`
4. Document rotation in `OPERATIONS.md`

### State Backup

```bash
# Backup current state
cp terraform.tfstate terraform.tfstate.backup-$(date +%Y%m%d)

# Store securely (encrypted)
```

## Resources

- [Terraform Vercel Provider](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Vercel API Documentation](https://vercel.com/docs/rest-api)

## Support

For issues or questions:
- Check [OPERATIONS.md](../OPERATIONS.md) for operational procedures
- Review [ARCHITECTURE.md](../ARCHITECTURE.md) for infrastructure design
- Contact: aniketsahaworkspace@gmail.com
