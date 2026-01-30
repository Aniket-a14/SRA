# Organizing Diagrams

Guide for maintaining clean directory structure and consistent naming conventions.

## Directory Structure

```
ai/diagrams/
├── README.md                    # Index of all diagrams (REQUIRED)
├── features/                    # Feature-specific user flows
│   ├── feature-checkout-payment-flow.md
│   ├── feature-notification-system.md
│   └── feature-search-functionality.md
├── architecture/                # System-level diagrams
│   ├── arch-system-overview.md
│   ├── arch-microservices-architecture.md
│   └── arch-data-flow.md
├── journeys/                    # User journey sequences
│   ├── sequence-authentication-journey.md
│   ├── sequence-onboarding-flow.md
│   └── sequence-purchase-completion.md
├── tests/                       # Test coverage and strategy
│   ├── test-payment-security-coverage.md
│   └── test-e2e-critical-paths.md
└── refactoring/                 # Before/After improvements
    ├── feature-add-caching-layer.md
    └── feature-optimize-database-queries.md
```

## Naming Conventions

### Format: `{type}-{descriptive-name}.md`

**Type Prefixes:**
- `feature-` → features/
- `sequence-` → journeys/
- `arch-` → architecture/
- `flow-` → features/ or journeys/ (depending on context)
- `test-` → tests/

**Descriptive Name Rules:**
- Lowercase only
- Use hyphens (not underscores or spaces)
- Be specific and clear
- 2-5 words is ideal
- Describe the user value or flow

### Good Examples

```
✅ feature-checkout-payment-flow.md
✅ sequence-user-authentication-journey.md
✅ arch-microservices-overview.md
✅ test-payment-security-coverage.md
✅ feature-real-time-notifications.md
```

### Bad Examples

```
❌ checkout.md                    # Missing type prefix
❌ feature_checkout.md            # Underscore instead of hyphen
❌ FeatureCheckout.md             # Wrong case
❌ diagram1.md                    # Not descriptive
❌ feature-checkout-payment-flow-diagram.md  # Redundant "diagram"
❌ sequence-user-auth.md          # Too abbreviated
```

## Directory Selection Guide

### features/
**When to use:**
- Specific user-facing features
- Feature workflows
- Component interactions within a feature
- User actions within a bounded context

**Examples:**
- Checkout flow
- Notification system
- Search functionality
- User profile editing

### architecture/
**When to use:**
- System-level organization
- Multiple services/components interaction
- High-level overviews
- Infrastructure diagrams
- Technology stack diagrams

**Examples:**
- Microservices architecture
- System overview
- Data flow across services
- Deployment architecture

### journeys/
**When to use:**
- Time-based user journeys
- Multi-step processes
- Cross-feature workflows
- User onboarding
- Complete user stories

**Examples:**
- Authentication journey (login → 2FA → redirect)
- Purchase journey (browse → cart → checkout → confirmation)
- Onboarding flow (signup → verification → setup)

### tests/
**When to use:**
- Test coverage documentation
- Test strategy diagrams
- Connection between tests and user value
- Critical path testing
- Security/compliance testing

**Examples:**
- Payment security test coverage
- E2E critical paths
- Integration test strategy

### refactoring/
**When to use:**
- Before/After comparisons
- Performance improvements
- Architecture changes
- Code quality improvements
- Technical debt reduction

**Examples:**
- Adding caching layer
- Optimizing database queries
- Migrating to microservices
- Improving error handling

## README.md Index Structure

The index is the entry point for understanding. Keep it organized and current.

### Template

```markdown
# Unified Impact Diagrams Index

This directory contains all diagrams for the project, following Diagram Driven Development (DDD) methodology.

**Last Updated:** YYYY-MM-DD

## Quick Links

- [System Architecture](#architecture-overview)
- [User Journeys](#user-journeys)
- [Features](#features)
- [Test Coverage](#test-coverage)

## Architecture Overview

High-level system design and component relationships.

- [System Architecture](architecture/arch-system-overview.md) - Complete system with all major services and data flow
- [Microservices Architecture](architecture/arch-microservices-architecture.md) - Service boundaries and communication patterns

## User Journeys

Time-based user experiences across features.

- [User Authentication](journeys/sequence-authentication-journey.md) - Login, 2FA, and account recovery with security focus
- [Purchase Flow](journeys/sequence-purchase-completion.md) - Complete buying journey from browse to confirmation
- [Onboarding](journeys/sequence-onboarding-flow.md) - New user setup and first-time experience

## Features

Individual features and their user value.

- [Checkout & Payment](features/feature-checkout-payment-flow.md) - Secure payment processing with error recovery
- [Real-time Notifications](features/feature-notification-system.md) - WebSocket-based instant updates
- [Search](features/feature-search-functionality.md) - Fast search with autocomplete and caching

## Test Coverage

How we protect user value through testing.

- [Payment Security](tests/test-payment-security-coverage.md) - Comprehensive payment testing strategy
- [Critical E2E Paths](tests/test-e2e-critical-paths.md) - Essential user journeys covered by E2E tests

## Refactoring Plans

Improvements and their expected user impact.

- [Caching Layer](refactoring/feature-add-caching-layer.md) - Reduce load time from 2s to <100ms
- [Query Optimization](refactoring/feature-optimize-database-queries.md) - Improve dashboard performance by 5x

## Diagram Guidelines

All diagrams follow [Diagram Driven Development (DDD)](../commands/sync-diagrams.md) principles:
- Show both Front-Stage (user experience) and Back-Stage (implementation)
- Include impact annotations explaining user value
- Show error paths and recovery options
- Connect technical decisions to user benefit

## Contributing

When creating or updating diagrams:
1. Follow DDD principles (see guidelines above)
2. Use appropriate directory and naming convention
3. Update this index with new/modified diagrams
4. Add change history entry in diagram file
5. Update "Last Updated" in this README

## Recent Changes

- **2025-01-16:** Added caching layer refactoring diagram
- **2025-01-15:** Updated authentication journey with 2FA
- **2025-01-10:** Created real-time notification system diagram
```

### Index Best Practices

1. **Keep it current** - Update whenever diagrams change
2. **Provide context** - Brief descriptions with user value
3. **Use categories** - Group related diagrams
4. **Quick links** - Make navigation easy
5. **Document recent changes** - Help team track updates

## Reorganization Process

When structure needs changes:

### 1. Plan the Reorganization

```markdown
## Reorganization Plan

**Goal:** Consolidate scattered diagrams into proper structure

**Changes:**
1. Move `diagram1.md` → `features/feature-checkout-flow.md`
2. Rename `auth.md` → `sequence-authentication-journey.md`
3. Create `architecture/` directory
4. Move system diagrams to `architecture/`
5. Update all links in README.md
```

### 2. Execute Systematically

```bash
# Create missing directories
mkdir -p ai/diagrams/{features,architecture,journeys,tests,refactoring}

# Move and rename files
mv ai/diagrams/diagram1.md ai/diagrams/features/feature-checkout-flow.md
mv ai/diagrams/auth.md ai/diagrams/journeys/sequence-authentication-journey.md

# Update the diagram metadata (Related Files paths may change)
# Update README.md index
```

### 3. Validate After Reorganization

- [ ] All diagrams in correct directories
- [ ] All file names follow convention
- [ ] README.md index is updated
- [ ] No broken links
- [ ] Git history is preserved (use `git mv`)

## Common Organization Issues

### Issue 1: Diagrams in Root Directory

**Problem:**
```
ai/diagrams/
├── checkout.md
├── auth.md
├── system.md
└── README.md
```

**Solution:**
```bash
# Move to appropriate directories
mkdir -p ai/diagrams/{features,architecture,journeys}
mv ai/diagrams/checkout.md ai/diagrams/features/feature-checkout-flow.md
mv ai/diagrams/auth.md ai/diagrams/journeys/sequence-authentication-journey.md
mv ai/diagrams/system.md ai/diagrams/architecture/arch-system-overview.md
```

### Issue 2: Inconsistent Naming

**Problem:**
```
features/
├── feature-checkout.md
├── checkout-flow.md
├── Checkout.md
└── feature_payment.md
```

**Solution:**
```bash
# Standardize names
mv feature-checkout.md feature-checkout-flow.md
mv checkout-flow.md feature-checkout-alternate.md  # or merge
mv Checkout.md feature-checkout-main.md  # or merge
mv feature_payment.md feature-payment-processing.md
```

### Issue 3: Wrong Directory

**Problem:**
```
features/arch-system-overview.md    # Architecture in features/
journeys/feature-search.md          # Feature in journeys/
```

**Solution:**
```bash
# Move to correct directories
mv features/arch-system-overview.md architecture/
mv journeys/feature-search.md features/
```

### Issue 4: Duplicate Diagrams

**Problem:**
```
features/
├── feature-checkout-flow.md
├── feature-checkout-payment.md
└── feature-payment-checkout.md
```

**Solution:**
1. Review all three diagrams
2. Determine if they cover different aspects or duplicate
3. If duplicate: Merge into single comprehensive diagram
4. If different: Clarify names to show distinction
   - `feature-checkout-cart-management.md`
   - `feature-checkout-payment-processing.md`
   - `feature-checkout-order-confirmation.md`

## Maintenance Commands

### List All Diagrams by Type

```bash
# Feature diagrams
find ai/diagrams/features -name "feature-*.md"

# Sequence diagrams
find ai/diagrams/journeys -name "sequence-*.md"

# Architecture diagrams
find ai/diagrams/architecture -name "arch-*.md"
```

### Find Misplaced Diagrams

```bash
# Architecture diagrams not in architecture/
find ai/diagrams -name "arch-*.md" -not -path "*/architecture/*"

# Feature diagrams not in features/
find ai/diagrams -name "feature-*.md" -not -path "*/features/*"

# Sequence diagrams not in journeys/
find ai/diagrams -name "sequence-*.md" -not -path "*/journeys/*"
```

### Validate File Names

```bash
# Find files not following convention
find ai/diagrams -name "*.md" -not -name "README.md" | while read file; do
  basename "$file" | grep -vE '^(feature|sequence|arch|flow|test)-[a-z0-9-]+\.md$' && \
    echo "Invalid name: $file"
done
```

### Check for Broken Links in Index

```bash
# Extract links from README
grep -oP '\]\(\K[^)]+' ai/diagrams/README.md | while read link; do
  if [ ! -f "ai/diagrams/$link" ]; then
    echo "Broken link: $link"
  fi
done
```

## Migration Checklist

When reorganizing existing diagrams:

- [ ] Back up current state (git commit)
- [ ] Create reorganization plan
- [ ] Create missing directories
- [ ] Move files with `git mv` (preserves history)
- [ ] Rename files following convention
- [ ] Update README.md index
- [ ] Update internal links in diagrams (if any)
- [ ] Validate no broken links
- [ ] Commit with descriptive message
- [ ] Inform team of changes

## Best Practices

1. **Use `git mv`** - Preserves file history
2. **One diagram type per directory** - Don't mix feature and architecture
3. **Consistent prefixes** - Always use type prefix in filename
4. **Descriptive names** - Name should indicate content
5. **Keep README current** - Update index immediately after changes
6. **Validate regularly** - Run organization audits monthly
7. **Document changes** - Note reorganizations in README
8. **Team communication** - Inform team of structure changes
9. **No orphans** - Every diagram should be in index
10. **Regular cleanup** - Remove obsolete diagrams

## Quick Reference

### Directory Decision Tree

```
Is it showing system architecture?
├─ Yes → architecture/arch-{name}.md
└─ No → Is it a time-based journey?
    ├─ Yes → journeys/sequence-{name}.md
    └─ No → Is it feature-specific?
        ├─ Yes → features/feature-{name}.md
        └─ No → Is it about testing?
            ├─ Yes → tests/test-{name}.md
            └─ No → Is it Before/After comparison?
                ├─ Yes → refactoring/feature-{name}.md
                └─ No → Choose closest match
```

### Naming Quick Check

1. All lowercase? ✓
2. Has type prefix? ✓
3. Uses hyphens? ✓
4. Descriptive (2-5 words)? ✓
5. Ends with .md? ✓

### Index Update Template

```markdown
## [Category]

- [Clear Title](directory/filename.md) - Brief user-value description
```
