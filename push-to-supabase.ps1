# Push Prisma Schema to Supabase
# This script temporarily sets environment variables to push schema to Supabase

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Push Schema to Supabase PostgreSQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Your Supabase credentials (from Supabase Dashboard → Settings → Database)
# Connection string format: postgresql://postgres:[YOUR-PASSWORD]@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres

Write-Host "Please enter your Supabase database password:" -ForegroundColor Yellow
$supabasePassword = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabasePassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set temporary environment variables
$env:DATABASE_URL = "postgresql://postgres.gcuypucjznrtfltsxwsd:$password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
$env:DIRECT_URL = "postgresql://postgres.gcuypucjznrtfltsxwsd:$password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

Write-Host ""
Write-Host "Connecting to Supabase..." -ForegroundColor Green
Write-Host ""

# Run Prisma DB Push
npx prisma db push

# Clear sensitive data
Remove-Variable password
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host ""
Write-Host "Done! Your local .env.local is unchanged." -ForegroundColor Green
Write-Host "The schema has been pushed to Supabase production database." -ForegroundColor Green
