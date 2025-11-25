# Switch to PostgreSQL for production testing
Write-Host "🔄 Switching to PRODUCTION mode (PostgreSQL)..." -ForegroundColor Cyan

# Swap schema files
$schemaPath = "prisma\schema.prisma"
$productionSchemaPath = "prisma\schema.production.prisma"
$backupPath = "prisma\schema.sqlite.backup"

Write-Host "📄 Swapping schema files..." -ForegroundColor Yellow

# Backup current SQLite schema
Copy-Item $schemaPath $backupPath -Force
Write-Host "   Backed up SQLite schema to: schema.sqlite.backup" -ForegroundColor White

# Copy production schema to main schema file
Copy-Item $productionSchemaPath $schemaPath -Force
Write-Host "   Activated PostgreSQL schema" -ForegroundColor Green

# Read .env and check if PostgreSQL URLs are configured
$envPath = ".env"
$envContent = Get-Content $envPath -Raw

# Update DB_PROVIDER
$envContent = $envContent -replace 'DB_PROVIDER="sqlite"', 'DB_PROVIDER="postgresql"'
$envContent = $envContent -replace 'DB_PROVIDER=sqlite', 'DB_PROVIDER="postgresql"'

Set-Content $envPath $envContent

# Check if PostgreSQL URLs are uncommented
if ($envContent -match '#\s*DATABASE_URL="postgresql://') {
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: PostgreSQL URLs are still commented!" -ForegroundColor Red
    Write-Host "   Open .env and uncomment these lines:" -ForegroundColor Yellow
    Write-Host "   DATABASE_URL=postgresql://..." -ForegroundColor White
    Write-Host "   DIRECT_URL=postgresql://..." -ForegroundColor White
    Write-Host ""
    Write-Host "   Then comment out the SQLite line:" -ForegroundColor Yellow
    Write-Host "   #DATABASE_URL=file:./dev.db" -ForegroundColor White
    Write-Host ""
}

Write-Host "✅ Switched to PostgreSQL!" -ForegroundColor Green
Write-Host "📝 Now using: prisma/schema.prisma (PostgreSQL)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Regenerating Prisma Client..." -ForegroundColor Cyan
npx prisma generate

Write-Host ""
Write-Host "✨ Ready for production testing!" -ForegroundColor Green
Write-Host "💡 Run: npm run dev (connects to Supabase)" -ForegroundColor Yellow
Write-Host "⚠️  Remember: You're now connected to PRODUCTION database!" -ForegroundColor Red
