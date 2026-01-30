# Auditing Diagrams

Comprehensive guide for auditing diagram quality, coverage, and synchronization.

## Audit Types

### 1. Quality Audit
Check if diagrams follow DDD principles

### 2. Coverage Audit
Identify features/flows without diagrams

### 3. Synchronization Audit
Find outdated diagrams that don't match code

### 4. Organization Audit
Ensure proper file structure and naming

## Quality Audit Process

### Step 1: List All Diagrams

```bash
# Find all diagram files
find ai/diagrams -name "*.md" -not -name "README.md"

# Count diagrams by type
find ai/diagrams -name "feature-*.md" | wc -l
find ai/diagrams -name "sequence-*.md" | wc -l
find ai/diagrams -name "arch-*.md" | wc -l
```

### Step 2: Check Each Diagram Against DDD Principles

For each diagram, verify:

#### Structure Check
- [ ] File has proper header (Type, Last Updated, Related Files)
- [ ] File has Purpose section
- [ ] File has Mermaid code block
- [ ] File has Key Insights section
- [ ] File has Change History section

#### DDD Compliance Check
- [ ] Shows Front-Stage (user experience)
- [ ] Shows Back-Stage (implementation)
- [ ] User is entry point or primary actor
- [ ] Impact annotations on Back-Stage components
- [ ] Error paths are shown
- [ ] Recovery options are included
- [ ] No custom colors (except #90EE90 for Before/After)

#### Content Quality Check
- [ ] Purpose focuses on user value, not technical details
- [ ] Impact annotations use appropriate symbols (⚡💾🛡️✅⏱️🔄📊🎯)
- [ ] Impact annotations explain user benefit
- [ ] Key insights connect technical to user value
- [ ] Mermaid syntax is valid
- [ ] Diagram is readable (not too complex)

#### Metadata Check
- [ ] "Last Updated" is within reasonable timeframe
- [ ] "Related Files" paths are valid
- [ ] File is in correct directory
- [ ] File name follows naming convention

### Step 3: Create Quality Report

```markdown
# Diagram Quality Audit Report

**Date:** YYYY-MM-DD
**Total Diagrams:** X

## Quality Summary

- ✅ **Excellent** (meets all criteria): X diagrams
- ⚠️ **Needs Improvement** (minor issues): X diagrams
- ❌ **Poor Quality** (major issues): X diagrams

## Issues Found

### High Priority (Blocks user understanding)

1. **feature-checkout-flow.md**
   - ❌ Missing error paths
   - ❌ No impact annotations
   - Action: Add error handling and annotate components

2. **sequence-auth-journey.md**
   - ❌ No Front-Stage/Back-Stage separation
   - ❌ Missing user recovery options
   - Action: Restructure with subgraphs, add recovery paths

### Medium Priority (Reduces clarity)

1. **arch-system-overview.md**
   - ⚠️ Impact annotations too technical
   - ⚠️ Related files missing
   - Action: Rewrite annotations for user value, add file paths

2. **feature-search.md**
   - ⚠️ Diagram too complex (should split)
   - Action: Create separate detail diagrams

### Low Priority (Minor improvements)

1. **flow-payment-processing.md**
   - ⚠️ Purpose could be more user-focused
   - ⚠️ Key insights incomplete
   - Action: Rewrite purpose, expand insights

## Recommendations

1. Schedule time to fix high-priority issues
2. Create template/checklist for future diagrams
3. Set up pre-commit validation
4. Train team on DDD principles
```

## Coverage Audit Process

### Step 1: Identify Features/Flows

```bash
# Find feature directories
find src/features -type d

# Find major user-facing components
find src/components -name "*Page.tsx" -o -name "*View.tsx"

# Find API routes
find src/api -name "*.ts" -o -name "routes.ts"

# Find critical services
find src/services -name "*.ts"
```

### Step 2: Check if Diagrams Exist

For each major feature/flow:
- Search for related diagram: `grep -r "feature-name" ai/diagrams/`
- Check README.md index
- Verify diagram covers the flow

### Step 3: Create Coverage Report

```markdown
# Diagram Coverage Audit Report

**Date:** YYYY-MM-DD

## Features WITH Diagrams ✅

1. **User Authentication**
   - sequence-authentication-journey.md
   - feature-login-flow.md

2. **E-commerce Checkout**
   - feature-checkout-payment-flow.md
   - sequence-payment-processing.md

## Features WITHOUT Diagrams ❌

1. **Password Reset Flow**
   - Priority: HIGH (security-critical)
   - Files: `src/features/auth/PasswordReset.tsx`
   - Action: Create sequence diagram

2. **Real-time Notifications**
   - Priority: HIGH (complex user flow)
   - Files: `src/services/websocket/notificationService.ts`
   - Action: Create feature diagram

3. **Search Autocomplete**
   - Priority: MEDIUM (performance-critical)
   - Files: `src/features/search/SearchInput.tsx`
   - Action: Create feature diagram

4. **User Profile Editing**
   - Priority: LOW (straightforward CRUD)
   - Files: `src/features/profile/ProfileEdit.tsx`
   - Action: Consider if diagram needed

## Incomplete Coverage

1. **Checkout Flow** - Has payment diagram but missing cart/shipping
2. **Authentication** - Missing 2FA and OAuth flows

## Recommendations

1. Create diagrams for HIGH priority missing features
2. Complete incomplete coverage areas
3. Re-evaluate LOW priority features (diagram needed?)
```

## Synchronization Audit Process

### Step 1: Find Recently Changed Files

```bash
# Files changed in last 30 days
git log --since="30 days ago" --name-only --pretty=format: | sort | uniq > /tmp/recent-changes.txt

# Or specific time range
git log --since="2025-01-01" --until="2025-01-31" --name-only --pretty=format: | sort | uniq
```

### Step 2: Find Diagrams Referencing Changed Files

```bash
# For each changed file, find related diagrams
while read file; do
  echo "Checking: $file"
  grep -l "$file" ai/diagrams/**/*.md
done < /tmp/recent-changes.txt
```

### Step 3: Compare Diagram Dates with Change Dates

For each diagram found:
- Read "Last Updated" date from diagram
- Compare with git log for related files
- If files changed after diagram update → OUTDATED

```bash
# Get last modified date of related files
git log -1 --format="%ai" -- path/to/file.ts

# Compare with diagram's "Last Updated" date
# If file date > diagram date, diagram is outdated
```

### Step 4: Manual Review for Logic Changes

Not all code changes require diagram updates. Review:
- Are user flows affected?
- Did error handling change?
- Were new features added?
- Did performance characteristics change?
- Are impact annotations still accurate?

### Step 5: Create Synchronization Report

```markdown
# Diagram Synchronization Audit Report

**Date:** YYYY-MM-DD

## Synchronized Diagrams ✅

1. **feature-checkout-payment-flow.md**
   - Last Updated: 2025-01-15
   - Related files last changed: 2025-01-10
   - Status: UP TO DATE

## Outdated Diagrams ⚠️

1. **feature-user-authentication.md**
   - Last Updated: 2025-01-01
   - Related files last changed: 2025-01-15 (2FA added)
   - Impact: Missing 2FA flow
   - Action: Add 2FA branch to diagram

2. **sequence-search-journey.md**
   - Last Updated: 2024-12-20
   - Related files last changed: 2025-01-10 (caching added)
   - Impact: Performance annotations inaccurate
   - Action: Update with cache layer and new metrics

3. **arch-system-overview.md**
   - Last Updated: 2024-11-15
   - Related files last changed: 2025-01-05 (microservice split)
   - Impact: Architecture no longer matches
   - Action: Complete redraw showing microservices

## Suspected Outdated (Needs Manual Review) 🔍

1. **feature-notification-system.md**
   - Last Updated: 2025-01-05
   - Related files changed: 2025-01-12 (minor refactor)
   - Action: Review code changes, update if user-impacting

## Recommendations

1. Update HIGH impact outdated diagrams immediately
2. Review suspected outdated diagrams
3. Set up automated checks (pre-commit hook?)
4. Establish update policy (within 1 week of code change)
```

## Organization Audit Process

### Step 1: Check Directory Structure

```bash
# Verify expected directories exist
ls -la ai/diagrams/

# Expected:
# - features/
# - architecture/
# - journeys/
# - tests/
# - refactoring/
# - README.md
```

### Step 2: Check File Naming

```bash
# Find files not following naming convention
find ai/diagrams -name "*.md" -not -name "README.md" | while read file; do
  basename "$file" | grep -vE '^(feature|sequence|arch|flow|test)-[a-z0-9-]+\.md$' && echo "Bad name: $file"
done

# Find files in wrong directories
find ai/diagrams/features -name "*.md" | while read file; do
  basename "$file" | grep -vE '^feature-' && echo "Wrong directory: $file"
done
```

### Step 3: Check Index Completeness

Compare diagrams on filesystem with README.md index:

```bash
# List all diagrams
find ai/diagrams -name "*.md" -not -name "README.md" | sort > /tmp/all-diagrams.txt

# Extract diagrams from README
grep -oP '\[.*?\]\(\K[^)]+' ai/diagrams/README.md | sort > /tmp/indexed-diagrams.txt

# Find diagrams not in index
comm -23 /tmp/all-diagrams.txt /tmp/indexed-diagrams.txt
```

### Step 4: Create Organization Report

```markdown
# Diagram Organization Audit Report

**Date:** YYYY-MM-DD

## Directory Structure

- ✅ All expected directories exist
- ⚠️ Found unexpected directory: `ai/diagrams/old/`
  - Action: Review and move or delete

## File Naming Issues

1. ❌ `ai/diagrams/features/checkout.md`
   - Issue: Missing type prefix
   - Should be: `feature-checkout-flow.md`

2. ❌ `ai/diagrams/journeys/UserAuthenticationFlow.md`
   - Issue: Wrong case
   - Should be: `sequence-user-authentication-journey.md`

3. ❌ `ai/diagrams/arch-microservices.md`
   - Issue: Not in correct directory
   - Should be: `ai/diagrams/architecture/arch-microservices.md`

## Index Completeness

### Missing from Index

1. `features/feature-notification-system.md`
2. `refactoring/feature-add-caching-layer.md`

### Broken Links in Index

1. `[User Auth](journeys/auth-flow.md)` → File doesn't exist

## Recommendations

1. Rename files to follow convention
2. Move misplaced files to correct directories
3. Update README.md index
4. Delete obsolete directories
5. Fix broken links
```

## Automated Audit Script

```bash
#!/bin/bash
# audit-diagrams.sh

echo "=== DIAGRAM AUDIT ==="
echo ""

# Quality Check
echo "## Quality Checks"
echo ""
echo "Checking for diagrams missing key sections..."
for file in ai/diagrams/**/*.md; do
  if [ "$file" = "ai/diagrams/README.md" ]; then continue; fi

  echo "Checking: $file"

  # Check for required sections
  grep -q "^## Purpose" "$file" || echo "  ❌ Missing Purpose section"
  grep -q "^## Diagram" "$file" || echo "  ❌ Missing Diagram section"
  grep -q "^## Key Insights" "$file" || echo "  ❌ Missing Key Insights"
  grep -q "^## Change History" "$file" || echo "  ❌ Missing Change History"

  # Check for Front-Stage/Back-Stage
  grep -q "Front-Stage" "$file" || echo "  ⚠️ No Front-Stage mention"
  grep -q "Back-Stage" "$file" || echo "  ⚠️ No Back-Stage mention"

  # Check for impact annotations
  grep -q "[⚡💾🛡️✅⏱️🔄📊🎯]" "$file" || echo "  ⚠️ No impact annotation symbols found"

  echo ""
done

# Coverage Check
echo "## Coverage Check"
echo ""
echo "Features/Services:"
find src/features -type d -depth 1 | while read dir; do
  feature=$(basename "$dir")
  if ! grep -q "$feature" ai/diagrams/**/*.md; then
    echo "  ❌ No diagram for: $feature"
  fi
done

# Sync Check
echo "## Synchronization Check"
echo ""
echo "Diagrams with outdated timestamps:"
find ai/diagrams -name "*.md" -not -name "README.md" | while read file; do
  # Extract last updated date
  date=$(grep -oP '^\*\*Last Updated:\*\* \K[0-9-]+' "$file")

  if [ -z "$date" ]; then
    echo "  ❌ $file: No last updated date"
    continue
  fi

  # Check if older than 90 days
  date_seconds=$(date -d "$date" +%s)
  now_seconds=$(date +%s)
  age_days=$(( ($now_seconds - $date_seconds) / 86400 ))

  if [ $age_days -gt 90 ]; then
    echo "  ⚠️ $file: $age_days days old"
  fi
done

echo ""
echo "=== AUDIT COMPLETE ==="
```

## Best Practices

1. **Schedule regular audits** - Monthly for active projects
2. **Automate what you can** - Use scripts to catch obvious issues
3. **Prioritize fixes** - Focus on high-impact diagrams first
4. **Track improvements** - Measure quality over time
5. **Make it a habit** - Include audits in sprint reviews
6. **Document findings** - Create actionable reports
7. **Set standards** - Define acceptable quality thresholds
8. **Continuous improvement** - Learn from audit findings

## Audit Frequency

### Weekly
- Quick sync check (are recent code changes reflected?)
- Index completeness check

### Monthly
- Full quality audit
- Coverage audit for new features
- Organization audit

### Quarterly
- Comprehensive audit of all diagrams
- Review and update DDD standards
- Analyze audit trend data

## Metrics to Track

Track these over time:
- Total number of diagrams
- Percentage meeting DDD criteria
- Average diagram age
- Feature coverage percentage
- Time from code change to diagram update
- Number of broken links
- Number of naming violations

Example metrics dashboard:

```markdown
# Diagram Health Metrics

**Period:** Q1 2025

| Metric | Value | Trend |
|--------|-------|-------|
| Total Diagrams | 42 | +8 ↗️ |
| DDD Compliant | 85% | +5% ↗️ |
| Avg Age (days) | 30 | -10 ↗️ |
| Feature Coverage | 78% | +12% ↗️ |
| Outdated | 3 | -2 ↗️ |
| Broken Links | 0 | -1 ↗️ |

**Overall Health:** 🟢 GOOD
```

## Next Steps After Audit

1. **Create action items** from findings
2. **Prioritize** high-impact fixes
3. **Assign ownership** for updates
4. **Set deadlines** for critical fixes
5. **Track progress** on improvements
6. **Schedule next audit** to verify fixes
7. **Update processes** to prevent issues
